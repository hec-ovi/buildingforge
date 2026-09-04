import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const source = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
const keys = { textures: { mode: 'keys' as const } };

it('fits entrance-led commercial displays with broad solid piers and sparse upper glazing', async () => {
  for (const type of ['commerce', 'mall']) {
    const request = { ...source, seed: 'market-display', building: { type, tier: 'high_rich', floors: 4 }, options: { shape: 'box', exteriorStyle: type === 'commerce' ? 'premium-office' : 'premium-mineral', openFront: 'off' } };
    const { blueprint } = await generate(request, keys);
    expect(blueprint.facade.style).not.toBe('curtain-wall');
    const ground = blueprint.floors.find((floor) => floor.index === 0)!;
    const entrance = ground.openings.find((opening) => opening.doorRole === 'main')!;
    const windows = ground.openings.filter((opening) => opening.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.length).toBeLessThanOrEqual(2);
    expect(windows.every((window) => window.edge === entrance.edge && window.width >= 2 && window.windowTreatment)).toBe(true);
    for (const floor of blueprint.floors.filter((floor) => floor.index >= 0)) {
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const openings = floor.openings.filter((opening) => opening.edge === edge).sort((a, b) => a.offset - b.offset);
        expect(openings.filter((opening) => opening.kind === 'window').length).toBeLessThanOrEqual(2);
        for (let i = 1; i < openings.length; i++) expect(openings[i]!.offset - openings[i - 1]!.offset - openings[i - 1]!.width).toBeGreaterThanOrEqual(1.499);
      }
    }
    expect((await generate(request, keys)).blueprint).toEqual(blueprint);
    const hidden = await generate({ ...request, options: { ...request.options, windows: 'none' } }, keys);
    expect(hidden.blueprint.floors.flatMap((floor) => floor.openings).some((opening) => opening.kind === 'window')).toBe(false);
  }
});
