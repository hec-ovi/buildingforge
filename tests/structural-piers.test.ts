import { NodeIO } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

it('groups seeded curtain walls around broad closed bevelled piers without covering openings', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/corpo-tower.request.json', import.meta.url), 'utf8'));
  const arrangements = new Set<string>();
  for (const seed of ['structural-a', 'structural-b', 'structural-c']) {
    const { glb, blueprint } = await generate({ ...fixture, seed,
      options: { shape: 'box', exteriorStyle: 'premium-office', balconies: 'off' },
    }, { textures: { mode: 'keys' } });
    const floor = blueprint.floors.find((candidate) => candidate.index === 1)!;
    const windows = floor.openings.filter((opening) => opening.edge === 0 && opening.kind === 'window');
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows.length).toBeLessThanOrEqual(4);
    expect(windows.reduce((width, opening) => width + opening.width, 0)).toBeGreaterThan(18);
    arrangements.add(JSON.stringify(windows.map((opening) => [opening.offset, opening.width])));

    const document = await new NodeIO().readBinary(glb);
    const mesh = document.getRoot().listNodes().find((node) => node.getName() === 'facade-ribs')!.getMesh()!;
    let count = 0;
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')!;
      const indices = primitive.getIndices()!.getArray()!;
      const vertices = new Map<string, number[]>();
      const neighbours = new Map<string, Set<string>>();
      const edges = new Map<string, number>();
      const key = (index: number) => {
        const point = positions.getElement(index, []);
        const id = point.map((value) => Math.round(value * 10000)).join(',');
        vertices.set(id, point);
        return id;
      };
      for (let index = 0; index < indices.length; index += 3) {
        const triangle = [key(indices[index]!), key(indices[index + 1]!), key(indices[index + 2]!)];
        for (let side = 0; side < 3; side++) {
          const a = triangle[side]!, b = triangle[(side + 1) % 3]!;
          const edge = [a, b].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
          if (!neighbours.has(a)) neighbours.set(a, new Set());
          if (!neighbours.has(b)) neighbours.set(b, new Set());
          neighbours.get(a)!.add(b);
          neighbours.get(b)!.add(a);
        }
      }
      expect([...edges.values()].every((uses) => uses === 2), 'pier mesh has an open edge').toBe(true);
      const unseen = new Set(vertices.keys());
      while (unseen.size) {
        const queue = [unseen.values().next().value!];
        const points: number[][] = [];
        while (queue.length) {
          const id = queue.pop()!;
          if (!unseen.delete(id)) continue;
          points.push(vertices.get(id)!);
          queue.push(...neighbours.get(id)!);
        }
        count++;
        const extents = [0, 1, 2].map((axis) => [
          Math.min(...points.map((point) => point[axis]!)), Math.max(...points.map((point) => point[axis]!)),
        ]);
        const dimensions = extents.map(([min, max]) => max! - min!);
        const widthAxis = dimensions[0]! > dimensions[2]! ? 0 : 2;
        const depthAxis = widthAxis === 0 ? 2 : 0;
        expect(dimensions[widthAxis]).toBeGreaterThanOrEqual(1.19);
        expect(dimensions[widthAxis]).toBeLessThanOrEqual(2.41);
        expect(dimensions[depthAxis]).toBeGreaterThanOrEqual(0.19);
        expect(new Set(points.map((point) => point[depthAxis]!.toFixed(4))).size).toBeGreaterThan(2);
        for (const level of blueprint.floors.filter((level) => level.index > 0)) {
          for (const opening of level.openings) {
            const a = level.outline[opening.edge]!, b = level.outline[(opening.edge + 1) % level.outline.length]!;
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
            const local = points.map(([x, , z]) => [(x! - a[0]) * dx + (z! - a[1]) * dz,
              (x! - a[0]) * dz - (z! - a[1]) * dx]);
            if (!local.every((point) => point[1]! >= -1e-4 && point[1]! <= 0.41)) continue;
            const start = Math.min(...local.map((point) => point[0]!));
            const end = Math.max(...local.map((point) => point[0]!));
            expect(end <= opening.offset - 0.19 || start >= opening.offset + opening.width + 0.19,
              `${opening.id} overlaps a structural pier`).toBe(true);
          }
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(16);
  }
  expect(arrangements.size).toBeGreaterThan(1);
});
