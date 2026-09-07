import feasibility from '../../../interior/schemas/core-feasibility.json' with { type: 'json' };
import type { BuildingRequest, CoreAdjacency } from '../types.ts';
import type { FloorLayout } from './model.ts';
import { ExteriorError } from '../core/errors.ts';

export function coreAdjacency(request: BuildingRequest): CoreAdjacency {
  return request.options?.coreAdjacency ?? {
    glazing: {
      role: feasibility.constants.coreAdjacency.glazing.role as CoreAdjacency['glazing']['role'],
      clearDepth: feasibility.constants.coreAdjacency.glazing.clearDepth,
    },
  };
}

/** Preferred perimeter allowance while actual opening spans are unknown. */
export function corePerimeterClearance(request: BuildingRequest): number {
  const policy = coreAdjacency(request);
  const glazingDepth = request.options?.windows === 'none' ? 0 : policy.glazing.clearDepth;
  return Math.max(glazingDepth, ...(policy.overrides ?? []).map((rule) => rule.clearDepth));
}

export function validateAdjacencyOpenings(policy: CoreAdjacency, floors: FloorLayout[]): void {
  for (const override of policy.overrides ?? []) {
    const floor = floors.find((candidate) => candidate.index === override.floor);
    if (!floor?.openings.some((opening) => opening.id === override.opening)) {
      throw new ExteriorError('E_SCHEMA',
        `options.coreAdjacency.overrides: floor ${override.floor} has no opening ${override.opening}`);
    }
  }
}
