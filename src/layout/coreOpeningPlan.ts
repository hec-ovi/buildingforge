import { ExteriorError } from '../core/errors.ts';
import { buildOpeningMesh, type OpeningLayout } from '../mesh/mesher.ts';
import { measureWallDepth } from '../mesh/wallDepth.ts';
import type { MeshBuilder } from '../mesh/primitives.ts';
import type { Blueprint } from '../types.ts';
import { crossingWindows, withoutWindows } from './circulationBand.ts';
import { coreAdjacency } from './coreAdjacency.ts';
import { fitBuildingCore, type CoreStairPlacement } from './corePreflight.ts';
import { commercialCoreCandidates } from './commercialFacade.ts';
import type { FloorLayout } from './model.ts';

interface OpeningCorePlan {
  floors: FloorLayout[];
  mesh: MeshBuilder;
  stair: CoreStairPlacement;
}

/** Rounds of giving up windows before the plate is refused outright. */
const CIRCULATION_ROUNDS = 3;

/** Fit actual glazing and the shared core together before facade attachments. */
export function planCoreOpenings(layout: OpeningLayout, coreFrame: Blueprint['coreFrame']): OpeningCorePlan {
  const policy = coreAdjacency(layout.request);
  const measure = (floors: FloorLayout[]): OpeningCorePlan & { reservation: number } => {
    const candidate = { ...layout, floors };
    const mesh = buildOpeningMesh(candidate);
    const reservation = measureWallDepth(candidate, mesh);
    const { stair } = fitBuildingCore({
      buildingId: layout.request.buildingId, floors, ...(coreFrame ? { coreFrame } : {}),
      facade: { style: layout.style.facade.kind, wallDepth: reservation, coreAdjacency: policy },
    });
    return { floors, mesh, stair, reservation };
  };
  // A window the core stands behind keeps no corridor in front of it, so the
  // plan gives that window up and fits the core again on the floors that are left.
  const clearCirculation = (floors: FloorLayout[]): OpeningCorePlan => {
    let fitted = measure(floors);
    for (let round = 0; ; round++) {
      const crossing = crossingWindows(fitted.floors, fitted.stair, fitted.reservation, policy);
      if (!crossing.size) return fitted;
      if (round === CIRCULATION_ROUNDS) {
        throw new ExteriorError('E_CORE_PLATE', 'no shared core fits (opening_reservations)',
          { blocker: 'opening_reservations', openings: [...crossing].slice(0, 8) });
      }
      fitted = measure(withoutWindows(fitted.floors, crossing));
    }
  };
  let failure: ExteriorError;
  try {
    return clearCirculation(layout.floors);
  } catch (error) {
    if (!openingFitFailure(error)) throw error;
    failure = error;
  }
  if (layout.request.options?.architecture) throw failure;
  for (const floors of commercialCoreCandidates(layout.request, layout.floors, layout.style)) {
    try {
      return clearCirculation(floors);
    } catch (error) {
      if (!openingFitFailure(error)) throw error;
    }
  }
  throw failure;
}

function openingFitFailure(error: unknown): error is ExteriorError {
  return error instanceof ExteriorError && error.code === 'E_CORE_PLATE'
    && error.details?.blocker === 'opening_reservations';
}
