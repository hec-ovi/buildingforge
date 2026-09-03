import { NodeIO, type Mesh } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate } from '../src/index.ts';
import type { Floor, Opening } from '../src/index.ts';

type V3 = [number, number, number];
interface Triangle { points: [V3, V3, V3]; normal: V3 }

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));

describe('window-frame solids', () => {
  it('exports closed rings across frame sizes and wall orientations', async () => {
    const sizes = new Set<string>();
    const orientations = new Set<string>();
    let checked = 0;

    for (const source of [fixture('residential-mid'), fixture('factory'), fixture('review-urbe-p2')]) {
      const request = {
        ...source,
        options: { ...(source.options as Record<string, unknown> | undefined), glb: 'named' },
      };
      const { glb, blueprint } = await generate(request, { textures: { mode: 'keys' } });
      const theme = source.theme as string;
      const tier = (source.building as { tier: string }).tier;
      expect(blueprint.facade.style).not.toBe('curtain-wall');
      const doc = await new NodeIO().readBinary(glb);

      for (const floor of blueprint.floors) {
        for (const opening of floor.openings.filter((candidate) => candidate.kind === 'window')) {
          const node = doc.getRoot().listNodes()
            .find((candidate) => candidate.getName() === `window:${opening.id}`)!;
          const basis = faceBasis(floor, opening);
          const triangles = trianglesOf(node.getMesh()!, '/window-frame/')
            .map((triangle) => localTriangle(triangle, basis));
          const front = Math.max(...triangles.flatMap((triangle) => triangle.points.map((point) => point[2])));
          const backFaces = triangles.filter((triangle) => triangle.normal[2] < -0.99);
          expect(backFaces.length, `${opening.id} has no fitted back face`).toBeGreaterThan(0);
          const back = Math.max(...backFaces.flatMap((triangle) => triangle.points.map((point) => point[2])));
          expect(front - back, `${opening.id} frame has no depth`).toBeGreaterThan(0.02);

          const ring = triangles.filter((triangle) => triangle.points.every((point) =>
            point[2] >= back - 1e-4 && point[2] <= front + 1e-4));
          expect(ring.some((triangle) => triangle.normal[2] > 0.99), `${opening.id} has no front face`).toBe(true);
          expect(ring.some((triangle) => triangle.normal[2] < -0.99), `${opening.id} has no back face`).toBe(true);
          expect(ring.some((triangle) => triangle.normal[0] > 0.99), `${opening.id} has no right-facing cap`).toBe(true);
          expect(ring.some((triangle) => triangle.normal[0] < -0.99), `${opening.id} has no left-facing cap`).toBe(true);
          expect(ring.some((triangle) => triangle.normal[1] > 0.99), `${opening.id} has no top cap`).toBe(true);
          expect(ring.some((triangle) => triangle.normal[1] < -0.99), `${opening.id} has no bottom cap`).toBe(true);

          const openEdges = [...edgeCounts(ring).values()].filter((count) => count !== 2);
          expect(openEdges, `${opening.id} frame ring is not a closed two-manifold`).toEqual([]);

          const frameMaterials = node.getMesh()!.listPrimitives()
            .map((primitive) => primitive.getMaterial()!.getName())
            .filter((name) => name.includes('/window-frame/'));
          expect(new Set(frameMaterials)).toEqual(new Set([
            `${theme}/window-frame/${tier}`,
          ]));

          const glass = trianglesOf(node.getMesh()!, '/window-glass/')
            .flatMap((triangle) => localTriangle(triangle, basis).points);
          expect(Math.max(...glass.map((point) => point[2])), `${opening.id} glass crosses its frame`)
            .toBeLessThan(back - 0.01);

          sizes.add(`${opening.width.toFixed(3)}x${opening.height.toFixed(3)}`);
          orientations.add(`${basis.dir[0].toFixed(3)},${basis.dir[1].toFixed(3)}`);
          checked++;
        }
      }
    }

    expect(checked).toBeGreaterThan(20);
    expect(sizes.size).toBeGreaterThanOrEqual(3);
    expect(orientations.size).toBeGreaterThanOrEqual(6);
  });
});

function faceBasis(floor: Floor, opening: Opening) {
  const a = floor.outline[opening.edge]!;
  const b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir: [number, number] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  return { origin: a, dir, normal: [dir[1], -dir[0]] as [number, number] };
}

function trianglesOf(mesh: Mesh, materialPart: string): Triangle[] {
  const triangles: Triangle[] = [];
  for (const primitive of mesh.listPrimitives()) {
    if (!primitive.getMaterial()!.getName().includes(materialPart)) continue;
    const positions = primitive.getAttribute('POSITION')!;
    const normals = primitive.getAttribute('NORMAL')!;
    const indices = primitive.getIndices()!.getArray()!;
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const points = [0, 1, 2].map((offset) =>
        positions.getElement(indices[index + offset]!, [0, 0, 0]) as V3) as [V3, V3, V3];
      const normal = normals.getElement(indices[index]!, [0, 0, 0]) as V3;
      triangles.push({ points, normal });
    }
  }
  return triangles;
}

function localTriangle(
  triangle: Triangle,
  basis: { origin: [number, number]; dir: [number, number]; normal: [number, number] },
): Triangle {
  const point = ([x, y, z]: V3): V3 => {
    const dx = x - basis.origin[0], dz = z - basis.origin[1];
    return [dx * basis.dir[0] + dz * basis.dir[1], y,
      dx * basis.normal[0] + dz * basis.normal[1]];
  };
  const normal = ([x, y, z]: V3): V3 => [
    x * basis.dir[0] + z * basis.dir[1], y,
    x * basis.normal[0] + z * basis.normal[1],
  ];
  return { points: triangle.points.map(point) as [V3, V3, V3], normal: normal(triangle.normal) };
}

function edgeCounts(triangles: Triangle[]): Map<string, number> {
  const counts = new Map<string, number>();
  const key = (point: V3) => point.map((value) => Math.round(value * 10000)).join(',');
  for (const { points } of triangles) {
    for (const [a, b] of [[points[0], points[1]], [points[1], points[2]], [points[2], points[0]]] as [V3, V3][]) {
      const ends = [key(a), key(b)].sort();
      const edge = ends.join('|');
      counts.set(edge, (counts.get(edge) ?? 0) + 1);
    }
  }
  return counts;
}
