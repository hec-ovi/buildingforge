import { expect, it } from 'vitest';
import { Ray, Vector3 } from 'three';
import { meshPocketDoorLining } from '../src/mesh/pocketDoor.ts';
import { MeshBuilder } from '../src/mesh/primitives.ts';
import type { Floor, Opening } from '../src/types.ts';
import { generate } from '../src/index.ts';
import { glbJson, keys } from './support.ts';

const opening: Opening = {
  id: 'entrance', kind: 'door', edge: 0, offset: 20.5, width: 3, height: 3, sill: 0, leaves: 2,
  door: {
    set: 'layered', frameWidth: .259, frameDepth: .07, recessDepth: .16, thresholdHeight: 0,
    motion: { kind: 'pocket', maxTravel: 1.55, clearDepth: 0, leaves: [
      { leaf: 0, travelU: -1.55, pocket: { offset: 18.922, sill: .002, width: 1.578, height: 3.026, frontDepth: .127, backDepth: .223 } },
      { leaf: 1, travelU: 1.55, pocket: { offset: 23.5, sill: .002, width: 1.578, height: 3.026, frontDepth: .127, backDepth: .223 } },
    ] },
    clearance: { offset: 20.5, sill: 0, width: 3, height: 3, backDepth: .258 },
    cassette: { offset: 18.887, sill: 0, width: 6.226, height: 3.259, backDepth: .258 },
  },
};
const floor: Floor = { index: 0, kind: 'lobby', elevation: 0, height: 4.5,
  outline: [[0, 0], [36, 0], [36, 36], [0, 36]], openings: [opening] };

function hits(mesh: MeshBuilder, origin: Vector3, direction: Vector3): Vector3[] {
  const ray = new Ray(origin, direction.normalize()), out: Vector3[] = [];
  for (const part of mesh.parts) for (const prim of part.prims.values()) {
    for (let i = 0; i < prim.indices.length; i += 3) {
      const points = [0, 1, 2].map(j => new Vector3().fromArray(prim.positions, prim.indices[i + j]! * 3));
      const hit = ray.intersectTriangle(points[0]!, points[1]!, points[2]!, true, new Vector3());
      if (hit) out.push(hit.clone());
    }
  }
  return out;
}

it('closes both jamb and head channels behind the cassette from oblique viewing directions', () => {
  const before = JSON.stringify(opening);
  for (const angle of [0, Math.PI / 2, .37]) {
    const dir: [number, number] = [Math.cos(angle), Math.sin(angle)];
    const n: [number, number] = [dir[1], -dir[0]];
    const point = (u: number, y: number, depth: number) => new Vector3(83.5 + dir[0] * u - n[0] * depth, y, 36 + dir[1] * u - n[1] * depth);
    const mesh = new MeshBuilder();
    meshPocketDoorLining(mesh, { v: [83.5, 36], dir, n }, floor, opening, .676, 'metal');
    expect(mesh.parts.map(p => p.name)).toEqual(['door:entrance/rear-lining']);
    for (const depth of [.259, .4, .675]) {
      for (const side of [20.5, 23.5]) {
        const target = point(side, 1.5, depth), origin = point(22, 1.25, .9);
        expect(hits(mesh, origin, target.clone().sub(origin)).some(hit => hit.distanceTo(target) < 1e-6)).toBe(true);
      }
      const target = point(22, 3, depth), origin = point(21.8, 1.5, .9);
      expect(hits(mesh, origin, target.clone().sub(origin)).some(hit => hit.distanceTo(target) < 1e-6)).toBe(true);
    }
    // Looking/walking straight through the declared aperture remains unobstructed.
    const origin = point(22, 1.5, 1);
    expect(hits(mesh, origin, point(22, 1.5, 0).sub(origin))).toHaveLength(0);
    // No backing enters the authored moving leaf/pocket volume (ending at .223m).
    for (const part of mesh.parts) for (const prim of part.prims.values()) {
      for (let i = 0; i < prim.positions.length; i += 3) {
        const depth = -(prim.positions[i]! - 83.5) * n[0] - (prim.positions[i + 2]! - 36) * n[1];
        expect(depth).toBeGreaterThanOrEqual(.258 - 1e-6);
        expect(depth).toBeLessThanOrEqual(.676 + 1e-6);
      }
    }
  }
  expect(JSON.stringify(opening)).toBe(before);
});

it('adds no duplicate lining when the cassette already reaches the rear wall', () => {
  const mesh = new MeshBuilder();
  meshPocketDoorLining(mesh, { v: [0, 0], dir: [1, 0], n: [0, -1] }, floor, opening, .258, 'metal');
  expect(mesh.parts).toHaveLength(0);
});

it('exports the fixed rear lining with the permanent shell, retaining independent leaf nodes', async () => {
  const { glb, blueprint } = await generate({
    seed: 'luxury-reference-review', buildingId: 'p0', theme: 'cyberpunk',
    parcel: { footprint: [[81.5, 34], [121.5, 34], [121.5, 74], [81.5, 74]], accessPoint: [101.5, 34], maxHeight: 31.5,
      buildingGrid: { origin: [81.5, 34], angle: 0, spacing: .5 } },
    building: { type: 'residential', tier: 'high_rich', floors: 6 },
    options: { architecture: 'mirror-frame', glb: 'named' },
  }, keys);
  const names = glbJson(glb).nodes.map((node: { name: string }) => node.name);
  expect(names).toContain('door:entrance/rear-lining');
  expect(names).toContain('door:entrance/leaf:0');
  expect(names).toContain('door:entrance/leaf:1');
  const door = blueprint.floors[0]!.openings.find(o => o.id === 'entrance')!;
  expect(door.door!.clearance!.width).toBe(3);
  expect(door.door!.cassette!.backDepth).toBe(.258);
  expect(blueprint.facade.wallDepth).toBe(.676);
}, 60_000);
