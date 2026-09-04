import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const keys = { textures: { mode: 'keys' as const } };
const source = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));

it('builds solid street bases with raised sparse punched windows and preserves upper floors', async () => {
  for (const [type, tier] of [['residential', 'poor'], ['offices', 'rich'], ['corpo', 'high_rich']]) {
    const request = { ...source, building: { type, tier, floors: 4 }, options: { balconies: 'off', exteriorStyle: type === 'residential' ? 'residential-salvaged' : 'premium-office' } };
    const first = await generate(request, keys);
    const floor = first.blueprint.floors.find((item) => item.index === 0)!;
    expect(floor.openings.filter((item) => item.kind === 'door')).toHaveLength(1);
    const windows = floor.openings.filter((item) => item.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    const doc = await new NodeIO().readBinary(first.glb);
    const concreteKey = first.blueprint.facade.groundMaterial.key;
    expect(first.blueprint.materialVariants[concreteKey]).toBe(first.blueprint.facade.groundMaterial.variantId);
    const groundWalls = doc.getRoot().listNodes().filter((item) => item.getName().startsWith('wall:0/'));
    expect(groundWalls).toHaveLength(floor.outline.length);
    for (const wall of groundWalls) {
      expect(wall.getMesh()!.listPrimitives().map((item) => item.getMaterial()!.getName())).toEqual([concreteKey]);
    }
    for (const opening of windows) {
      expect(opening.sill).toBe(1);
      expect(opening.height).toBe(1.5);
      expect(opening.width).toBeLessThanOrEqual(2);
      expect(opening.head).toBeUndefined();
      const node = doc.getRoot().listNodes().find((item) => item.getName() === `window:${opening.id}`)!;
      const pane = node.getMesh()!.listPrimitives().find((item) => item.getMaterial()!.getName() === opening.material)!;
      const positions = pane.getAttribute('POSITION')!;
      for (let index = 0; index < positions.getCount(); index++) {
        const y = positions.getElement(index, [])[1]!;
        expect(y).toBeGreaterThanOrEqual(1 - 1e-6);
        expect(y).toBeLessThanOrEqual(2.5 + 1e-6);
      }
    }
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const bays = windows.filter((item) => item.edge === edge).map((item) => Number(item.id.split(':').at(-1))).sort((a, b) => a - b);
      for (let index = 1; index < bays.length; index++) expect(bays[index]! - bays[index - 1]!).toBeGreaterThanOrEqual(2);
    }
    const upper = first.blueprint.floors.find((item) => item.index === 1)!;
    expect(upper.openings.some((item) => item.kind === 'window')).toBe(true);
    if (type !== 'residential') expect(upper.openings.filter((item) => item.kind === 'window').every((item) => item.head! >= 1)).toBe(true);
  }
}, 15000);

it('keeps mixed-use shops glazed and obeys explicit window suppression', async () => {
  const request = { ...source, building: { type: 'residential', tier: 'mid', floors: 3, floorKinds: ['commerce', 'residential', 'residential'] } };
  const { blueprint } = await generate(request, keys);
  const floor = blueprint.floors.find((item) => item.index === 0)!;
  const windows = floor.openings.filter((item) => item.kind === 'window');
  expect(windows.length).toBeGreaterThan(0);
  expect(windows.every((item) => item.sill <= 0.3 && item.sill + item.height >= floor.height - 0.55)).toBe(true);
  const hidden = await generate({ ...request, options: { windows: 'none' } }, keys);
  expect(hidden.blueprint.floors.flatMap((item) => item.openings).some((item) => item.kind === 'window')).toBe(false);
});
