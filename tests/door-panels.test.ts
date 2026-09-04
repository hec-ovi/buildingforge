import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/corpo-tower.request.json', import.meta.url), 'utf8'));

describe('fitted solid entrance assemblies', () => {
  it('keeps mapped bevelled panels inside their moving leaf in named and merged output', async () => {
    for (const mode of ['named', 'merged']) {
      const { glb, blueprint } = await generate({ ...fixture, seed: 'entrance-review-3',
        building: { ...fixture.building, floors: 4 }, options: { ...fixture.options, shape: 'box', glb: mode } },
      { textures: { mode: 'keys' } });
      const opening = blueprint.floors[0]!.openings.find((item) => item.doorRole === 'main')!;
      expect(opening.material).toBe('cyberpunk/door/high_rich');
      const doc = await new NodeIO().readBinary(glb);
      const outline = blueprint.floors[0]!.outline;
      const start = outline[opening.edge]!, end = outline[(opening.edge + 1) % outline.length]!;
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      const dx = (end[0] - start[0]) / length, dz = (end[1] - start[1]) / length;
      for (let index = 0; index < opening.leaves!; index++) {
        const leaf = doc.getRoot().listNodes().find((node) => node.getName() === `door:${opening.id}/leaf:${index}`)!;
        const primitive = leaf.getMesh()!.listPrimitives().find((item) => item.getMaterial()!.getName() === opening.material)!;
        expect(leaf.getMesh()!.listPrimitives().some((item) => item.getMaterial()!.getName().includes('door-glass'))).toBe(false);
        const position = primitive.getAttribute('POSITION')!, normals = primitive.getAttribute('NORMAL')!;
        const uv = primitive.getAttribute('TEXCOORD_0')!;
        expect(uv.getCount()).toBe(position.getCount());
        let bevel = false, panel = false;
        const translation = leaf.getTranslation();
        for (let vertex = 0; vertex < position.getCount(); vertex++) {
          const [x, , z] = position.getElement(vertex, [0, 0, 0]);
          const wx = x! + translation[0] - start[0], wz = z! + translation[2] - start[1];
          const along = wx * dx + wz * dz, depth = wx * dz - wz * dx;
          const leafStart = opening.offset + index * opening.width / opening.leaves!;
          expect(along).toBeGreaterThanOrEqual(leafStart - 1e-5);
          expect(along).toBeLessThanOrEqual(leafStart + opening.width / opening.leaves! + 1e-5);
          expect(depth).toBeLessThan(0);
          panel ||= depth > -opening.door!.recessDepth + 0.01;
          const [nx, , nz] = normals.getElement(vertex, [0, 0, 0]);
          const facing = Math.abs(nx! * dz - nz! * dx);
          bevel ||= facing > 0.1 && facing < 0.95;
        }
        expect(panel).toBe(true);
        expect(bevel).toBe(true);
        expect(Math.max(...Array.from(uv.getArray()!))).toBeGreaterThan(1);
      }
    }
  });

  it('fits the illuminated set to one short header diffuser', async () => {
    const { glb, blueprint } = await generate({ ...fixture, seed: 'entrance-review-0',
      building: { ...fixture.building, floors: 4 }, options: { ...fixture.options, shape: 'box' } },
    { textures: { mode: 'keys' } });
    const opening = blueprint.floors[0]!.openings.find((item) => item.doorRole === 'main')!;
    const doc = await new NodeIO().readBinary(glb);
    const frame = doc.getRoot().listNodes().find((node) => node.getName() === `door:${opening.id}/frame`)!;
    const strips = frame.getMesh()!.listPrimitives().filter((item) => item.getMaterial()!.getName().includes('light-fixture'));
    expect(strips).toHaveLength(1);
    const positions = strips[0]!.getAttribute('POSITION')!;
    const points = Array.from({ length: positions.getCount() }, (_, vertex) => positions.getElement(vertex, [0, 0, 0]));
    expect(points.every((point) => point[1]! > opening.height)).toBe(true);
    const width = Math.hypot(Math.max(...points.map((point) => point[0]!)) - Math.min(...points.map((point) => point[0]!)),
      Math.max(...points.map((point) => point[2]!)) - Math.min(...points.map((point) => point[2]!)));
    expect(width).toBeLessThan(opening.width * 0.5);
  });
});
