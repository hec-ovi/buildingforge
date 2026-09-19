import type { Blueprint, P2 } from '../types.ts';
import { coreFeasibility, type Blueprint as InteriorBlueprint, type CoreFeasibility } from '../../../interior/dist/feasibility.js';
import { ExteriorError } from '../core/errors.ts';

export type CoreStairPlacement = NonNullable<CoreFeasibility['placement']>['stairA'];

export interface CoreFit {
  /** standard: lift core in the shaft row. compact: stair columns behind the corridor. walkup: one stair, no lift. */
  mode: Exclude<CoreFeasibility['mode'], 'none'>;
  /** lift cars the fitted plate carries; a walkup core carries none */
  maxElevators: number;
  stair: CoreStairPlacement;
}

export function constructionCoreFrame(axis: P2, rectangular: boolean): Blueprint['coreFrame'] {
  if (!rectangular) return undefined;
  const angle = ((Math.atan2(axis[1], axis[0]) * 180 / Math.PI) % 180 + 180) % 180;
  return { anglesDeg: [angle, (angle + 90) % 180] };
}

type CoreInput = Pick<Blueprint, 'buildingId' | 'floors' | 'coreFrame'> & {
  facade: Pick<Blueprint['facade'], 'style' | 'wallDepth' | 'coreAdjacency'>;
  roof?: Blueprint['roof'];
};

/** Interior's verdict on the published plate: the core it fits, or the closed refusal. */
export function fitBuildingCore(blueprint: CoreInput): CoreFit {
  const input: InteriorBlueprint = {
    buildingId: blueprint.buildingId,
    ...(blueprint.coreFrame ? { coreFrame: blueprint.coreFrame } : {}),
    facade: { ...blueprint.facade },
    ...(blueprint.roof ? { roof: { bulkhead: blueprint.roof.bulkhead, elevation: blueprint.roof.elevation } } : {}),
    floors: blueprint.floors.map((floor) => ({ ...floor, openings: floor.openings.map((opening) => ({
      ...opening,
      door: opening.door ? { ...opening.door, motion: { ...opening.door.motion } } : undefined,
    })) })),
  };
  let result: CoreFeasibility;
  try {
    result = coreFeasibility(input);
  } catch (error) {
    throw new ExteriorError('E_INVARIANT', 'Interior rejected the generated core constraints', {
      cause: error instanceof Error ? error.message : String(error),
      coreFrame: input.coreFrame, bulkhead: input.roof?.bulkhead,
    });
  }
  if (!result.fits) {
    const failure = result.adjacencyFailure;
    const detail = failure
      ? `: floor ${failure.floor} opening ${failure.opening} needs ${failure.requiredDepth} m ${failure.role} depth, has ${failure.availableDepth} m`
      : '';
    throw new ExteriorError('E_CORE_PLATE', `no shared core fits (${result.blocker})${detail}`, { ...result });
  }
  if (!result.placement || result.mode === 'none') {
    throw new ExteriorError('E_INVARIANT', 'Interior core feasibility returned no fitted stair');
  }
  return { mode: result.mode, maxElevators: result.maxElevators, stair: result.placement.stairA };
}
