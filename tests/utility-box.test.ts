import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

it('fits detailed service enclosures and contrasting hardware inside each published utility envelope', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
  const { blueprint, glb } = await generate({ ...fixture, building: { type: 'factory', tier: 'poor', floors: 4 } }, { textures: { mode: 'keys' } });
  const units = blueprint.facadeArtifacts.filter((artifact) => artifact.kind === 'utility-box');
  expect(units.length).toBeGreaterThan(0);
  const doc = await new NodeIO().readBinary(glb);
  const primitives = doc.getRoot().listNodes().find((node) => node.getName() === 'facade-artifacts')!.getMesh()!.listPrimitives();
  expect(primitives.map((primitive) => primitive.getMaterial()!.getName()).sort()).toEqual([
    'cyberpunk/roof-artifact/poor', 'cyberpunk/window-frame/poor',
  ]);
  const envelopes = units.map((unit) => {
    const floor = blueprint.floors.find((floor) => floor.index === unit.floor)!;
    const a = floor.outline[unit.edge]!, b = floor.outline[(unit.edge + 1) % floor.outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    return (point: number[]) => {
      const u = (point[0]! - a[0]) * dx + (point[2]! - a[1]) * dz - unit.offset;
      const y = point[1]! - floor.elevation - unit.sill;
      const depth = (point[0]! - a[0]) * dz - (point[2]! - a[1]) * dx - (unit.standoff ?? 0);
      return [u, y, depth].every((value, axis) => value >= -1e-5 && value <= unit.size[axis]! + 1e-5);
    };
  });
  for (const primitive of primitives) {
    const positions = primitive.getAttribute('POSITION')!;
    for (let index = 0; index < positions.getCount(); index++) {
      const point = positions.getElement(index, [0, 0, 0]);
      expect(envelopes.some((contains) => contains(point))).toBe(true);
    }
    // Front seams, lid and hardware have physical meter UVs rather than a stretched exact map.
    const uv = primitive.getAttribute('TEXCOORD_0')!.getArray()!;
    expect(Math.max(...uv)).toBeLessThan(1);
    expect(positions.getCount()).toBeGreaterThan(units.length * 24);
  }
});
