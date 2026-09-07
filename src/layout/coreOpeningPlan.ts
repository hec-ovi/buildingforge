import { ExteriorError } from '../core/errors.ts';
import { buildOpeningMesh, type OpeningLayout } from '../mesh/mesher.ts';
import { measureWallDepth } from '../mesh/wallDepth.ts';
import type { MeshBuilder } from '../mesh/primitives.ts';
import type { Blueprint } from '../types.ts';
import { coreAdjacency } from './coreAdjacency.ts';
import { fitBuildingCore, type CoreStairPlacement } from './corePreflight.ts';
import { commercialCoreCandidates } from './commercialFacade.ts';
import type { FloorLayout } from './model.ts';

interface OpeningCorePlan {
  floors: FloorLayout[];
  mesh: MeshBuilder;
  stair: CoreStairPlacement;
}

/** Fit actual glazing and the shared core together before facade attachments. */
export function planCoreOpenings(layout: OpeningLayout, coreFrame: Blueprint['coreFrame']): OpeningCorePlan {
  const measure = (floors: FloorLayout[]): OpeningCorePlan => {
    const candidate = { ...layout, floors };
    const mesh = buildOpeningMesh(candidate);
    const stair = fitBuildingCore({
      buildingId: layout.request.buildingId, floors, ...(coreFrame ? { coreFrame } : {}),
      facade: { style: layout.style.facade.kind, wallDepth: measureWallDepth(candidate, mesh),
        coreAdjacency: coreAdjacency(layout.request) },
    });
    return { floors, mesh, stair };
  };
  let failure: ExteriorError;
  try {
    return measure(layout.floors);
  } catch (error) {
    if (!openingFitFailure(error)) throw error;
    failure = error;
  }
  for (const floors of commercialCoreCandidates(layout.request, layout.floors, layout.style)) {
    try {
      return measure(floors);
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
