// Contract tests: every declared input, output, and error of generate(),
// exercised through the public entry point against the shipped fixtures.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { generate, ExteriorError } from '../src/index.ts';
import type { Blueprint, Floor, Opening } from '../src/index.ts';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));

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
    const { glb, blueprint } = await generate(bridged);
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
    const named = await generate(bridged);
    const merged = await generate({ ...bridged, options: { glb: 'merged' } });
    expect(JSON.stringify(merged.blueprint)).toBe(JSON.stringify(named.blueprint));
    const doc = await new NodeIO().readBinary(merged.glb);
    const meshNodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
    expect(meshNodes.map((n) => n.getName()).sort()).toEqual(named.blueprint.materials.map((m) => `merged:${m}`));
    for (const n of meshNodes) expect(n.getMesh()!.listPrimitives().length).toBe(1);
    expect(doc.getRoot().listNodes().some((n) => n.getName() === 'anchor:ap-wire-4')).toBe(true);
    expect(merged.glb.byteLength).toBeLessThan(named.glb.byteLength);
  });

  it('faces every ground wall triangle outward', async () => {
    const { glb, blueprint } = await generate(bridged);
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
