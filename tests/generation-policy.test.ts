import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { keys } from './support.ts';
import floors from '../schemas/floor-constants.json' with { type: 'json' };
import proportions from '../schemas/proportions.json' with { type: 'json' };

const request: BuildingRequest = {
  seed: 'general-window-policy', buildingId: 'general-policy', theme: 'cyberpunk',
  building: { type: 'residential', tier: 'mid', floors: 4, basements: 1 },
  parcel: { footprint: [[0, 0], [32, 0], [32, 28], [0, 28]], accessPoint: [16, -2], maxHeight: 40 },
  options: { balconies: 'off', facadeServices: 'off', signage: null, adScreens: 'off', roofArtifacts: 'off' },
};

it('generates four metres clear by default, including basements, with wide shared window bays', async () => {
  const policy = floors.generationPolicy;
  expect(policy.defaultClearHeight).toBe(4);
  expect(policy.defaultFloorHeight).toBe(policy.defaultClearHeight + proportions.clearHeightAllowance);
  expect(policy.clearHeightAllowance).toBe(proportions.clearHeightAllowance);
  const { blueprint } = await generate(request, keys);
  for (const floor of blueprint.floors) {
    expect(floor.roomEnvelope!.vertical.max - floor.roomEnvelope!.vertical.min).toBeGreaterThanOrEqual(4);
  }
  const floor = blueprint.floors.find(f => f.index === 1)!;
  const windows = floor.openings.filter(o => o.kind === 'window');
  expect(windows.length).toBeGreaterThan(0);
  expect(windows.every(o => o.width >= 3.5 && o.height >= 3.5)).toBe(true);
  const gaps: number[] = [];
  for (let edge = 0; edge < floor.outline.length; edge++) {
    const ordered = windows.filter(o => o.edge === edge).sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < ordered.length; i++) gaps.push(ordered[i]!.offset - ordered[i - 1]!.offset - ordered[i - 1]!.width);
  }
  expect(gaps.some(gap => Math.abs(gap - policy.windows.sharedPierWidth) < 1e-7)).toBe(true);
});

it('resolves an explicit lower clear-height override through the same policy', async () => {
  const { blueprint } = await generate({ ...request, options: { ...request.options, minimumClearHeight: 3 } }, keys);
  const floor = blueprint.floors.find(f => f.index === 1)!;
  expect(floor.roomEnvelope!.vertical.max - floor.roomEnvelope!.vertical.min).toBe(3);
});
