import source from '../../schemas/floor-constants.json' with { type: 'json' };
import { PROPORTIONS } from './proportions.ts';
import { FEASIBILITY, type Family } from './families.ts';
import { ExteriorError } from '../core/errors.ts';

export const GENERATION_POLICY = source.generationPolicy;

/** One active clear-height policy for nominal, pinned and underground floors. */
export function minimumFloorHeight(family: Family, override?: number): number {
  const policy = GENERATION_POLICY;
  if (Math.abs(policy.defaultFloorHeight - policy.defaultClearHeight - policy.clearHeightAllowance) > 1e-9
    || Math.abs(policy.clearHeightAllowance - PROPORTIONS.clearHeightAllowance) > 1e-9) {
    throw new ExteriorError('E_INVARIANT', 'floor policy and published slab/ceiling allowance disagree');
  }
  const minimum = Math.max(FEASIBILITY[family].minFloorHeight, (override ?? policy.defaultClearHeight) + policy.clearHeightAllowance);
  if (minimum > FEASIBILITY[family].maxFloorHeight + 1e-9) {
    throw new ExteriorError('E_SCHEMA', 'minimumClearHeight plus the slab/ceiling zone exceeds the family maximum floor height');
  }
  return minimum;
}
