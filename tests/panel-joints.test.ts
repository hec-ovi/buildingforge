import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import { edgeDir, edgeNormal } from '../src/core/polygon.ts';

const source = JSON.parse(readFileSync(new URL('../fixtures/corpo-tower.request.json', import.meta.url), 'utf8'));

it('exports recessed 7 m panel joints with bevels while retaining the opening cuts', async () => {
  const { glb, blueprint } = await generate({ ...source,
    building: { type: 'hospital', tier: 'rich', floors: 4 },
    options: { exteriorStyle: 'civic-institutional', balconies: 'off' },
  }, { textures: { mode: 'keys' } });
  const doc = await new NodeIO().readBinary(glb);
  let joints = 0, bevels = 0;
  for (const floor of blueprint.floors.filter((floor) => floor.index > 0)) {
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const node = doc.getRoot().listNodes().find((node) => node.getName() === `wall:${floor.index}/${edge}`)!;
      const tangent = edgeDir(floor.outline, edge), normal = edgeNormal(floor.outline, edge);
      const origin = floor.outline[edge]!;
      for (const prim of node.getMesh()!.listPrimitives()) {
        const positions = prim.getAttribute('POSITION')!;
        const normals = prim.getAttribute('NORMAL')!;
        for (let index = 0; index < positions.getCount(); index++) {
          const [x, y, z] = positions.getElement(index, [0, 0, 0]);
          const u = (x! - origin[0]) * tangent[0] + (z! - origin[1]) * tangent[1];
          const depth = (x! - origin[0]) * normal[0] + (z! - origin[1]) * normal[1];
          expect(depth).toBeGreaterThanOrEqual(-0.01201);
          expect(depth).toBeLessThanOrEqual(0.00001);
          if (depth < -0.01199) joints++;
          const n = normals.getElement(index, [0, 0, 0]);
          if (Math.abs(n[1]!) > 0.01 || Math.abs(n[0]! * tangent[0] + n[2]! * tangent[1]) > 0.01) bevels++;
          for (const opening of floor.openings.filter((opening) => opening.edge === edge)) {
            const inside = u > opening.offset + 1e-5 && u < opening.offset + opening.width - 1e-5
              && y! > floor.elevation + opening.sill + 1e-5
              && y! < floor.elevation + opening.sill + opening.height - 1e-5;
            expect(inside).toBe(false);
          }
        }
      }
    }
  }
  expect(joints).toBeGreaterThan(0);
  expect(bevels).toBeGreaterThan(0);
});
