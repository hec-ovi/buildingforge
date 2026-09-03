import { NodeIO, type Mesh } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generate } from '../src/index.ts';
import type { Floor } from '../src/index.ts';

type V3 = [number, number, number];
interface Triangle { points: [V3, V3, V3]; normal: V3 }

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));

describe('facade-band solids', () => {
  it('exports capped, continuous two-manifold bands on resized and rotated facades', async () => {
    const profiles = new Set<string>();
    const orientations = new Set<string>();
    let checked = 0;

    for (const source of [fixture('residential-mid'), fixture('review-urbe-p2')]) {
      const request = {
        ...source,
        options: { ...(source.options as Record<string, unknown> | undefined), glb: 'named' },
      };
      const { glb, blueprint } = await generate(request, { textures: { mode: 'keys' } });
      const theme = source.theme as string;
      const tier = (source.building as { tier: string }).tier;
      const doc = await new NodeIO().readBinary(glb);
      const node = doc.getRoot().listNodes()
        .find((candidate) => candidate.getName() === 'facade-relief')!;
      const mesh = node.getMesh()!;
      expect(new Set(mesh.listPrimitives().map((primitive) => primitive.getMaterial()!.getName())))
        .toEqual(new Set([`${theme}/wall-trim/${tier}`]));
      const triangles = trianglesOf(mesh);
      const allPoints = triangles.flatMap((triangle) => triangle.points);

      for (const floor of blueprint.floors.filter((candidate) => candidate.index > 0)) {
        const planes = [...new Set(allPoints
          .map((point) => point[1])
          .filter((y) => Math.abs(y - floor.elevation) < 0.24)
          .map((y) => Math.round(y * 10000) / 10000))].sort((a, b) => a - b);
        expect(planes.length, `floor ${floor.index} does not expose one band profile`).toBe(2);
        const [bottom, top] = planes as [number, number];
        const band = triangles.filter((triangle) => triangle.points.every((point) =>
          point[1] >= bottom - 1e-4 && point[1] <= top + 1e-4));
        expect(band.length).toBeGreaterThan(0);
        expect([...edgeCounts(band).values()].filter((count) => count !== 2),
          `floor ${floor.index} band has an open or duplicate boundary`).toEqual([]);
        expect(band.some((triangle) => triangle.normal[1] > 0.99
          && triangle.points.every((point) => Math.abs(point[1] - top) < 1e-4)),
        `floor ${floor.index} band has no closed top`).toBe(true);
        expect(band.some((triangle) => triangle.normal[1] < -0.99
          && triangle.points.every((point) => Math.abs(point[1] - bottom) < 1e-4)),
        `floor ${floor.index} band has no closed bottom`).toBe(true);

        let depth = 0;
        for (let edge = 0; edge < floor.outline.length; edge++) {
          const a = floor.outline[edge]!;
          const b = floor.outline[(edge + 1) % floor.outline.length]!;
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const dir: [number, number] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
          const normal: [number, number] = [dir[1], -dir[0]];
          const faceDepth = Math.max(...band.flatMap((triangle) => triangle.points.map(([x, , z]) =>
            (x - a[0]) * normal[0] + (z - a[1]) * normal[1])));
          depth = Math.max(depth, faceDepth);
          orientations.add(`${dir[0].toFixed(3)},${dir[1].toFixed(3)}`);
        }
        expect(depth, `floor ${floor.index} band is flat`).toBeGreaterThan(0.03);
        profiles.add(`${(top - bottom).toFixed(3)}x${depth.toFixed(3)}`);

        for (let corner = 0; corner < floor.outline.length; corner++) {
          expect(closesConvexCorner(band, floor, corner, bottom, top),
            `floor ${floor.index} band does not close corner ${corner}`).toBe(true);
        }
        checked++;
      }
    }

    expect(checked).toBeGreaterThan(10);
    expect(profiles.size).toBeGreaterThanOrEqual(2);
    expect(orientations.size).toBeGreaterThanOrEqual(6);
  });
});

function closesConvexCorner(
  triangles: Triangle[], floor: Floor, corner: number, bottom: number, top: number,
): boolean {
  const vertex = floor.outline[corner]!;
  const previous = (corner + floor.outline.length - 1) % floor.outline.length;
  const previousNormal = outwardNormal(floor, previous);
  const nextNormal = outwardNormal(floor, corner);
  const outsideBoth = ([x, , z]: V3) =>
    (x - vertex[0]) * previousNormal[0] + (z - vertex[1]) * previousNormal[1] > 0.005
      && (x - vertex[0]) * nextNormal[0] + (z - vertex[1]) * nextNormal[1] > 0.005;
  const topClosed = triangles.some((triangle) => triangle.normal[1] > 0.99
    && triangle.points.every((point) => Math.abs(point[1] - top) < 1e-4)
    && triangle.points.some(outsideBoth));
  const bottomClosed = triangles.some((triangle) => triangle.normal[1] < -0.99
    && triangle.points.every((point) => Math.abs(point[1] - bottom) < 1e-4)
    && triangle.points.some(outsideBoth));
  const outsideClosed = triangles.some((triangle) => Math.abs(triangle.normal[1]) < 0.01
    && triangle.points.some((point) => Math.abs(point[1] - top) < 1e-4)
    && triangle.points.some((point) => Math.abs(point[1] - bottom) < 1e-4)
    && triangle.points.some(outsideBoth));
  return topClosed && bottomClosed && outsideClosed;
}

function outwardNormal(floor: Floor, edge: number): [number, number] {
  const a = floor.outline[edge]!;
  const b = floor.outline[(edge + 1) % floor.outline.length]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
}

function trianglesOf(mesh: Mesh): Triangle[] {
  const triangles: Triangle[] = [];
  for (const primitive of mesh.listPrimitives()) {
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

function edgeCounts(triangles: Triangle[]): Map<string, number> {
  const counts = new Map<string, number>();
  const key = (point: V3) => point.map((value) => Math.round(value * 10000)).join(',');
  for (const { points } of triangles) {
    for (const [a, b] of [[points[0], points[1]], [points[1], points[2]], [points[2], points[0]]] as [V3, V3][]) {
      const edge = [key(a), key(b)].sort().join('|');
      counts.set(edge, (counts.get(edge) ?? 0) + 1);
    }
  }
  return counts;
}
