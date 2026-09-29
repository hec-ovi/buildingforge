import { expect, it } from 'vitest';
import { MeshBuilder, type V3 } from '../src/mesh/primitives.ts';
import { TerraceKit } from '../src/mesh/terraceKit.ts';
import { terraceFern, smoothTube } from '../src/mesh/terraceFoliage.ts';
import type { RoofTerracePlan } from '../src/layout/roofTerrace.ts';

const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

it('builds fine fern pinnae with smooth outward normals at either roof rotation', () => {
  for (const angle of [0, .37]) {
    const mesh = new MeshBuilder();
    const plan = { origin: [0, 0], axis: [Math.cos(angle), Math.sin(angle)] } as RoofTerracePlan;
    const kit = new TerraceKit(mesh.part('fern'), plan, 27, []);
    terraceFern(kit, 0, 0, 1.35, 1.1, 1.15, 'leaflet-quality');
    const count = [...mesh.parts[0]!.prims.values()].reduce((n, p) => n + p.indices.length / 3, 0);
    expect(count).toBeGreaterThan(2_200);
    expect(count).toBeLessThan(3_000);
    for (const primitive of mesh.parts[0]!.prims.values()) {
      expect(primitive.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < primitive.normals.length; i += 3) expect(Math.hypot(...primitive.normals.slice(i, i + 3))).toBeCloseTo(1, 6);
      for (let i = 0; i < primitive.indices.length; i += 3) {
        const indices = primitive.indices.slice(i, i + 3);
        const [a, b, c] = indices.map(j => primitive.positions.slice(j * 3, j * 3 + 3));
        const geometric = cross(b!.map((n, j) => n - a![j]!), c!.map((n, j) => n - a![j]!));
        expect(Math.hypot(...geometric)).toBeGreaterThan(1e-10);
        const averaged = [0, 1, 2].map(axis => indices.reduce((n, j) => n + primitive.normals[j * 3 + axis]!, 0));
        expect(geometric.reduce((n, v, j) => n + v * averaged[j]!, 0)).toBeGreaterThan(0);
      }
    }
  }
});

it('parallel-transports bent wire cross-sections through upright and horizontal bends', () => {
  const mesh = new MeshBuilder();
  const kit = new TerraceKit(mesh.part('wire'), { origin: [0, 0], axis: [1, 0] } as RoofTerracePlan, 0, []);
  const path: V3[] = [[0,.73,-.18],[0,.66,-.205],[0,.17,-.235],[0,.1,-.205],[0,.093,-.14],[0,.093,.14],[0,.1,.205],[0,.17,.235],[0,.66,.205],[0,.73,.18]];
  smoothTube(kit, 'cyberpunk/metal/rich#paint', path, .01, .01, 8);
  const prim = [...mesh.parts[0]!.prims.values()][0]!;
  for (let i = 0; i < prim.indices.length; i += 3) {
    const [a,b,c] = prim.indices.slice(i,i+3).map(j=>prim.positions.slice(j*3,j*3+3));
    expect(Math.hypot(...cross(b!.map((n,j)=>n-a![j]!),c!.map((n,j)=>n-a![j]!)))).toBeGreaterThan(1e-10);
  }
});
