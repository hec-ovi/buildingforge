// The published size a shell is allowed to occupy, and the measurement taken
// against it. A shell over budget is not exported: the caller gets an error
// naming the measurement, and `architecture: auto` moves to the next recipe.

import type { BuildingRequest } from '../types.ts';

export interface GeometryBudget {
  triangles: number;
  bytes: number;
}

/** What the blueprint publishes: the face count, which both GLB modes share. */
export interface GeometryReport {
  triangles: number;
  budget: GeometryBudget;
}

/** What the export is checked on, including the packing the chosen GLB mode produced. */
export interface GeometryMeasurement extends GeometryReport {
  vertices: number;
  bytes: number;
}

const ORDINARY: GeometryBudget = { triangles: 50_000, bytes: 3 * 1024 * 1024 };

/** Nine floors at the 4.5 m default pitch clears 40 m: a tower, on the tall allowance. */
export const TALL_TOWER_FLOORS = 9;
const TALL_MULTIPLE = 3;

export function geometryBudget(request: BuildingRequest): GeometryBudget {
  return request.building.floors >= TALL_TOWER_FLOORS
    ? { triangles: ORDINARY.triangles * TALL_MULTIPLE, bytes: ORDINARY.bytes * TALL_MULTIPLE }
    : ORDINARY;
}

export function overBudget(measured: GeometryMeasurement): boolean {
  return measured.triangles > measured.budget.triangles || measured.bytes > measured.budget.bytes;
}
