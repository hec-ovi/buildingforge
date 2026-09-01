// Contract tests: every declared input, output, and error of generate(),
// exercised through the public entry point against the shipped fixtures.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { generate, ExteriorError, PROPORTIONS } from '../src/index.ts';
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

  it('signage takes one cell per letter, running as a marquee on a wide facade', async () => {
    const { glb, blueprint } = await generate(factory, KEYS);
    expect(blueprint.signage.length).toBe(1);
    const s = blueprint.signage[0]!;
    expect(s.mode).toBe('marquee');
    expect(s.orientation).toBe('horizontal');
    expect(s.text).toBe('NAKATOMI HEAVY INDUSTRIES');
    expect(s.letterHeight).toBeGreaterThan(0);
    expect(s.width).toBeCloseTo(s.text!.length * s.cellSize!, 6);

    // One glyph quad per non-blank letter, on top of the framed plate.
    const doc = await new NodeIO().readBinary(glb);
    const tris = doc.getRoot().listNodes().find((n) => n.getName() === 'signage:0')!
      .getMesh()!.listPrimitives().reduce((n, p) => n + p.getIndices()!.getCount() / 3, 0);
    const letters = [...s.text!].filter((c) => c.trim().length > 0).length;
    expect(tris).toBe(12 + letters * 2); // closed plate box (6 quads) + one quad per letter
  });

  it('closes the marquee with a back panel standing off the wall', async () => {
    const { glb, blueprint } = await generate(factory, KEYS);
    const s = blueprint.signage[0]!;
    expect(s.orientation).toBe('horizontal');
    const doc = await new NodeIO().readBinary(glb);
    const mesh = doc.getRoot().listNodes().find((n) => n.getName() === 'signage:0')!.getMesh()!;

    let backFacing = 0;
    let minDepth = Infinity;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
      const idx = prim.getIndices()!.getArray() as Uint32Array;
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const [a, b, c] = [idx[i]! * 3, idx[i + 1]! * 3, idx[i + 2]! * 3];
        const ab = [pos[b]! - pos[a]!, pos[b + 1]! - pos[a + 1]!, pos[b + 2]! - pos[a + 2]!];
        const ac = [pos[c]! - pos[a]!, pos[c + 1]! - pos[a + 1]!, pos[c + 2]! - pos[a + 2]!];
        const nx = ab[1]! * ac[2]! - ab[2]! * ac[1]!;
        const nz = ab[0]! * ac[1]! - ab[1]! * ac[0]!;
        if (nx * s.normal[0] + nz * s.normal[1] < -1e-9) backFacing++;
        for (const v of [a, b, c]) {
          minDepth = Math.min(minDepth, (pos[v]! - s.center[0]) * s.normal[0] + (pos[v + 2]! - s.center[2]) * s.normal[1]);
        }
      }
    }
    // A solid back: nothing behind the plate can read through it, mirrored or not.
    expect(backFacing).toBeGreaterThan(0);
    // And it stands off the wall face instead of sharing its plane.
    expect(minDepth).toBeGreaterThan(0.005);
  });

  it('each glyph cell picks its character out of the letter atlas', async () => {
    // Grid ../materials publishes for cyberpunk/letter-atlas/<tier>: 8 x 6, row-major.
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+ ";
    const cellRect = (char: string): [number, number, number, number] => {
      const i = charset.indexOf(char);
      const col = i % 8;
      const row = Math.floor(i / 8);
      return [col / 8, row / 6, (col + 1) / 8, (row + 1) / 6];
    };

    const { glb, blueprint } = await generate(factory, KEYS);
    const key = 'cyberpunk/letter-atlas/poor';
    expect(blueprint.materials).toContain(key);
    const letters = [...blueprint.signage[0]!.text!].filter((c) => c !== ' ');

    const doc = await new NodeIO().readBinary(glb);
    const cells = doc.getRoot().listNodes().find((n) => n.getName() === 'signage:0')!
      .getMesh()!.listPrimitives().find((p) => p.getMaterial()!.getName() === key)!;
    const uv = cells.getAttribute('TEXCOORD_0')!;
    const pos = cells.getAttribute('POSITION')!;
    expect(uv.getCount()).toBe(letters.length * 4);

    for (let q = 0; q < letters.length; q++) {
      const us: number[] = [];
      const vs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < 4; k++) {
        const [u, v] = uv.getElement(q * 4 + k, [0, 0]) as [number, number];
        us.push(u);
        vs.push(v);
        ys.push((pos.getElement(q * 4 + k, [0, 0, 0]) as number[])[1]!);
      }
      const [u0, v0, u1, v1] = cellRect(letters[q] as string);
      expect(Math.min(...us)).toBeCloseTo(u0, 6);
      expect(Math.min(...vs)).toBeCloseTo(v0, 6);
      expect(Math.max(...us)).toBeCloseTo(u1, 6);
      expect(Math.max(...vs)).toBeCloseTo(v1, 6);
      // glTF V runs down the image, so the bottom of the quad carries the cell's larger V.
      expect(vs[ys.indexOf(Math.min(...ys))]).toBeCloseTo(v1, 6);
    }
  });

  it('stacks the same text into a protruding blade sign on a narrow facade', async () => {
    const request = {
      seed: 'urbe-hotel-1', buildingId: 'p700',
      parcel: { footprint: [[0, 0], [14, 0], [14, 22], [0, 22]], accessPoint: [7, -2], maxHeight: 40 },
      building: { type: 'hotel', tier: 'mid', floors: 10 },
      theme: 'cyberpunk',
      options: { signage: { mode: 'marquee', text: 'HOTEL' } },
    };
    const { blueprint } = await generate(request, KEYS);
    const s = blueprint.signage[0]!;
    expect(s.orientation).toBe('vertical');
    expect(s.height).toBeCloseTo(s.text!.length * s.cellSize! + 0.24, 1); // cells plus the frame border
    expect(s.depth).toBeGreaterThan(0.5); // protrudes edge-on from the facade
    expect(s.width).toBeLessThan(0.4); // a thin blade, not a panel on the wall
    // Deterministic: the same request keeps the same sign.
    expect(JSON.stringify((await generate(request, KEYS)).blueprint.signage)).toBe(JSON.stringify(blueprint.signage));
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

  it('gives every entrance its family row, 2.4 to 6 m tall by family and at least 2.6 m wide', async () => {
    // 6 residential floors in 16 m: every storey at the 2.6 m minimum except the
    // ground, which keeps the room for its row's 2.4 m door.
    const squeezed = { ...residential, seed: 'urbe-res-squeezed', parcel: { ...(residential.parcel as object), maxHeight: 16 } };
    const cases: [Record<string, unknown>, keyof typeof PROPORTIONS.families][] = [
      [residential, 'residential'], [corpo, 'corpo'], [factory, 'industrial'], [sliver, 'office'], [squeezed, 'residential'],
    ];
    for (const [req, family] of cases) {
      const { blueprint } = await generate(req, KEYS);
      const ground = blueprint.floors.find((f) => f.index === 0)!;
      const door = ground.openings.find((o) => o.id === 'entrance')!;
      const row = PROPORTIONS.families[family];
      const clear = ground.height - PROPORTIONS.clearHeightAllowance;
      expect(door.height).toBeGreaterThanOrEqual(row.entrance[0] - 1e-6);
      expect(door.height).toBeLessThanOrEqual(Math.min(row.entrance[1], clear) + 1e-6);
      expect(door.height).toBeGreaterThanOrEqual(PROPORTIONS.entranceRange[0] - 1e-6);
      expect(door.height).toBeLessThanOrEqual(PROPORTIONS.entranceRange[1] + 1e-6);
      expect(door.width).toBeGreaterThanOrEqual(PROPORTIONS.entranceWidth.standard[0] - 1e-6);
      expect(door.width).toBeLessThanOrEqual(PROPORTIONS.entranceWidth.grand[1] + 1e-6);
    }
  });

  it('glazes a venue or lobby ground floor from a low sill to the head band, the megablock included', async () => {
    for (const [type, tier] of [['restaurant', 'mid'], ['commerce', 'poor'], ['hotel', 'rich']] as const) {
      const req = { ...residential, seed: `store-${type}-${tier}`, building: { type, tier, floors: 4 } };
      const { blueprint } = await generate(req, KEYS);
      const ground = blueprint.floors.find((f) => f.index === 0)!;
      const clear = ground.height - PROPORTIONS.clearHeightAllowance;
      const glass = ground.openings.filter((o) => o.kind === 'window');
      expect(glass.length, `${type} ${tier}`).toBeGreaterThan(0);
      for (const o of glass) {
        expect(o.sill).toBeLessThanOrEqual(PROPORTIONS.storefront.sill[1] + 1e-6);
        expect(o.sill + o.height).toBeGreaterThanOrEqual(clear - 0.051);
        expect(o.sill + o.height).toBeLessThanOrEqual(clear + 1e-6);
      }
    }
  });

  it('sizes punched windows by the published share of the floor clear height', async () => {
    const cases: [string, keyof typeof PROPORTIONS.families][] = [
      ['residential', 'residential'], ['clinic', 'hospital'], ['commerce', 'commerce'],
    ];
    for (const [type, family] of cases) {
      const req = { ...residential, building: { ...(residential.building as object), type }, seed: `prop-${type}` };
      const { blueprint } = await generate(req, KEYS);
      const row = PROPORTIONS.families[family];
      const windows = blueprint.floors
        .filter((f) => f.index > 0)
        .flatMap((f) => f.openings.filter((o) => o.kind === 'window').map((o) => ({ o, f })));
      expect(windows.length).toBeGreaterThan(0);
      for (const { o, f } of windows) {
        const clear = f.height - PROPORTIONS.clearHeightAllowance;
        expect(o.height / clear).toBeGreaterThanOrEqual(row.windowHeight[0] - 0.02);
        expect(o.sill).toBeGreaterThanOrEqual(row.sill[0] - 0.051);
        expect(o.sill).toBeLessThanOrEqual(row.sill[1] + 0.051);
        expect(o.sill + o.height).toBeLessThanOrEqual(clear + 1e-6);
      }
    }
  });

  it('caps the entrance on a pinned ground floor without breaking its own range (p14 class)', async () => {
    // A bridge pinned at 2.65 m holds the ground floor under the room its row's
    // 2.4 m entrance needs, so the door takes what the floor holds.
    const request = {
      seed: 'urbe-small:p14', buildingId: 'p14',
      parcel: { footprint: [[0, 0], [36, 0], [36, 9], [0, 9]], accessPoint: [18, -1], maxHeight: 22.2 },
      building: { type: 'residential', tier: 'high_rich', floors: 6 },
      theme: 'cyberpunk',
      apertures: [{
        id: 'l14a', buildingId: 'p14', floor: 1, face: 0, kind: 'bridge',
        u: 11.5, base: 2.65, width: 3, height: 2.2, shape: 'rect',
        cut: { polygon: [[10, 2.65, 0], [13, 2.65, 0], [13, 4.85, 0], [10, 4.85, 0]], axisDir: [0, 0, -1] },
        linkId: 'L14a',
      }],
    };
    const { blueprint } = await generate(request, KEYS);
    const ground = blueprint.floors.find((f) => f.index === 0)!;
    const door = ground.openings.find((o) => o.id === 'entrance')!;
    const clear = ground.height - PROPORTIONS.clearHeightAllowance;
    expect(clear).toBeLessThan(PROPORTIONS.families.residential.entrance[0]);
    expect(door.height).toBeLessThanOrEqual(clear + 1e-9);
    // Still the tallest 0.05 step the floor can carry, not an arbitrary stump.
    expect(door.height).toBeGreaterThan(clear - 0.05);
  });

  it('gives every opening its own run of an edge, doors and apertures included', async () => {
    for (const req of [residential, corpo, factory, bridged, sliver]) {
      const { blueprint } = await generate(req, KEYS);
      for (const floor of blueprint.floors) {
        const byEdge = new Map<number, Opening[]>();
        for (const o of floor.openings) {
          const list = byEdge.get(o.edge) ?? [];
          list.push(o);
          byEdge.set(o.edge, list);
        }
        for (const [edge, list] of byEdge) {
          const sorted = [...list].sort((a, b) => a.offset - b.offset);
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1]!, cur = sorted[i]!;
            expect(cur.offset, `${prev.id} and ${cur.id} share edge ${edge} on floor ${floor.index}`)
              .toBeGreaterThanOrEqual(prev.offset + prev.width - 1e-6);
          }
        }
      }
    }
  });

  it('keeps the small deep window on the poor tier alone', async () => {
    const poor = (await generate(factory, KEYS)).blueprint;
    expect(poor.facade.style).toBe('megablock');
    const small = poor.floors.flatMap((f) => f.openings.filter((o) => o.kind === 'window'));
    expect(small.length).toBeGreaterThan(0);
    expect(Math.max(...small.map((w) => w.height))).toBeLessThanOrEqual(PROPORTIONS.megablock.windowHeight[1]);

    // The same parcel one tier up drops the scatter and takes the family's share.
    const mid = (await generate({ ...factory, building: { ...(factory.building as object), tier: 'mid' } }, KEYS)).blueprint;
    expect(mid.facade.style).not.toBe('megablock');
    const big = mid.floors.flatMap((f) => f.openings.filter((o) => o.kind === 'window'));
    expect(Math.min(...big.map((w) => w.height))).toBeGreaterThan(PROPORTIONS.megablock.windowHeight[1]);
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
    // Everything merges by material except what the game addresses by node:
    // door leaves keep their own node so they can still swing, wire anchors so
    // the attach point can be read.
    const leaves = meshNodes.filter((n) => n.getName().includes('/leaf:'));
    expect(leaves.length).toBeGreaterThan(0);
    const bulk = meshNodes.filter((n) => !n.getName().includes('/leaf:') && !n.getName().startsWith('anchor:'));
    for (const n of bulk) expect(n.getMesh()!.listPrimitives().length).toBe(1);
    // One bulk mesh per material, and between bulk and leaves every published key is there.
    const used = new Set<string>();
    for (const n of meshNodes) for (const p of n.getMesh()!.listPrimitives()) used.add(p.getMaterial()!.getName());
    expect([...used].sort()).toEqual(named.blueprint.materials);
    for (const n of bulk) expect(named.blueprint.materials).toContain(n.getName().replace('merged:', ''));
    expect(doc.getRoot().listNodes().some((n) => n.getName() === 'anchor:ap-wire-4')).toBe(true);
    expect(merged.glb.byteLength).toBeLessThan(named.glb.byteLength);
  });

  it('mounts a wire anchor as a small plate on its node, the curtain wall glazed straight across it', async () => {
    const { glb, blueprint } = await generate(bridged, KEYS);
    expect(blueprint.facade.style).toBe('curtain-wall');
    const anchor = blueprint.anchors.find((a) => a.id === 'ap-wire-4')!;
    // ap-wire-4 cuts face 1 (x = 30) at z 15.75..16.25, y 30..30.5: every band it
    // touches keeps one bay running over it, so the mullion grid stays whole.
    for (const f of blueprint.floors.filter((fl) => fl.elevation < 30.5 && fl.elevation + fl.height > 30)) {
      const bay = f.openings.find((o) => o.edge === 1 && o.kind === 'window' && o.offset <= 15.75 && o.offset + o.width >= 16.25);
      expect(bay, `floor ${f.index} glazing over the anchor`).toBeDefined();
    }
    const doc = await new NodeIO().readBinary(glb);
    const node = doc.getRoot().listNodes().find((n) => n.getName() === 'anchor:ap-wire-4')!;
    node.getTranslation().forEach((v, i) => expect(v).toBeCloseTo(anchor.position[i]!, 6));
    const prims = node.getMesh()!.listPrimitives();
    expect(prims.map((p) => p.getMaterial()!.getName())).toEqual(['cyberpunk/window-frame/rich']);
    // Tens of centimetres around the attach point, standing on the face, never inside the building.
    const n = [anchor.normal[0], 0, anchor.normal[1]];
    const pos = prims[0]!.getAttribute('POSITION')!;
    const v = [0, 0, 0];
    let reach = 0, out = 0, inward = 0;
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      reach = Math.max(reach, Math.abs(v[0]!), Math.abs(v[1]!), Math.abs(v[2]!));
      const proud = v[0]! * n[0]! + v[1]! * n[1]! + v[2]! * n[2]!;
      out = Math.max(out, proud);
      inward = Math.min(inward, proud);
    }
    expect(reach).toBeLessThanOrEqual(0.3 + 1e-6);
    expect(out).toBeLessThanOrEqual(0.3);
    expect(inward).toBeGreaterThanOrEqual(-1e-6);
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

  it('builds every wall band as real surface, no degenerate quads', async () => {
    for (const req of [residential, corpo, factory, bridged]) {
      const { glb, blueprint } = await generate(req, KEYS);
      const doc = await new NodeIO().readBinary(glb);
      for (const floor of blueprint.floors) {
        for (let e = 0; e < floor.outline.length; e++) {
          const node = doc.getRoot().listNodes().find((n) => n.getName() === `wall:${floor.index}/${e}`)!;
          let area = 0;
          for (const prim of node.getMesh()!.listPrimitives()) {
            const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
            const idx = prim.getIndices()!.getArray() as Uint32Array;
            for (let i = 0; i + 2 < idx.length; i += 3) {
              const p = [0, 1, 2].map((k) => [pos[idx[i + k]! * 3]!, pos[idx[i + k]! * 3 + 1]!, pos[idx[i + k]! * 3 + 2]!]);
              const ab = [p[1]![0]! - p[0]![0]!, p[1]![1]! - p[0]![1]!, p[1]![2]! - p[0]![2]!];
              const ac = [p[2]![0]! - p[0]![0]!, p[2]![1]! - p[0]![1]!, p[2]![2]! - p[0]![2]!];
              area += Math.hypot(
                ab[1]! * ac[2]! - ab[2]! * ac[1]!,
                ab[2]! * ac[0]! - ab[0]! * ac[2]!,
                ab[0]! * ac[1]! - ab[1]! * ac[0]!,
              ) / 2;
            }
          }
          // The band minus the openings cut out of it.
          const holes = floor.openings
            .filter((o) => o.edge === e)
            .reduce((sum, o) => sum + o.width * o.height, 0);
          const band = edgeLen(floor.outline, e) * floor.height;
          expect(area, `wall:${floor.index}/${e}`).toBeGreaterThan(band - holes - 0.5);
        }
      }
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

  it('makes every door leaf one node subtree, glass included, hinged on its own pivot', async () => {
    for (const req of [residential, corpo, factory]) {
      const { glb, blueprint } = await generate(req, KEYS);
      const doc = await new NodeIO().readBinary(glb);
      const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));

      const doors = blueprint.floors.flatMap((f) => f.openings
        .filter((o) => o.kind === 'door' || o.kind === 'balconyDoor')
        .map((o) => ({ o, f })));
      expect(doors.length).toBeGreaterThan(0);

      for (const { o, f } of doors) {
        const base = o.kind === 'door' ? `door:${o.id}` : `balcony:${o.id}`;
        const node = byName.get(base)!;
        expect(node, `${base} node`).toBeDefined();
        expect(byName.get(`${base}/frame`)).toBeDefined();
        expect(o.leaves).toBeGreaterThanOrEqual(1);

        const children = node.listChildren().map((c) => c.getName());
        for (let i = 0; i < o.leaves!; i++) expect(children).toContain(`${base}/leaf:${i}`);

        for (let i = 0; i < o.leaves!; i++) {
          const leaf = byName.get(`${base}/leaf:${i}`)!;
          // The hinge is the node's own origin, at the floor, so a rotation swings it.
          const [, py] = leaf.getTranslation();
          expect(py).toBeCloseTo(f.elevation + o.sill, 6);
          const kinds = new Set(leaf.getMesh()!.listPrimitives()
            .map((p) => p.getMaterial()!.getName().split('/')[1]));
          // Everything that swings is in this one subtree, the glass with it.
          if ((o.material ?? '').includes('door-glass')) expect(kinds).toContain('door-glass');
          expect([...kinds].every((k) => k === 'door' || k === 'door-glass')).toBe(true);
        }
      }
    }
  });

  it('builds the door casing from members that never share a plane', async () => {
    const { glb, blueprint } = await generate(residential, KEYS);
    const doc = await new NodeIO().readBinary(glb);
    const doorIds = blueprint.floors.flatMap((f) => f.openings
      .filter((o) => o.kind === 'door').map((o) => `door:${o.id}/frame`));
    expect(doorIds.length).toBeGreaterThan(0);

    for (const name of doorIds) {
      const mesh = doc.getRoot().listNodes().find((n) => n.getName() === name)!.getMesh()!;
      const tris: [number, number, number][][] = [];
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
        const idx = prim.getIndices()!.getArray() as Uint32Array;
        for (let i = 0; i + 2 < idx.length; i += 3) {
          tris.push([0, 1, 2].map((k) => {
            const b = idx[i + k]! * 3;
            return [pos[b]!, pos[b + 1]!, pos[b + 2]!] as [number, number, number];
          }));
        }
      }
      for (let i = 0; i < tris.length; i++) {
        for (let j = i + 1; j < tris.length; j++) {
          expect(coplanarOverlap(tris[i]!, tris[j]!), `${name} triangles ${i} and ${j} share a plane`).toBe(false);
        }
      }
    }
  });
});

describe('facade styles', () => {
  it('gives each tier its own style, with the panel grid published', async () => {
    const poor = (await generate(factory, KEYS)).blueprint;
    const mid = (await generate(residential, KEYS)).blueprint;
    const richHotel = { ...residential, seed: 'style-rich', building: { ...(residential.building as object), type: 'hotel', tier: 'rich' } };
    const rich = (await generate(richHotel, KEYS)).blueprint;
    const tower = (await generate(corpo, KEYS)).blueprint;
    expect(poor.facade.style).toBe('megablock');
    expect(mid.facade.style).toBe('panel');
    expect(rich.facade.style).toBe('glass');
    expect(tower.facade.style).toBe('curtain-wall');
    for (const bp of [poor, mid, rich, tower]) expect(bp.facade.panelModule).toBeGreaterThan(0);
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

  it('glazes a curtain-wall face slab to slab, spandrel at every floor line, mullions across', async () => {
    const { glb, blueprint } = await generate(corpo, KEYS);
    expect(blueprint.facade.style).toBe('curtain-wall');
    const doc = await new NodeIO().readBinary(glb);

    for (const floor of blueprint.floors.filter((f) => f.index > 0)) {
      const bays = floor.openings.filter((o) => o.kind === 'window');
      expect(bays.length).toBeGreaterThan(0);
      const glazed = new Map<number, number>();
      for (const b of bays) {
        // Every bay hangs slab to slab, its spandrel covering the floor line.
        expect(b.sill + b.height).toBeCloseTo(floor.height, 6);
        expect(b.spandrel).toBeGreaterThan(0);
        expect(b.panes!.cols).toBeGreaterThan(1);
        glazed.set(b.edge, (glazed.get(b.edge) ?? 0) + b.width);

        // The vision glass really starts above the spandrel band.
        const node = doc.getRoot().listNodes().find((n) => n.getName() === `window:${b.id}`)!;
        const glass = node.getMesh()!.listPrimitives()
          .find((p) => p.getMaterial()!.getName().includes('window-glass'))!;
        const pos = glass.getAttribute('POSITION')!.getArray() as Float32Array;
        let lowest = Infinity;
        for (let i = 1; i < pos.length; i += 3) lowest = Math.min(lowest, pos[i]!);
        expect(lowest).toBeGreaterThanOrEqual(floor.elevation + b.sill + b.spandrel! - 1e-6);
      }
      // The skin runs corner to corner, not as scattered punched holes.
      for (const [edge, width] of glazed) {
        expect(width / edgeLen(floor.outline, edge)).toBeGreaterThan(0.9);
      }
    }
  });

  it('runs the curtain wall over the entrance as that door transom light', async () => {
    const { blueprint } = await generate(corpo, KEYS);
    const ground = blueprint.floors.find((f) => f.index === 0)!;
    const entrance = ground.openings.find((o) => o.id === 'entrance')!;
    // The glazing above the head belongs to the door: one opening owns the run.
    expect(entrance.transom, 'glazing continues above the door').toBeGreaterThan(0);
    expect(entrance.sill + entrance.height + 0.15 + entrance.transom!).toBeCloseTo(ground.height, 6);
    for (const o of ground.openings) {
      if (o === entrance || o.edge !== entrance.edge) continue;
      const apart = o.offset >= entrance.offset + entrance.width || o.offset + o.width <= entrance.offset;
      expect(apart, `${o.id} shares the entrance run`).toBe(true);
    }
  });

  it('lands every sign and screen on clear wall, or proud of the relief it crosses', async () => {
    const cases = [
      factory,
      corpo,
      { ...residential, seed: 'sign-scan', options: { signage: { mode: 'marquee', text: 'KIRINO' } } },
      { ...factory, seed: 'sign-scan-2', options: { signage: { mode: 'logo', ratio: '3:2' }, adScreens: 'on' } },
    ];
    for (const req of cases) {
      const { blueprint } = await generate(req, KEYS);
      const ground = blueprint.floors.find((f) => f.index === 0)!;
      const overlays = [
        ...blueprint.signage.map((s) => ({ ...s, what: 'signage' })),
        ...blueprint.screens.map((s) => ({ ...s, what: 'screen' })),
      ];
      expect(overlays.length).toBeGreaterThan(0);

      for (const o of overlays) {
        const u = uOnEdge(ground.outline, o.edge, o.center[0], o.center[2]);
        const box = { u0: u - o.width / 2, u1: u + o.width / 2, y0: o.center[1] - o.height / 2, y1: o.center[1] + o.height / 2 };
        // Never over a door, a balcony door or an aperture; glazing may be
        // crossed only by a plate standing proud of it.
        for (const floor of blueprint.floors) {
          for (const op of floor.openings) {
            if (op.edge !== o.edge) continue;
            const hits = box.u0 < op.offset + op.width && box.u1 > op.offset
              && box.y0 < floor.elevation + op.sill + op.height && box.y1 > floor.elevation + op.sill;
            if (!hits) continue;
            expect(op.kind, `${o.what} covers ${op.id}`).toBe('window');
            expect(o.standoff, `${o.what} sinks into ${op.id}`).toBeGreaterThan(0);
          }
        }
        // Where it crosses a floor band, it stands further off the wall than the band.
        const band = blueprint.facade.style === 'megablock' || blueprint.facade.style === 'panel';
        if (band) {
          const crossesBand = blueprint.floors.some((f) => f.index > 0
            && box.y0 < f.elevation + 0.2 && box.y1 > f.elevation - 0.2);
          if (crossesBand) expect(o.standoff).toBeGreaterThan(0);
        }
        expect(o.standoff).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('leaves glass facades free of ribs and utility boxes', async () => {
    const { blueprint } = await generate(corpo, KEYS);
    expect(blueprint.facadeArtifacts).toHaveLength(0);
  });
});

describe('roof access', () => {
  it('cuts the stair-head bulkhead out of the roof plane and publishes it', async () => {
    for (const req of [residential, corpo, factory, bridged]) {
      const { glb, blueprint } = await generate(req, KEYS);
      const b = blueprint.roof.bulkhead!;
      expect(b, 'every fixture roof is big enough for access').toBeTruthy();
      expect(Math.hypot(b.axis[0], b.axis[1])).toBeCloseTo(1, 6);
      expect(pointInPoly(blueprint.roof.outline, b.center)).toBe(true);

      // The roof plane really is open there: no roof triangle covers the cutout centre.
      const doc = await new NodeIO().readBinary(glb);
      const roof = doc.getRoot().listNodes().find((n) => n.getName() === 'roof')!;
      for (const prim of roof.getMesh()!.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')!.getArray() as Float32Array;
        const idx = prim.getIndices()!.getArray() as Uint32Array;
        for (let i = 0; i + 2 < idx.length; i += 3) {
          const tri = [0, 1, 2].map((k) => [pos[idx[i + k]! * 3]!, pos[idx[i + k]! * 3 + 2]!] as [number, number]);
          expect(pointInPoly(tri, b.center), 'roof still covers the cutout').toBe(false);
        }
      }
      expect(doc.getRoot().listNodes().some((n) => n.getName() === 'bulkhead')).toBe(true);
    }
  });

  it('keeps roof artifacts clear of the bulkhead and its walk space', async () => {
    for (const req of [residential, corpo, factory, bridged]) {
      const { blueprint } = await generate(req, KEYS);
      const b = blueprint.roof.bulkhead!;
      const cross: [number, number] = [-b.axis[1], b.axis[0]];
      const halfX = Math.abs(b.axis[0]) * b.width / 2 + Math.abs(cross[0]) * b.depth / 2;
      const halfZ = Math.abs(b.axis[1]) * b.width / 2 + Math.abs(cross[1]) * b.depth / 2;
      for (const a of blueprint.roof.artifacts) {
        const [w, d] = a.rotationDeg === 90 ? [a.size[1], a.size[0]] : [a.size[0], a.size[1]];
        const clearX = Math.abs(a.center[0] - b.center[0]) >= halfX + w / 2;
        const clearZ = Math.abs(a.center[1] - b.center[1]) >= halfZ + d / 2;
        expect(clearX || clearZ, `${a.kind} sits on the bulkhead`).toBe(true);
      }
      expect(blueprint.roof.artifacts.some((a) => a.kind === 'bulkhead')).toBe(false);
    }
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

/**
 * Do two triangles sit on the same plane, face the same way and overlap there?
 * That is the pair a renderer z-fights on; touching edges are not one.
 */
function coplanarOverlap(A: [number, number, number][], B: [number, number, number][]): boolean {
  const planeOf = (t: [number, number, number][]) => {
    const a = t[0]!, b = t[1]!, c = t[2]!;
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (len < 1e-9) return null;
    const unit = [n[0]! / len, n[1]! / len, n[2]! / len];
    return { n: unit, d: unit[0]! * a[0]! + unit[1]! * a[1]! + unit[2]! * a[2]! };
  };
  const pa = planeOf(A), pb = planeOf(B);
  if (!pa || !pb) return false;
  const dot = pa.n[0]! * pb.n[0]! + pa.n[1]! * pb.n[1]! + pa.n[2]! * pb.n[2]!;
  if (dot < 0.999 || Math.abs(pa.d - pb.d) > 1e-4) return false; // different plane or facing away

  // Flatten both onto the shared plane and run a separating-axis test with slack.
  const ref = Math.abs(pa.n[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1raw = [pa.n[1]! * ref[2]! - pa.n[2]! * ref[1]!, pa.n[2]! * ref[0]! - pa.n[0]! * ref[2]!, pa.n[0]! * ref[1]! - pa.n[1]! * ref[0]!];
  const l1 = Math.hypot(e1raw[0]!, e1raw[1]!, e1raw[2]!);
  const e1 = [e1raw[0]! / l1, e1raw[1]! / l1, e1raw[2]! / l1];
  const e2 = [pa.n[1]! * e1[2]! - pa.n[2]! * e1[1]!, pa.n[2]! * e1[0]! - pa.n[0]! * e1[2]!, pa.n[0]! * e1[1]! - pa.n[1]! * e1[0]!];
  const flat = (t: [number, number, number][]) =>
    t.map((p) => [p[0] * e1[0]! + p[1] * e1[1]! + p[2] * e1[2]!, p[0] * e2[0]! + p[1] * e2[1]! + p[2] * e2[2]!] as [number, number]);
  const P = flat(A), Q = flat(B);
  for (const [X, Y] of [[P, Q], [Q, P]] as [typeof P, typeof Q][]) {
    for (let i = 0; i < 3; i++) {
      const p = X[i]!, q = X[(i + 1) % 3]!;
      const ax = -(q[1] - p[1]), ay = q[0] - p[0];
      const len = Math.hypot(ax, ay) || 1;
      const proj = (S: [number, number][]) => S.map((v) => (v[0] * ax + v[1] * ay) / len);
      const px = proj(X), qx = proj(Y);
      if (Math.min(...qx) > Math.max(...px) - 0.005 || Math.min(...px) > Math.max(...qx) - 0.005) return false;
    }
  }
  return true;
}

/** u of a world point along an outline edge. */
function uOnEdge(outline: [number, number][], edge: number, x: number, z: number): number {
  const [vx, vz] = outline[edge]!;
  const [nx, nz] = outline[(edge + 1) % outline.length]!;
  const len = Math.hypot(nx - vx, nz - vz) || 1;
  return ((x - vx) * (nx - vx) + (z - vz) * (nz - vz)) / len;
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
