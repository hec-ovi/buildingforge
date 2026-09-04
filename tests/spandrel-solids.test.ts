import { NodeIO } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

it('closes curtain-wall spandrels from the frame front to the glass back on every face', async () => {
  const request = JSON.parse(readFileSync(new URL('../fixtures/bridged-tower.request.json', import.meta.url), 'utf8'));
  const { blueprint, glb } = await generate(request, { textures: { mode: 'keys' } });
  const document = await new NodeIO().readBinary(glb);
  const nodes = new Map(document.getRoot().listNodes().map((node) => [node.getName(), node]));
  const orientations = new Set<number>();
  let count = 0;
  for (const floor of blueprint.floors) {
    for (const opening of floor.openings.filter((opening) => opening.kind === 'window' && opening.head)) {
      const a = floor.outline[opening.edge]!;
      const b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const direction = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const local = ([x, y, z]: number[]) => [
        (x! - a[0]) * direction[0]! + (z! - a[1]) * direction[1]!, y!,
        (x! - a[0]) * direction[1]! - (z! - a[1]) * direction[0]!,
      ];
      const primitives = nodes.get(`window:${opening.id}`)!.getMesh()!.listPrimitives();
      const panel = primitives.find((primitive) => primitive.getMaterial()!.getName() === blueprint.facade.materialPlan.border.key)!;
      const positions = panel.getAttribute('POSITION')!;
      const points = Array.from({ length: positions.getCount() }, (_, index) => local(positions.getElement(index, [])));
      const extent = (axis: number) => [Math.min(...points.map((point) => point[axis]!)), Math.max(...points.map((point) => point[axis]!))];
      const [back, front] = extent(2);
      expect(front! - back!, `${opening.id} has no panel thickness`).toBeGreaterThan(0.02);
      expect(extent(0)[0]).toBeCloseTo(opening.offset, 4);
      expect(extent(0)[1]).toBeCloseTo(opening.offset + opening.width, 4);
      expect(extent(1)[0]).toBeCloseTo(floor.elevation + opening.sill + opening.height - opening.head!, 4);
      expect(extent(1)[1]).toBeCloseTo(floor.elevation + opening.sill + opening.height, 4);

      const depthOf = (material: string) => primitives
        .filter((primitive) => primitive.getMaterial()!.getName().includes(material))
        .flatMap((primitive) => {
          const attribute = primitive.getAttribute('POSITION')!;
          return Array.from({ length: attribute.getCount() }, (_, index) => local(attribute.getElement(index, []))[2]!);
        });
      expect(front).toBeCloseTo(Math.max(...depthOf('/window-frame/')), 4);
      expect(back).toBeCloseTo(Math.min(...depthOf(opening.material!)), 4);

      const indices = panel.getIndices()!.getArray()!;
      const edges = new Map<string, number>();
      const key = (index: number) => points[index]!.map((value) => Math.round(value * 10000)).join(',');
      for (let index = 0; index < indices.length; index += 3) {
        for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
          const edge = [key(indices[index + from!]!), key(indices[index + to!]!)].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((uses) => uses === 2), `${opening.id} panel has an open boundary`).toBe(true);
      orientations.add(opening.edge);
      count++;
    }
  }
  expect(count).toBeGreaterThan(100);
  expect(orientations.size).toBe(4);
});
