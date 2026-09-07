import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import { PROPORTIONS } from '../src/rules/proportions.ts';
import { FEASIBILITY } from '../src/rules/families.ts';

const request = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
const options = { textures: { mode: 'keys' as const } };

it('reserves a generous residential ground volume before fitting normal floors to the envelope', async () => {
  for (const maxHeight of [24, 18.5]) {
    const { blueprint } = await generate({ ...request, parcel: { ...request.parcel, maxHeight } }, options);
    const [ground, ...upper] = blueprint.floors;
    expect(ground!.height).toBeGreaterThanOrEqual(4.5);
    expect(ground!.height).toBeGreaterThan(1.5 * Math.max(...upper.map((floor) => floor.height)));
    expect(upper.every((floor) => floor.height >= FEASIBILITY.residential.minFloorHeight - 1e-9)).toBe(true);
    expect(blueprint.roof.elevation).toBeLessThanOrEqual(maxHeight + 1e-9);
    const entrance = ground!.openings.find((opening) => opening.id === 'entrance')!;
    expect(entrance.height).toBeGreaterThanOrEqual(PROPORTIONS.families.residential.entrance[0]);
    expect(entrance.width).toBeGreaterThanOrEqual(PROPORTIONS.entranceWidth.standard[0]);
  }
});

it('fits the taller ground beneath exact bridge elevations and the published pinned-floor limits', async () => {
  const { blueprint } = await generate({
    ...request,
    parcel: { footprint: [[0, 0], [24, 0], [24, 20], [0, 20]], accessPoint: [12, -1], maxHeight: 24 },
    apertures: [{ id: 'bridge', linkId: 'bridge', buildingId: request.buildingId, floor: 3,
      kind: 'bridge', face: 0, u: 8, base: 10, width: 3, height: 2.5, shape: 'rect',
      cut: { polygon: [[8, 10, 0], [11, 10, 0], [11, 12.5, 0], [8, 12.5, 0]], axisDir: [0, 0, -1] } }],
  }, options);
  const owner = blueprint.floors.find((floor) => floor.openings.some((opening) => opening.id === 'bridge'))!;
  expect(owner.elevation).toBe(10);
  expect(owner.height).toBeGreaterThanOrEqual(2.5);
  expect(blueprint.floors[0]!.height).toBeGreaterThanOrEqual(4);
  for (const floor of blueprint.floors) {
    expect(floor.height).toBeGreaterThanOrEqual(FEASIBILITY.residential.minFloorHeight - 1e-9);
    expect(floor.height).toBeLessThanOrEqual(FEASIBILITY.residential.maxFloorHeight + 1e-9);
  }
});
