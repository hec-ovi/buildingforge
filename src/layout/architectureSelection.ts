import policy from '../../schemas/architecture-policy.json' with { type: 'json' };
import { Rng } from '../core/rng.ts';
import { FAMILY } from '../rules/families.ts';
import type { ArchitectureSelection, BuildingRequest } from '../types.ts';

/** Automatic selection admits the reviewed rounded recipe or ordinary glazing. */
export function architectureSelection(request: BuildingRequest): ArchitectureSelection {
  const ordinary = (reason: ArchitectureSelection['reason']): ArchitectureSelection => ({ requested: 'auto', selected: 'ordinary', reason });
  if (request.apertures?.length) return ordinary('fixed-faces');
  if (request.building.floors < policy.minimumFloors || !policy.families.includes(FAMILY[request.building.type])) return ordinary('programme');
  const o = request.options;
  if (o?.balconies === 'on' || o?.doorMotion === 'pocket' || o?.openFront === 'on' || o?.entranceLayout === 'repeated'
    || o?.windows === 'none' || o?.windowDamage === 'sparse' || o?.facadeServices === 'on'
    || o?.shape && !['auto', 'box'].includes(o.shape)
    || request.parcel.buildingGrid && Math.abs(request.parcel.buildingGrid.spacing - 0.5) > 1e-9) return ordinary('explicit-options');
  return new Rng(request.seed, 'architecture-selection').chance(policy.roundedCornerChance)
    ? { requested: 'auto', selected: 'rounded-corner', reason: 'accepted-reference' }
    : ordinary('seeded-ordinary');
}
