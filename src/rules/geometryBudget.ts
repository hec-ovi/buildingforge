// The published size a shell is allowed to occupy, and the measurement taken
// against it. Over budget, a shell sheds repeat detail until it fits; it never
// changes its architecture and it is never refused for being detailed.

import POLICY from '../../schemas/geometry-budget.json' with { type: 'json' };
import type { BuildingRequest } from '../types.ts';
import type { DetailStep } from './simplification.ts';

export interface GeometryBudget {
  triangles: number;
  bytes: number;
}

/** What the blueprint publishes: the face count, which both GLB modes share. */
export interface GeometryReport {
  triangles: number;
  budget: GeometryBudget;
  /** Repeat detail shed to fit, in the order it was shed; absent at full detail. */
  simplified?: DetailStep[];
}

/** What the export is checked on, including the packing the runtime GLB produces. */
export interface GeometryMeasurement extends GeometryReport {
  vertices: number;
  bytes: number;
}

const ARCHITECTURES = POLICY.architectures as Record<string, number | string>;

/** Nine floors at the 4.5 m default pitch clears 40 m: a tower, on the tall allowance. */
export const TALL_TOWER_FLOORS = POLICY.tower.fromFloors;

/**
 * The allowance for one shell: the ordinary figure, raised threefold for a
 * tower, never below the shell's own facade area at the published rate, and
 * multiplied by the architecture's own factor. An authored composition carries
 * piers, cassettes, wings and slots a plain facade does not, so it is allowed to
 * cost more; [the policy](../../schemas/geometry-budget.json) states each one.
 *
 * `facadeArea` is the ground outline perimeter times the total height, in square
 * metres; pass 0 where the massing is not known yet.
 */
export function geometryBudget(request: BuildingRequest, facadeArea = 0): GeometryBudget {
  const size = request.building.floors >= POLICY.tower.fromFloors ? POLICY.tower.multiple : 1;
  const architecture = request.options?.architecture;
  const authored = architecture && architecture !== 'auto' ? ARCHITECTURES[architecture] : undefined;
  const triangles = Math.max(POLICY.ordinary.triangles * size,
    Math.round(facadeArea * POLICY.facadeRate.trianglesPerSquareMetre));
  const scale = (typeof authored === 'number' ? authored : 1) * triangles / POLICY.ordinary.triangles;
  return {
    triangles: Math.round(POLICY.ordinary.triangles * scale),
    bytes: Math.round(POLICY.ordinary.bytes * scale),
  };
}

export function overBudget(measured: GeometryMeasurement): boolean {
  return measured.triangles > measured.budget.triangles || measured.bytes > measured.budget.bytes;
}
