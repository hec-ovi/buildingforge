import { expect, it } from 'vitest';
import earcut from 'earcut';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest } from '../src/index.ts';
import { area, signedArea, type P2 } from '../src/core/polygon.ts';
import { capDifference } from '../src/mesh/capDifference.ts';
import { glbIO, keys } from './support.ts';

function triangles(ring: P2[]): P2[][] {
  const indices = earcut(ring.flat(), undefined, 2), result: P2[][] = [];
  for (let i = 0; i < indices.length; i += 3) result.push(indices.slice(i, i + 3).map(index => ring[index]!));
  return result;
}

/** Independent convex clipping measures overlap, including a triangle whose centre misses the hole. */
function overlap(subject: P2[], triangle: P2[]): number {
  const clip = signedArea(triangle) > 0 ? triangle : [...triangle].reverse();
  let result = subject;
  for (let i = 0; i < 3 && result.length; i++) {
    const a = clip[i]!, b = clip[(i + 1) % 3]!;
    const distance = ([x, y]: P2) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const next: P2[] = [];
    for (let k = 0; k < result.length; k++) {
      const p = result[k]!, q = result[(k + 1) % result.length]!;
      const dp = distance(p), dq = distance(q);
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        next.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    result = next;
  }
  return area(result);
}

it('subtracts touching, concave, reversed and crossing cutouts at any parcel angle', () => {
  const outer: P2[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const cases: [P2[], number][] = [
    [[[0, 0], [10, 0], [10, 2], [0, 2]], 80],
    [[[0, 0], [10, 0], [10, 5], [0, 5]], 50],
    [[[1, 0], [3, 0], [3, 6], [7, 6], [7, 0], [9, 0], [9, 8], [1, 8]], 60],
    [[[5, -2], [12, 5], [5, 12], [-2, 5]], 18],
    [outer, 0], [[...outer].reverse(), 0],
  ];
  for (const angle of [0, 37, 90, 143]) {
    const a = angle * Math.PI / 180;
    const transform = (ring: P2[]) => ring.map(([x, z]): P2 => [503 + x * Math.cos(a) - z * Math.sin(a), 521 + x * Math.sin(a) + z * Math.cos(a)]);
    for (const [hole, expected] of cases) {
      const cut = transform(hole), pieces = capDifference(transform(outer), cut), cutTriangles = triangles(cut);
      expect(pieces.reduce((sum, piece) => sum + area(piece), 0), `${angle}°/${expected}m²`).toBeCloseTo(expected, 7);
      for (const piece of pieces) for (const triangle of cutTriangles) expect(overlap(piece, triangle)).toBeLessThan(1e-8);
    }
  }
});

it('keeps rotated balcony terraces outside the upper floor and its stair opening', async () => {
  for (const degrees of [0, 37, 143]) {
    const a = degrees * Math.PI / 180;
    const rotate = ([x, z]: P2): P2 => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
    const request: BuildingRequest = {
      seed: 'plans:balcony-grid-commercial-high_rich-5x3x33f', buildingId: `rotated-terrace-${degrees}`, theme: 'cyberpunk',
      parcel: { footprint: ([[0, 0], [37.5, 0], [37.5, 20.5], [0, 20.5]] as P2[]).map(rotate), accessPoint: rotate([0, 10.25]), maxHeight: 19.5 },
      building: { type: 'corpo', tier: 'high_rich', floors: 3 }, options: { architecture: 'balcony-grid', glb: 'named' },
    };
    const { glb, blueprint } = await generate(request, keys), doc = await glbIO().readBinary(glb);
    const terrace = doc.getRoot().listNodes().find(node => node.getName() === 'terrace:1')!;
    const cutTriangles = triangles(blueprint.floors[1]!.outline);
    let terraceArea = 0, interiorOverlap = 0;
    for (const primitive of terrace.getMesh()!.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')!, normals = primitive.getAttribute('NORMAL')!, indices = primitive.getIndices()!.getArray()!;
      for (let i = 0; i < indices.length; i += 3) {
        if (normals.getElement(indices[i]!, [])[1]! < .99) continue;
        const tri = Array.from(indices.slice(i, i + 3), index => {
          const p = positions.getElement(index, []);
          return [p[0]!, p[2]!] as P2;
        });
        terraceArea += area(tri);
        for (const cut of cutTriangles) interiorOverlap += overlap(tri, cut);
      }
    }
    expect(terraceArea, `${degrees}° visible terrace area`).toBeCloseTo(area(blueprint.floors[0]!.outline) - area(blueprint.floors[1]!.outline), 2);
    expect(interiorOverlap, `${degrees}° terrace over occupied upper floor`).toBeLessThan(.001);
    if (degrees === 37) {
      const meshes = doc.getRoot().listNodes().flatMap(node => node.getMesh()?.listPrimitives().map(primitive => {
        const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!), 3));
        geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
        const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
        mesh.name = node.getName(); mesh.position.fromArray(node.getTranslation()); mesh.updateMatrixWorld();
        return mesh;
      }) ?? []);
      const hits = new Raycaster(new Vector3(3.4766, 4.6, 19.8046), new Vector3(0, -1, 0), 0, .2).intersectObjects(meshes, false);
      expect([...new Set(hits.map(hit => hit.object.name))]).toEqual(['floor:1/slab']);
      for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
    }
  }
});
