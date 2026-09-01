// Contract tests: every declared input, output, and error of generate(),
// exercised through the public entry point against the shipped fixtures.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { generate, ExteriorError } from '../src/index.ts';
import type { Blueprint, Floor, GenerateOptions, Opening } from '../src/index.ts';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));

/** Geometry is identical in every texture mode; structural checks read the keys-only GLB. */
const KEYS: GenerateOptions = { textures: { mode: 'keys' } };

/** The glTF JSON chunk of a GLB: NodeIO refuses to parse external image URIs. */
function glbJson(glb: Uint8Array): Record<string, any> {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
}

const residential = fixture('residential-mid');
const corpo = fixture('corpo-tower');
const factory = fixture('factory');
const bridged = fixture('bridged-tower');
const sliver = fixture('sliver-parcel');

async function code(req: unknown): Promise<string> {
  try {
    await generate(req);
    return 'none';
  } catch (err) {
    if (err instanceof ExteriorError) return err.code;
    throw err;
  }
}

describe('determinism', () => {
  it('same request gives byte-identical GLB and blueprint', async () => {
    const a = await generate(corpo);
    const b = await generate(corpo);
    expect(Buffer.from(a.glb).equals(Buffer.from(b.glb))).toBe(true);
    expect(JSON.stringify(a.blueprint)).toBe(JSON.stringify(b.blueprint));
  });

  it('a different seed changes the output', async () => {
    const a = await generate(residential);
    const b = await generate({ ...residential, seed: 'other-seed' });
    expect(Buffer.from(a.glb).equals(Buffer.from(b.glb))).toBe(false);
  });
});

describe('blueprint invariants', () => {
  it('floor elevations are contiguous with ground at 0', async () => {
    for (const req of [residential, corpo, bridged]) {
      const { blueprint } = await generate(req);
      const ground = blueprint.floors.find((f) => f.index === 0)!;
      expect(ground.elevation).toBe(0);
      for (let i = 0; i + 1 < blueprint.floors.length; i++) {
        const cur = blueprint.floors[i]!;
        const next = blueprint.floors[i + 1]!;
        expect(next.index).toBe(cur.index + 1);
        expect(next.elevation).toBeCloseTo(cur.elevation + cur.height, 6);
      }
    }
  });

  it('openings never overlap and keep the minimum pier', async () => {
    for (const req of [residential, corpo, factory, bridged]) {
      const { blueprint } = await generate(req);
      for (const floor of blueprint.floors) {
        const byEdge = new Map<number, Opening[]>();
        for (const o of floor.openings) {
          const list = byEdge.get(o.edge) ?? [];
          list.push(o);
          byEdge.set(o.edge, list);
        }
        for (const list of byEdge.values()) {
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const a = list[i]!, b = list[j]!;
              const horizontal = Math.min(a.offset + a.width, b.offset + b.width) - Math.max(a.offset, b.offset);
              const vertical = Math.min(a.sill + a.height, b.sill + b.height) - Math.max(a.sill, b.sill);
              expect(horizontal < 0.3 - 1e-6 || vertical <= 0).toBe(true);
            }
          }
        }
      }
    }
  });

  it('every balconyDoor carries balcony dimensions and residential mid has real balconies', async () => {
    const { blueprint } = await generate(residential);
    const balconyDoors = blueprint.floors.flatMap((f: Floor) => f.openings.filter((o) => o.kind === 'balconyDoor'));
    expect(balconyDoors.length).toBeGreaterThan(0);
    for (const o of balconyDoors) {
      expect(o.balcony).toBeDefined();
      expect(o.balcony!.width).toBeGreaterThan(0);
    }
  });

  it('windows carry curtain states with variety on a big tower', async () => {
    const { blueprint } = await generate(corpo);
    const states = new Set(
      blueprint.floors.flatMap((f: Floor) => f.openings.filter((o) => o.kind === 'window').map((o) => o.state)),
    );
    states.delete(undefined);
    expect(states.size).toBeGreaterThanOrEqual(2);
    for (const s of states) expect(['open', 'half', 'closed80']).toContain(s);
  });

  it('splits every window into panes within the tier pane limit, and builds them with depth', async () => {
    const { GLAZING } = await import('../src/rules/tables.ts');
    for (const [req, tier] of [[residential, 'mid'], [corpo, 'high_rich'], [factory, 'poor']] as const) {
      const { blueprint } = await generate(req, KEYS);
      const windows = blueprint.floors.flatMap((f: Floor) => f.openings.filter((o) => o.kind === 'window'));
      expect(windows.length).toBeGreaterThan(0);
      for (const w of windows) {
        expect(w.panes).toBeDefined();
        const { cols, rows } = w.panes!;
        expect(cols).toBeGreaterThanOrEqual(1);
        expect(rows).toBeGreaterThanOrEqual(1);
        expect(w.width / cols).toBeLessThanOrEqual(GLAZING.maxPaneWidth[tier] + 0.2);
        expect(w.height / rows).toBeLessThanOrEqual(GLAZING.maxPaneHeight[tier] + 0.2);
      }
    }
    // A bay past the pane limit gets mullions: the grid is real, not a constant 1x1.
    const tall = (await generate(corpo, KEYS)).blueprint.floors
      .flatMap((f: Floor) => f.openings.filter((o) => o.kind === 'window'));
    expect(tall.some((w) => (w.panes!.cols * w.panes!.rows) > 1)).toBe(true);
  });

  it('builds windows with depth, deeper set as the tier drops', async () => {
    // glass tier: mullions proud of a near-flush glazing line.
    const rich = await windowDepth(corpo);
    expect(rich.max).toBeGreaterThan(0.02);
    expect(rich.min).toBeLessThan(-0.03);
    // panel tier: the whole unit sits back behind a reveal.
    const mid = await windowDepth(residential);
    expect(mid.min).toBeLessThan(-0.12);
    // megablock tier: small windows, deep set.
    const poor = await windowDepth(factory);
    expect(poor.min).toBeLessThan(mid.min);
  });

  it('the ground floor has an entrance door on the street face', async () => {
    for (const req of [residential, corpo, factory]) {
      const { blueprint } = await generate(req);
      const ground = blueprint.floors.find((f) => f.index === 0)!;
      expect(ground.openings.some((o) => o.id === 'entrance' && o.kind === 'door')).toBe(true);
    }
  });

  it('entrance avoids sliver edges and every opening fits its edge (p1640 class)', async () => {
    const { blueprint } = await generate(sliver);
    const ground = blueprint.floors.find((f) => f.index === 0)!;
    const entrance = ground.openings.find((o) => o.id === 'entrance')!;
    expect(entrance).toBeDefined();
    const entranceEdgeLen = edgeLen(ground.outline, entrance.edge);
    expect(entranceEdgeLen).toBeGreaterThanOrEqual(3);
    for (const req of [residential, corpo, factory, bridged, sliver]) {
      const bp = (await generate(req)).blueprint;
      for (const floor of bp.floors) {
        for (const o of floor.openings) {
          expect(o.offset).toBeGreaterThanOrEqual(-1e-6);
          expect(o.offset + o.width).toBeLessThanOrEqual(edgeLen(floor.outline, o.edge) + 1e-6);
          expect(o.sill + o.height).toBeLessThanOrEqual(floor.height + 1e-6);
        }
      }
    }
  });

  it('marquee signage is placed with its text and letter height', async () => {
    const { blueprint } = await generate(factory);
    expect(blueprint.signage.length).toBe(1);
    const s = blueprint.signage[0]!;
    expect(s.mode).toBe('marquee');
    expect(s.text).toBe('NAKATOMI HEAVY INDUSTRIES');
    expect(s.letterHeight).toBeGreaterThan(0);
  });

  it('fits envelope-legal floor counts that quantization used to reject (p241 class)', async () => {
    // 7 hotel floors in 22.4 m: nominal heights overflow, scaling must round down.
    const { blueprint } = await generate({
      seed: 'urbe:p241', buildingId: 'p241',
      parcel: { footprint: [[0, 0], [24, 0], [24, 18], [0, 18]], accessPoint: [12, -1], maxHeight: 22.4 },
      building: { type: 'hotel', tier: 'mid', floors: 7 },
      theme: 'cyberpunk',
    });
    expect(blueprint.floors).toHaveLength(7);
    const top = blueprint.floors[6]!.elevation + blueprint.floors[6]!.height;
    expect(top).toBeLessThanOrEqual(22.4 + 1e-9);
    for (const f of blueprint.floors) expect(f.height).toBeGreaterThanOrEqual(2.8 - 1e-9);
  });

  it('publishes feasibility constants that match the enforced rules', async () => {
    const constants = JSON.parse(readFileSync(new URL('../schemas/floor-constants.json', import.meta.url), 'utf8'));
    const { RULES } = await import('../src/rules/tables.ts');
    const { FAMILY } = await import('../src/rules/families.ts');
    expect(constants.families).toEqual(FAMILY);
    for (const [family, c] of Object.entries(constants.constants)) {
      const r = RULES[family as keyof typeof RULES];
      expect(r.minFloorHeight).toBe((c as { minFloorHeight: number }).minFloorHeight);
      expect(r.maxFloorHeight).toBe((c as { maxFloorHeight: number }).maxFloorHeight);
      expect(r.minFootprintArea).toBe((c as { minFootprintArea: number }).minFootprintArea);
    }
  });

  it('floor kinds are the atlas type verbatim, venue floors included', async () => {
    for (const type of ['coffee_shop', 'commerce']) {
      const { blueprint } = await generate({
        seed: `urbe-venue-${type}`, buildingId: 'p900',
        parcel: { footprint: [[0, 0], [8, 0], [8, 6], [0, 6]], accessPoint: [4, -1], maxHeight: 12 },
        building: { type, tier: 'mid', floors: 2 },
        theme: 'cyberpunk',
        options: { signage: null },
      });
      expect(blueprint.floors.map((f: Floor) => f.kind)).toEqual([type, type]);
    }
  });

  it('windows:none produces doors but no windows', async () => {
    const { blueprint } = await generate({
      ...residential,
      options: { windows: 'none', signage: null },
    });
    const all = blueprint.floors.flatMap((f: Floor) => f.openings);
    expect(all.some((o) => o.kind === 'window')).toBe(false);
    expect(all.some((o) => o.kind === 'door')).toBe(true);
  });
});

describe('apertures', () => {
  let bp: Blueprint;

  it('pins a walking surface exactly at every aperture base', async () => {
    bp = (await generate(bridged)).blueprint;
    const elevations = bp.floors.map((f) => f.elevation);
    expect(elevations).toContain(24);
    expect(elevations).toContain(12);
    const basement = bp.floors.find((f) => f.index === -1)!;
    expect(basement.elevation).toBe(-3.5);
  });

  it('emits one aperture opening per cut with the request id', () => {
    const apertureOpenings = bp.floors.flatMap((f) => f.openings.filter((o) => o.kind === 'aperture'));
    expect(apertureOpenings.map((o) => o.id).sort()).toEqual(['ap-bridge-1', 'ap-tube-2', 'ap-tunnel-3']);
    const bridge = apertureOpenings.find((o) => o.id === 'ap-bridge-1')!;
    expect(bridge.apertureKind).toBe('bridge');
    expect(bridge.edge).toBe(1);
    expect(bridge.width).toBe(3);
    expect(bridge.sill).toBe(0);
  });

  it('emits a wire anchor as an anchor, never an opening', () => {
    expect(bp.anchors.map((a) => a.id)).toEqual(['ap-wire-4']);
    const anchor = bp.anchors[0]!;
    expect(anchor.position[0]).toBeCloseTo(30, 6);
    expect(anchor.position[1]).toBeCloseTo(30.25, 6);
    const all = bp.floors.flatMap((f) => f.openings);
    expect(all.some((o) => o.id === 'ap-wire-4')).toBe(false);
  });

  it('finds a legal floor split when naive nearest-floor packing would fail (p1590 class)', async () => {
    // Two bridges 6 m apart force exactly one 6 m floor between them; a nominal
    // stack puts two floors there, so a solver that cannot search counts fails.
    const req = {
      seed: 'urbe:p1590', buildingId: 'p1590',
      parcel: { footprint: [[0, 0], [30, 0], [30, 20], [0, 20]], accessPoint: [15, -2], maxHeight: 80 },
      building: { type: 'offices', tier: 'mid', floors: 15 },
      theme: 'cyberpunk',
      apertures: [
        {
          id: 'b1', buildingId: 'p1590', floor: 10, face: 1, kind: 'bridge',
          u: 10, base: 40, width: 3, height: 3, shape: 'rect',
          cut: { polygon: [[30, 40, 8.5], [30, 40, 11.5], [30, 43, 11.5], [30, 43, 8.5]], axisDir: [1, 0, 0] },
          linkId: 'L1',
        },
        {
          id: 'b2', buildingId: 'p1590', floor: 12, face: 3, kind: 'bridge',
          u: 10, base: 46, width: 3, height: 3, shape: 'rect',
          cut: { polygon: [[0, 46, 11.5], [0, 46, 8.5], [0, 49, 8.5], [0, 49, 11.5]], axisDir: [-1, 0, 0] },
          linkId: 'L2',
        },
      ],
    };
    const { blueprint } = await generate(req);
    const elevations = blueprint.floors.map((f) => f.elevation);
    expect(elevations).toContain(40);
    expect(elevations).toContain(46);
    expect(blueprint.floors).toHaveLength(15);
    for (const f of blueprint.floors) {
      expect(f.height).toBeGreaterThanOrEqual(3.4 - 1e-9);
      expect(f.height).toBeLessThanOrEqual(6.0 + 1e-9);
    }
  });

  it('reports the feasible floor-count range when no split exists', async () => {
    const req = {
      seed: 'urbe:p1590', buildingId: 'p1590',
      parcel: { footprint: [[0, 0], [30, 0], [30, 20], [0, 20]], accessPoint: [15, -2], maxHeight: 48 },
      building: { type: 'offices', tier: 'mid', floors: 3 },
      theme: 'cyberpunk',
      apertures: [{
        id: 'b1', buildingId: 'p1590', floor: 10, face: 1, kind: 'bridge',
        u: 10, base: 40, width: 3, height: 3, shape: 'rect',
        cut: { polygon: [[30, 40, 8.5], [30, 40, 11.5], [30, 43, 11.5], [30, 43, 8.5]], axisDir: [1, 0, 0] },
        linkId: 'L1',
      }],
    };
    try {
      await generate(req);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExteriorError);
      expect((err as ExteriorError).code).toBe('E_APERTURE_UNREACHABLE');
      expect((err as ExteriorError).message).toMatch(/feasible counts are \d+\.\.\d+/);
    }
  });

  it('makes the pinned floor tall enough to contain its aperture (p513 class)', async () => {
    const req = {
      seed: 'urbe:p513', buildingId: 'p513',
      parcel: { footprint: [[0, 0], [30, 0], [30, 20], [0, 20]], accessPoint: [15, -2], maxHeight: 80 },
      building: { type: 'offices', tier: 'mid', floors: 12 },
      theme: 'cyberpunk',
      apertures: [{
        id: 'tall-bridge', buildingId: 'p513', floor: 10, face: 1, kind: 'bridge',
        u: 10.5, base: 40, width: 5, height: 5, shape: 'rect',
        cut: { polygon: [[30, 40, 8], [30, 40, 13], [30, 45, 13], [30, 45, 8]], axisDir: [1, 0, 0] },
        linkId: 'L1',
      }],
    };
    const { blueprint } = await generate(req);
    const owner = blueprint.floors.find((f) => f.elevation === 40)!;
    expect(owner).toBeDefined();
    expect(owner.height).toBeGreaterThanOrEqual(5 - 1e-9);
    const opening = owner.openings.find((o) => o.id === 'tall-bridge')!;
    expect(opening.sill + opening.height).toBeLessThanOrEqual(owner.height + 1e-9);
  });

  it('rejects an aperture taller than the type max floor height, naming it', async () => {
    const req = {
      seed: 'urbe:p513', buildingId: 'p513',
      parcel: { footprint: [[0, 0], [30, 0], [30, 20], [0, 20]], accessPoint: [15, -2], maxHeight: 80 },
      building: { type: 'offices', tier: 'mid', floors: 12 },
      theme: 'cyberpunk',
      apertures: [{
        id: 'too-tall', buildingId: 'p513', floor: 10, face: 1, kind: 'bridge',
        u: 10.5, base: 40, width: 5, height: 6.5, shape: 'rect',
        cut: { polygon: [[30, 40, 8], [30, 40, 13], [30, 46.5, 13], [30, 46.5, 8]], axisDir: [1, 0, 0] },
        linkId: 'L1',
      }],
    };
    try {
      await generate(req);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ExteriorError).code).toBe('E_APERTURE_UNREACHABLE');
      expect((err as ExteriorError).message).toContain('6');
    }
  });

  it('keeps other openings clear of the aperture cuts', () => {
    const owner = bp.floors.find((f) => f.elevation === 24)!;
    for (const o of owner.openings) {
      if (o.edge !== 1 || o.id === 'ap-bridge-1') continue;
      const clear = o.offset + o.width <= 8.5 - 0.3 + 1e-6 || o.offset >= 11.5 + 0.3 - 1e-6;
      expect(clear).toBe(true);
    }
  });
});

describe('GLB shell', () => {
  it('parses as valid binary glTF with the contract node names and materials', async () => {
    const { glb, blueprint } = await generate(bridged, KEYS);
    const doc = await new NodeIO().readBinary(glb);
    const root = doc.getRoot();
    const nodeNames = root.listNodes().map((n) => n.getName());
    expect(nodeNames).toContain('floor:0/slab');
    expect(nodeNames).toContain('wall:0/0');
    expect(nodeNames).toContain('roof');
    expect(nodeNames).toContain('parapet');
    expect(nodeNames).toContain('aperture:ap-bridge-1');
    expect(nodeNames).toContain('anchor:ap-wire-4');
    const materialNames = root.listMaterials().map((m) => m.getName()).sort();
    expect(materialNames).toEqual(blueprint.materials);
    for (const name of materialNames) {
      expect(name).toMatch(/^cyberpunk\/[a-z-]+\/rich$/);
    }
  });

  it('glb:merged gives one mesh per material key, anchors kept, blueprint unchanged', async () => {
    const named = await generate(bridged, KEYS);
    const merged = await generate({ ...bridged, options: { glb: 'merged' } }, KEYS);
    expect(JSON.stringify(merged.blueprint)).toBe(JSON.stringify(named.blueprint));
    const doc = await new NodeIO().readBinary(merged.glb);
    const meshNodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
    expect(meshNodes.map((n) => n.getName()).sort()).toEqual(named.blueprint.materials.map((m) => `merged:${m}`));
    for (const n of meshNodes) expect(n.getMesh()!.listPrimitives().length).toBe(1);
    expect(doc.getRoot().listNodes().some((n) => n.getName() === 'anchor:ap-wire-4')).toBe(true);
    expect(merged.glb.byteLength).toBeLessThan(named.glb.byteLength);
  });

  it('faces every floor slab both ways so the shell never reads hollow from below', async () => {
    const { glb, blueprint } = await generate(residential, KEYS);
    const doc = await new NodeIO().readBinary(glb);
    for (const floor of blueprint.floors) {
      const node = doc.getRoot().listNodes().find((n) => n.getName() === `floor:${floor.index}/slab`)!;
      const normals = node.getMesh()!.listPrimitives()
        .flatMap((p) => [...(p.getAttribute('NORMAL')!.getArray() as Float32Array)]);
      const ys = new Set<number>();
      for (let i = 1; i < normals.length; i += 3) ys.add(Math.round(normals[i] as number));
      expect([...ys].sort(), `floor ${floor.index} slab`).toEqual([-1, 1]);
    }
  });

  it('gives every mesh a NORMAL attribute agreeing with its winding', async () => {
    for (const req of [residential, bridged]) {
      const { glb } = await generate(req, KEYS);
      const doc = await new NodeIO().readBinary(glb);
      const meshes = doc.getRoot().listMeshes();
      expect(meshes.length).toBeGreaterThan(0);
      for (const mesh of meshes) {
        for (const prim of mesh.listPrimitives()) {
          const normalAccessor = prim.getAttribute('NORMAL');
          expect(normalAccessor, `${mesh.getName()} has no NORMAL`).toBeTruthy();
          const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
          const nor = normalAccessor!.getArray() as Float32Array;
          expect(nor.length).toBe(pos.length);
          const idx = prim.getIndices()!.getArray() as Uint32Array;
          for (let i = 0; i + 2 < idx.length; i += 3) {
            const [a, b, c] = [idx[i]! * 3, idx[i + 1]! * 3, idx[i + 2]! * 3];
            const ab = [pos[b]! - pos[a]!, pos[b + 1]! - pos[a + 1]!, pos[b + 2]! - pos[a + 2]!];
            const ac = [pos[c]! - pos[a]!, pos[c + 1]! - pos[a + 1]!, pos[c + 2]! - pos[a + 2]!];
            const geo = [
              ab[1]! * ac[2]! - ab[2]! * ac[1]!,
              ab[2]! * ac[0]! - ab[0]! * ac[2]!,
              ab[0]! * ac[1]! - ab[1]! * ac[0]!,
            ];
            const len = Math.hypot(geo[0]!, geo[1]!, geo[2]!);
            if (len < 1e-9) continue; // degenerate sliver: normal is the +Y fallback
            const stored = [nor[a]!, nor[a + 1]!, nor[a + 2]!];
            expect(Math.hypot(stored[0]!, stored[1]!, stored[2]!)).toBeCloseTo(1, 4);
            const align = (geo[0]! * stored[0]! + geo[1]! * stored[1]! + geo[2]! * stored[2]!) / len;
            expect(align).toBeGreaterThan(0.99);
          }
        }
      }
    }
  });

  it('faces every ground wall triangle outward', async () => {
    const { glb, blueprint } = await generate(bridged, KEYS);
    const doc = await new NodeIO().readBinary(glb);
    const ground = blueprint.floors.find((f) => f.index === 0)!;
    for (let e = 0; e < ground.outline.length; e++) {
      const node = doc.getRoot().listNodes().find((n) => n.getName() === `wall:0/${e}`);
      expect(node).toBeDefined();
      const mesh = node!.getMesh()!;
      const [x1, z1] = ground.outline[e]!;
      const [x2, z2] = ground.outline[(e + 1) % ground.outline.length]!;
      const len = Math.hypot(x2 - x1, z2 - z1);
      // Outward = the horizontal direction that leaves the (convex) fixture footprint.
      const mid = [(x1 + x2) / 2, (z1 + z2) / 2];
      const cand: [number, number] = [-(z2 - z1) / len, (x2 - x1) / len];
      const inside = pointInPoly(ground.outline, [mid[0]! + cand[0] * 0.01, mid[1]! + cand[1] * 0.01]);
      const out = inside ? [-cand[0], -cand[1]] : cand;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
        const idx = prim.getIndices()!.getArray() as Uint32Array;
        for (let i = 0; i + 2 < idx.length; i += 3) {
          const [a, b, c] = [idx[i]! * 3, idx[i + 1]! * 3, idx[i + 2]! * 3];
          const ab = [pos[b]! - pos[a]!, pos[b + 1]! - pos[a + 1]!, pos[b + 2]! - pos[a + 2]!];
          const ac = [pos[c]! - pos[a]!, pos[c + 1]! - pos[a + 1]!, pos[c + 2]! - pos[a + 2]!];
          const nx = ab[1]! * ac[2]! - ab[2]! * ac[1]!;
          const nz = ab[0]! * ac[1]! - ab[1]! * ac[0]!;
          expect(nx * out[0]! + nz * out[1]!).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  });
});

describe('facade styles', () => {
  it('gives each tier its own style, with the panel grid published', async () => {
    const poor = (await generate(factory, KEYS)).blueprint;
    const mid = (await generate(residential, KEYS)).blueprint;
    const rich = (await generate(corpo, KEYS)).blueprint;
    expect(poor.facade.style).toBe('megablock');
    expect(mid.facade.style).toBe('panel');
    expect(rich.facade.style).toBe('glass');
    for (const bp of [poor, mid, rich]) expect(bp.facade.panelModule).toBeGreaterThan(0);
  });

  it('scatters small windows on the megablock panel grid and mounts utility boxes clear of them', async () => {
    const { blueprint } = await generate(factory, KEYS);
    const module = blueprint.facade.panelModule;
    const windows = blueprint.floors.flatMap((f: Floor) => f.openings.filter((o) => o.kind === 'window'));
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.width).toBeLessThanOrEqual(1); // small relative to the wall
      expect(w.height).toBeLessThanOrEqual(1.1);
    }
    // Semi-irregular: openings do not all share one offset inside their cell.
    const inCell = new Set(windows.map((w) => Math.round(((w.offset % module) + module) % module * 100)));
    expect(inCell.size).toBeGreaterThan(1);

    expect(blueprint.facadeArtifacts.length).toBeGreaterThan(0);
    for (const a of blueprint.facadeArtifacts) {
      const floor = blueprint.floors.find((f) => f.index === a.floor)!;
      for (const o of floor.openings.filter((o) => o.edge === a.edge)) {
        const clear = a.offset + a.size[0] <= o.offset || a.offset >= o.offset + o.width
          || a.sill + a.size[1] <= o.sill || a.sill >= o.sill + o.height;
        expect(clear, `utility box overlaps ${o.id}`).toBe(true);
      }
    }
  });

  it('leaves glass facades free of ribs and utility boxes', async () => {
    const { blueprint } = await generate(corpo, KEYS);
    expect(blueprint.facadeArtifacts).toHaveLength(0);
  });
});

describe('textured export', () => {
  it('defaults to a textured GLB with external map URIs against the materials base path', async () => {
    const { glb, textures } = await generate(residential, { textures: { baseUrl: '../materials/' } });
    expect(textures.mode).toBe('external');
    const json = glbJson(glb);
    expect(json.images.length).toBeGreaterThan(0);
    for (const image of json.images) {
      expect(image.uri).toMatch(/^\.\.\/materials\/themes\/cyberpunk\/assets\/.+\.png$/);
      expect(image.bufferView).toBeUndefined();
    }
    // Every material the building uses carries maps, not just a name.
    for (const material of json.materials) {
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(material.normalTexture).toBeDefined();
    }
  });

  it('scales tiled maps by their world size and leaves exact placements untransformed', async () => {
    const { glb } = await generate(residential);
    const json = glbJson(glb);
    const wall = json.materials.find((m: { name: string }) => m.name === 'cyberpunk/wall/mid');
    const transform = wall.pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform;
    expect(transform.scale).toEqual([1 / 3, 1 / 3]); // wall tiles cover 3 m
    const glass = json.materials.find((m: { name: string }) => m.name === 'cyberpunk/window-glass/mid');
    expect(glass.extensions.KHR_materials_transmission.transmissionFactor).toBeGreaterThan(0);
    expect(glass.extensions.KHR_materials_ior).toBeDefined();
  });

  it('--embed packs the maps into one self-contained GLB', async () => {
    const external = await generate(residential, { textures: { mode: 'external' } });
    const embedded = await generate(residential, { textures: { mode: 'embed' } });
    expect(embedded.textures.mode).toBe('embed');
    const json = glbJson(embedded.glb);
    for (const image of json.images) {
      expect(image.uri).toBeUndefined();
      expect(image.bufferView).toBeGreaterThanOrEqual(0);
    }
    expect(embedded.glb.byteLength).toBeGreaterThan(external.glb.byteLength);
    expect(JSON.stringify(embedded.blueprint)).toBe(JSON.stringify(external.blueprint));
  });

  it('keys mode keeps the untextured shell the engine runtime resolves itself', async () => {
    const { glb, blueprint, textures } = await generate(residential, KEYS);
    expect(textures.mode).toBe('keys');
    const json = glbJson(glb);
    expect(json.images).toBeUndefined();
    expect(json.materials.map((m: { name: string }) => m.name).sort()).toEqual(blueprint.materials);
  });

  it('degrades to keys with a reason when no materials database is there, and stays deterministic', async () => {
    const first = await generate(residential, { textures: { source: null } });
    const second = await generate(residential, { textures: { source: null } });
    expect(first.textures.mode).toBe('keys');
    expect(first.textures.reason).toContain('cyberpunk');
    expect(Buffer.from(first.glb).equals(Buffer.from(second.glb))).toBe(true);
  });

  it('names the key the theme cannot resolve', async () => {
    const source = { index: { theme: 'sparse', entries: {} }, readMap: () => null };
    try {
      await generate({ ...residential, theme: 'sparse' }, { textures: { source } });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as ExteriorError).code).toBe('E_MATERIAL_UNRESOLVED');
      expect((err as ExteriorError).message).toContain('sparse/');
    }
  });
});

describe('errors', () => {
  it('closed error set, each code reachable', async () => {
    expect(await code({})).toBe('E_SCHEMA');
    expect(await code({ ...residential, parcel: { ...(residential.parcel as object), footprint: [[0, 0], [10, 0], [0, 10], [10, 10]] } })).toBe('E_FOOTPRINT_INVALID');
    expect(await code({ ...residential, parcel: { ...(residential.parcel as object), footprint: [[0, 0], [3, 0], [3, 3], [0, 3]] } })).toBe('E_FOOTPRINT_TOO_SMALL');
    expect(await code({ ...residential, building: { type: 'residential', tier: 'mid', floors: 40 } })).toBe('E_ENVELOPE_TOO_LOW');
    expect(await code({ ...residential, building: { type: 'residential', tier: 'mid', floors: 6, floorKinds: ['lobby'] } })).toBe('E_FLOORKINDS_MISMATCH');

    const ap = (patch: object) => ({
      ...bridged,
      apertures: [{ ...(bridged.apertures as object[])[0] as object, ...patch }],
    });
    expect(await code(ap({ face: 9 }))).toBe('E_APERTURE_UNREACHABLE');
    expect(await code(ap({ cut: { polygon: [[29, 24, 8.5], [29, 24, 11.5], [29, 27, 11.5], [29, 27, 8.5]], axisDir: [1, 0, 0] } }))).toBe('E_APERTURE_INVALID');
    expect(await code({
      ...bridged,
      apertures: [
        (bridged.apertures as object[])[0],
        { ...(bridged.apertures as object[])[0] as object, id: 'ap-clone', linkId: 'L2' },
      ],
    })).toBe('E_APERTURE_OVERLAP');
    expect(await code({
      seed: 'tiny-shop', buildingId: 'p999',
      parcel: { footprint: [[0, 0], [6, 0], [6, 8], [0, 8]], accessPoint: [3, -1], maxHeight: 6 },
      building: { type: 'coffee_shop', tier: 'mid', floors: 1 },
      theme: 'cyberpunk',
      options: { signage: { mode: 'marquee', text: 'AN ABSURDLY LONG COFFEE MARQUEE TEXT!!!' } },
    })).toBe('E_SIGNAGE_TEXT_TOO_LONG');
  });
});

/** How far a building's window units reach out of and back into the wall plane. */
async function windowDepth(req: unknown): Promise<{ min: number; max: number }> {
  const { glb, blueprint } = await generate(req, KEYS);
  const doc = await new NodeIO().readBinary(glb);
  let min = Infinity, max = -Infinity;
  for (const floor of blueprint.floors) {
    for (const o of floor.openings) {
      if (o.kind !== 'window') continue;
      const [vx, vz] = floor.outline[o.edge]!;
      const next = floor.outline[(o.edge + 1) % floor.outline.length]!;
      const len = Math.hypot(next[0] - vx, next[1] - vz);
      const nx = -(next[1] - vz) / len, nz = (next[0] - vx) / len;
      const mid: [number, number] = [(vx + next[0]) / 2, (vz + next[1]) / 2];
      const sign = pointInPoly(floor.outline, [mid[0] + nx * 0.01, mid[1] + nz * 0.01]) ? -1 : 1;
      const node = doc.getRoot().listNodes().find((n) => n.getName() === `window:${o.id}`)!;
      for (const prim of node.getMesh()!.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
          const d = ((pos[i]! - vx) * nx + (pos[i + 2]! - vz) * nz) * sign;
          min = Math.min(min, d);
          max = Math.max(max, d);
        }
      }
      return { min, max };
    }
  }
  throw new Error('no window to measure');
}

function edgeLen(outline: [number, number][], e: number): number {
  const [x1, z1] = outline[e]!;
  const [x2, z2] = outline[(e + 1) % outline.length]!;
  return Math.hypot(x2 - x1, z2 - z1);
}

function pointInPoly(poly: [number, number][], p: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
