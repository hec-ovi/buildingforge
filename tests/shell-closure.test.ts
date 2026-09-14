import { expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { generate } from '../src/index.ts';
import { fixture, keys } from './support.ts';

it('exports inward wall faces and closed intact glazing through the public generator', async () => {
  const request = fixture('corpo-tower');
  request.building.floors = 3;
  request.options = { ...request.options, shape: 'rounded-box', glb: 'named', facadeServices: 'off' };
  const { glb, blueprint } = await generate(request, keys);
  const doc = await new NodeIO().readBinary(glb);
  for (const floor of blueprint.floors) {
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const node = doc.getRoot().listNodes().find(n => n.getName() === `wall:${floor.index}/${edge}`)!;
      const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (b[1] - a[1]) / len, nz = (a[0] - b[0]) / len;
      let outward = false, inward = false;
      for (const prim of node.getMesh()!.listPrimitives()) {
        const normals = prim.getAttribute('NORMAL')!, positions = prim.getAttribute('POSITION')!;
        for (let i = 0; i < normals.getCount(); i++) {
          const normal = normals.getElement(i, []), p = positions.getElement(i, []);
          const facing = normal[0]! * nx + normal[2]! * nz;
          if (facing > 0.99) outward = true;
          if (facing < -0.99) {
            inward = true;
            expect(-((p[0]! - a[0]) * nx + (p[2]! - a[1]) * nz)).toBeCloseTo(blueprint.facade.wallDepth, 4);
          }
        }
      }
      expect(outward).toBe(true);
      expect(inward).toBe(true);
    }
  }
  const window = blueprint.floors.flatMap(f => f.openings).find(o => o.kind === 'window' && !o.damage)!;
  const pane = doc.getRoot().listNodes().find(n => n.getName() === `window:${window.id}`)!.getMesh()!.listPrimitives()
    .find(p => p.getMaterial()!.getName().includes('window-glass'))!;
  expect(pane).toBeDefined();
  const normals = pane.getAttribute('NORMAL')!;
  const unique = new Set(Array.from({ length: normals.getCount() }, (_, i) => normals.getElement(i, [] as number[]).map(n => n.toFixed(4)).join(',')));
  expect(unique.size).toBe(6);
  expect(blueprint.facade.wallDepth).toBeGreaterThanOrEqual(0.12);
});
