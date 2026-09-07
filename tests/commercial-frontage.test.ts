import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { coreFeasibility } from '../../interior/dist/feasibility.js';

const source = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
const keys = { textures: { mode: 'keys' as const } };

it('retains narrow-shop display pairs and the full circulation depth around its shared core', async () => {
  const request: BuildingRequest = {
    seed: 'mercy-ledger-20260906:p63', buildingId: 'p63', theme: 'cyberpunk',
    parcel: { footprint: [[282, 237.5], [299.5, 237.5], [299.5, 247.5], [282, 247.5]],
      accessPoint: [281.5, 258.501], maxHeight: 9,
      buildingGrid: { origin: [0, 0], angle: 0, spacing: 0.5 } },
    building: { type: 'commerce', tier: 'mid', floors: 2 },
    options: { glb: 'merged', signage: { mode: 'marquee', text: 'METER SUPPLY 041' },
      curtains: { overrides: [{ openingId: 'w:1:0:display:0', openPercent: 0 },
        { openingId: 'w:1:0:display:1', openPercent: 100 }] } },
  };
  const { blueprint, glb } = await generate(request, keys);
  expect(blueprint.facade.coreAdjacency).toEqual({ glazing: { role: 'circulation', clearDepth: 1.2 } });
  expect(blueprint.floors).toHaveLength(2);
  expect(blueprint.bounds.footprint).toEqual(request.parcel.footprint);
  const upper = blueprint.floors.find((floor) => floor.index === 1)!;
  expect(upper.openings.find((opening) => opening.id === 'w:1:0:display:0')!.curtain!.closurePercent).toBe(100);
  expect(upper.openings.find((opening) => opening.id === 'w:1:0:display:1')!.curtain!.closurePercent).toBe(0);
  for (let edge = 0; edge < upper.outline.length; edge++) {
    const displays = upper.openings.filter((opening) => opening.edge === edge && opening.kind === 'window');
    expect(displays).toHaveLength(2);
    expect(displays.every((opening) => opening.width >= 2)).toBe(true);
  }
  expect(coreFeasibility(JSON.parse(JSON.stringify(blueprint)))).toMatchObject({ fits: true, mode: 'walkup' });
  const repeated = await generate(request, keys);
  expect(repeated.blueprint).toEqual(blueprint);
  expect(repeated.glb).toEqual(glb);
  await expect(generate({ ...request, options: { ...request.options,
    coreAdjacency: { glazing: { role: 'circulation', clearDepth: 20 } } } }, keys))
    .rejects.toMatchObject({ code: 'E_CORE_PLATE' });
});

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
