import { describe, expect, it } from 'vitest';
import {
  assembleFromPieces, buildPiece, KIT, KIT_FAMILIES, pieceSet, planAssembly, ExteriorError,
} from '../src/index.ts';
import { glbJson, keys } from './support.ts';

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

it('gives the same piece the same bytes for the same seed', async () => {
  const request = { family: 'faceted-bays', band: 'middle' as const, piece: 'bay' as const, seed: 'repeat' };
  const [first, second] = await Promise.all([buildPiece(request, textures), buildPiece(request, textures)]);
  expect(Buffer.from(second.glb).equals(Buffer.from(first.glb))).toBe(true);
  const other = await buildPiece({ ...request, band: 'crown' }, textures);
  expect(Buffer.from(other.glb).equals(Buffer.from(first.glb))).toBe(false);
});

it('fills an edge with two corner arms and one bay less than its bay count', () => {
  const plan = planAssembly({ family: 'mirror-frame', buildingId: 'p1', lot: { width: 56, depth: 24 }, floors: 5 });
  const ground = plan.placements.filter(p => p.floor === 0);
  expect(ground.filter(p => p.piece.endsWith('/corner'))).toHaveLength(4);
  // 56 m is seven bays: two 4 m arms and six bays. 24 m is three: two arms and two bays.
  expect(ground.filter(p => !p.piece.endsWith('/corner'))).toHaveLength(2 * (7 - 1) + 2 * (3 - 1));
  expect(ground.filter(p => p.piece.endsWith('/entrance-bay'))).toHaveLength(1);
  expect(plan.bands.map(b => b.band)).toEqual(['ground', 'middle', 'middle', 'middle', 'crown']);
});

it('refuses a lot that is not a whole number of bays', () => {
  expect(() => planAssembly({ family: 'mirror-frame', buildingId: 'p2', lot: { width: 30, depth: 24 }, floors: 4 }))
    .toThrow(new RegExp(`whole number of ${KIT.bay} m bays`));
  expect(() => planAssembly({ family: 'nowhere', buildingId: 'p3', lot: { width: 24, depth: 24 }, floors: 4 }))
    .toThrow(ExteriorError);
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
