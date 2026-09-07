import { expect, it } from 'vitest';
import feasibility from '../../interior/schemas/core-feasibility.json' with { type: 'json' };
import { generate, type BuildingRequest } from '../src/index.ts';
import { coreFeasibility } from '../../interior/dist/feasibility.js';

const keys = { textures: { mode: 'keys' as const } };
const request: BuildingRequest = {
  seed: 'core-adjacency:rectangular', buildingId: 'core-adjacency', theme: 'cyberpunk',
  parcel: { footprint: [[0, 0], [64, 0], [64, 32], [0, 32]], accessPoint: [32, -2], maxHeight: 36,
    buildingGrid: { origin: [0, 0], angle: 0, spacing: 0.5 } },
  building: { type: 'hotel', tier: 'rich', floors: 6 },
  options: { exteriorStyle: 'premium-office', balconies: 'off', roofArtifacts: 'off', facadeServices: 'off', signage: null },
};

it('publishes the shared circulation default and preserves an explicit glazing rule', async () => {
  const standard = await generate(request, keys);
  expect(standard.blueprint.facade.coreAdjacency).toEqual(feasibility.constants.coreAdjacency);
  const policy = { glazing: { role: 'room' as const, clearDepth: 3 } };
  const explicit = await generate({ ...request, options: { ...request.options, coreAdjacency: policy } }, keys);
  expect(explicit.blueprint.facade.coreAdjacency).toEqual(policy);
  expect(explicit.blueprint.bounds.footprint).toEqual(standard.blueprint.bounds.footprint);
  const floor = standard.blueprint.floors[0]!;
  const opening = floor.openings.find((candidate) => candidate.kind === 'window')!;
  const overridden = { glazing: { role: 'structure' as const, clearDepth: 0 },
    overrides: [{ floor: floor.index, opening: opening.id, role: 'circulation' as const, clearDepth: 1.8 }] };
  const selected = await generate({ ...request, options: { ...request.options, coreAdjacency: overridden } }, keys);
  expect(selected.blueprint.facade.coreAdjacency).toEqual(overridden);
});

it('hands the actual opening-aware stair placement to the roof and keeps its construction axes', async () => {
  const angle = 0.37;
  const point = ([x, z]: number[]): [number, number] => [117 + x! * Math.cos(angle) - z! * Math.sin(angle),
    -43 + x! * Math.sin(angle) + z! * Math.cos(angle)];
  const rotated = { ...request, parcel: { ...request.parcel,
    footprint: request.parcel.footprint.map(point), accessPoint: point(request.parcel.accessPoint),
    buildingGrid: { origin: [117, -43], angle, spacing: 0.5 } } };
  const { blueprint } = await generate(rotated, keys);
  expect(blueprint.coreFrame?.anglesDeg).toHaveLength(2);
  const result = coreFeasibility(JSON.parse(JSON.stringify(blueprint)));
  expect(result.fits).toBe(true);
  const stair = result.placement!.stairA;
  const roof = blueprint.roof.bulkhead!;
  expect(roof).not.toBeNull();
  for (let component = 0; component < 2; component++) {
    expect(roof.center[component]).toBeCloseTo(stair.center[component]!, 8);
    expect(roof.axis[component]).toBeCloseTo(stair.axis[component]!, 8);
  }
  expect(roof.width).toBeCloseTo(stair.width + 1, 8);
  expect(roof.depth).toBeCloseTo(stair.depth + 1, 8);
  const alignment = Math.abs(stair.axis[0] * Math.cos(angle) + stair.axis[1] * Math.sin(angle));
  expect(Math.min(alignment, Math.abs(alignment - 1))).toBeLessThan(1e-8);
});

it('fits the default circulation clearance to actual windows on a narrow complete city parcel', async () => {
  const parcel: BuildingRequest = {
    seed: 'ddb2d4eb-eeed-48eb-8fc8-b831236fade2:p35', buildingId: 'p35', theme: 'cyberpunk',
    parcel: { footprint: [[128, 248], [139, 248], [139, 365], [128, 365]],
      accessPoint: [141.25, 367], maxHeight: 22.2,
      buildingGrid: { origin: [0, 0], angle: 0, spacing: 0.5 } },
    building: { type: 'residential', tier: 'high_rich', floors: 6 },
    apertures: [], options: { glb: 'merged' },
  };
  const { blueprint, glb } = await generate(parcel, keys);
  expect(glb.byteLength).toBeGreaterThan(0);
  expect(blueprint.bounds.footprint).toEqual(parcel.parcel.footprint);
  expect(blueprint.facade.coreAdjacency).toEqual(feasibility.constants.coreAdjacency);
  expect(blueprint.floors.every((floor) => floor.openings.some((opening) => opening.kind === 'window'))).toBe(true);
  expect(coreFeasibility(JSON.parse(JSON.stringify(blueprint)))).toMatchObject({ fits: true, mode: 'standard' });
});

it('rejects malformed rules and a requested clearance that has no complete core plate', async () => {
  const glazing = { role: 'circulation', clearDepth: 1.2 };
  const override = { floor: 0, opening: 'entry', ...glazing };
  for (const policy of [null, {}, { glazing: [] }, { glazing: { ...glazing, role: 'hall' } },
    { glazing: { ...glazing, clearDepth: -1 } }, { glazing: { ...glazing, clearDepth: Number.NaN } },
    { glazing, overrides: [override, override] }, { glazing, overrides: [{ ...override, floor: 0.5 }] },
    { glazing, overrides: [{ ...override, opening: '' }] }, { glazing, unknown: true }]) {
    await expect(generate({ ...request, options: { ...request.options, coreAdjacency: policy } }, keys))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  }
  await expect(generate({ ...request, options: { ...request.options,
    coreAdjacency: { glazing, overrides: [{ ...override, opening: 'missing' }] } } }, keys))
    .rejects.toMatchObject({ code: 'E_SCHEMA' });
  const narrow = { ...request, parcel: { ...request.parcel,
    footprint: [[0, 0], [36, 0], [36, 9], [0, 9]] } };
  await expect(generate(narrow, keys))
    .rejects.toMatchObject({ code: 'E_CORE_PLATE' });
  const opaque = await generate({ ...narrow, options: { ...request.options, windows: 'none' } }, keys);
  expect(opaque.blueprint.floors.flatMap((floor) => floor.openings).some((opening) => opening.kind === 'window')).toBe(false);
});
