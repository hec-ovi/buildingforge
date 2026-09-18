import { describe, expect, it } from 'vitest';
import {
  assembleFromPieces, KIT, KIT_FAMILIES, pieceSet, planAssembly, ExteriorError,
} from '../src/index.ts';
import { glbJson, keys } from './support.ts';
import { validateKitSchemas } from './kit-schema.ts';

const textures = keys.textures;

describe.each(KIT_FAMILIES)('%s piece set', family => {
  const set = pieceSet(family);
  const of = (band: string, piece: string) => set.find(m => m.band === band && m.piece === piece)!;

  it('tiles: every run boundary of a band presents one section, and bands stack on one more', () => {
    expect(set).toHaveLength(9);
    for (const band of ['ground', 'middle', 'crown']) {
      const runs = ['corner', 'bay', 'entrance-bay'].flatMap(piece => [of(band, piece).sections.start, of(band, piece).sections.end]);
      expect(new Set(runs).size).toBe(1);
    }
    for (const piece of ['corner', 'bay', 'entrance-bay']) {
      expect(new Set([
        of('ground', piece).sections.top, of('middle', piece).sections.bottom,
        of('middle', piece).sections.top, of('crown', piece).sections.bottom,
      ]).size).toBe(1);
    }
  });

  it('publishes sign anchors instead of baking signage', () => {
    const anchors = set.flatMap(piece => piece.signAnchors);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.size[0]).toBeGreaterThan(0);
      expect(Math.hypot(...anchor.facing)).toBeCloseTo(1, 6);
    }
    expect(set.flatMap(piece => piece.materials).some(slot => slot.includes('sign'))).toBe(false);
  });
});

it('publishes a valid JSON placement table with complete tiling and world space attachments', () => {
  const plans = [0, 1, 2, 3].map(entranceEdge => planAssembly({
    family: 'mirror-frame', buildingId: 'p1', lot: { width: 56, depth: 24 }, floors: 5, entranceEdge,
  }));
  const set = pieceSet('mirror-frame');
  for (const [face, plan] of plans.entries()) {
    const ground = plan.placements.filter(p => p.floor === 0);
    expect(ground.filter(p => p.bayIndex === null)).toHaveLength(4);
    expect(ground.filter(p => p.bayIndex !== null)).toHaveLength(2 * (7 - 1) + 2 * (3 - 1));
    expect(ground.filter(p => p.piece.endsWith('/entrance-bay'))).toHaveLength(1);
    expect(plan.bands.map(b => b.band)).toEqual(['ground', 'middle', 'middle', 'middle', 'crown']);
    expect(plan.doors).toHaveLength(1);
    expect(plan.signAnchors).toHaveLength(5);
    for (const placement of plan.placements) {
      expect(placement.family).toBe(plan.family);
      const along = placement.bayIndex === null ? 0 : KIT.cornerArm + placement.bayIndex * KIT.bay;
      const positions = [[along, 0], [56, along], [56 - along, 24], [0, 24 - along]];
      const [x, z] = positions[placement.face]!;
      expect(placement.position).toEqual([x, plan.bands[placement.floor]!.base, z]);
      expect(Math.cos(placement.rotationY)).toBeCloseTo([1, 0, -1, 0][placement.face]!, 8);
      expect(Math.sin(placement.rotationY)).toBeCloseTo([0, -1, 0, 1][placement.face]!, 8);
    }
    for (const record of [...plan.signAnchors, ...plan.doors]) {
      const placement = plan.placements[record.placement]!;
      expect(placement.face).toBe(face);
      const piece = set.find(p => p.id === placement.piece)!;
      const local = [...piece.signAnchors, ...piece.doors].find(r => r.id === record.id)!;
      const rotate = ([x, y, z]: number[]) => [[x!, y!, z!], [-z!, y!, x!], [-x!, y!, -z!], [z!, y!, -x!]][face]!;
      const offset = rotate(local.position), facing = rotate(local.facing);
      for (let axis = 0; axis < 3; axis++) {
        expect(record.position[axis]).toBeCloseTo(placement.position[axis]! + offset[axis]!, 8);
        expect(record.facing[axis]).toBeCloseTo(facing[axis]!, 8);
      }
    }
  }
  const invalid = JSON.parse(JSON.stringify(plans[0]));
  delete invalid.placements[0].rotationY;
  validateKitSchemas([...plans.map(value => ({ schema: 'placement' as const, value })),
    { schema: 'placement', value: invalid, valid: false }]);
});

it('refuses a lot that is not a whole number of bays', () => {
  expect(() => planAssembly({ family: 'mirror-frame', buildingId: 'p2', lot: { width: 30, depth: 24 }, floors: 4 }))
    .toThrow(new RegExp(`whole number of ${KIT.bay} m bays`));
  expect(() => planAssembly({ family: 'nowhere', buildingId: 'p3', lot: { width: 24, depth: 24 }, floors: 4 }))
    .toThrow(ExteriorError);
  const request = { family: 'mirror-frame', buildingId: 'p2', lot: { width: 24, depth: 24 }, floors: 4 };
  expect(() => planAssembly({ ...request, floors: 2 })).toThrow(RangeError);
  expect(() => planAssembly({ ...request, entranceEdge: 4 })).toThrow(ExteriorError);
  expect(() => planAssembly({ ...request, floorHeight: Infinity })).toThrow(ExteriorError);
});

it('assembles one mesh per piece and keeps the nodes a consumer addresses', async () => {
  const result = await assembleFromPieces({
    family: 'white-grid', buildingId: 'p4', lot: { width: 24, depth: 24 }, floors: 6,
    anchors: [{ id: 'bridge-a', edge: 1, u: 12, y: 18 }],
  }, textures);
  const json = glbJson(result.glb);
  const names: string[] = json.nodes.map((node: { name: string }) => node.name);
  expect(json.meshes.filter((mesh: { name: string }) => mesh.name.startsWith('piece:'))).toHaveLength(result.pieces.length);
  expect(result.placements.length).toBeGreaterThan(json.meshes.length);
  for (let floor = 0; floor < 6; floor++) expect(names).toContain(`floor:${floor}/slab`);
  expect(names).toContain('door:entry/frame');
  expect(names).toContain('door:entry/leaf:0');
  expect(names).toContain('anchor:bridge-a');
  expect(result.doors).toHaveLength(1);
  expect(result.signAnchors.length).toBeGreaterThan(0);
});
