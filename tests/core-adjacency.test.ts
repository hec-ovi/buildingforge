import { expect, it } from 'vitest';
import feasibility from '../../interior/schemas/core-feasibility.json' with { type: 'json' };
import { generate, type BuildingRequest } from '../src/index.ts';

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
