import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';

it('keeps the complete fitted marquee clear of facade light fixtures', async () => {
  const request: BuildingRequest = {
    seed: 'mercy-ledger-20260906:p148', buildingId: 'p148', theme: 'cyberpunk',
    parcel: { footprint: [[282, 523.5], [313.5, 523.5], [313.5, 570.5], [282, 570.5]],
      accessPoint: [281.5, 571.441], maxHeight: 4.3,
      buildingGrid: { origin: [0, 0], angle: 0, spacing: 0.5 } },
    building: { type: 'restaurant', tier: 'mid', floors: 1 },
    options: { glb: 'merged', signage: { mode: 'marquee', text: 'RATION HALL 101' } },
  };
  const { blueprint } = await generate(request, { textures: { mode: 'keys' } });
  expect(blueprint.signage).toHaveLength(1);
  const sign = blueprint.signage[0]!;
  expect(sign.text).toBe('RATION HALL 101');
  const lights = blueprint.lights.filter((light) => light.edge === sign.edge);
  expect(lights.length).toBeGreaterThan(0);
  for (const light of lights) {
    const along = Math.hypot(light.position[0] - sign.center[0], light.position[2] - sign.center[2]);
    const vertical = Math.abs(light.position[1] - sign.center[1]);
    expect(along >= (light.size[0] + sign.width) / 2
      || vertical >= (light.size[1] + sign.height) / 2).toBe(true);
  }
});
