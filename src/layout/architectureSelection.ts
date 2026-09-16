import policy from '../../schemas/architecture-policy.json' with { type: 'json' };
import { Rng } from '../core/rng.ts';
import { FAMILY } from '../rules/families.ts';
import { SectionAssembler, type Architecture } from '../sections/index.ts';
import { isFamilyArchitecture } from '../families/registry.ts';
import type { ArchitectureSelection, BuildingRequest } from '../types.ts';

/** Seeded architecture order, filtered by the complete family plate and fixed-face contract. */
export function architectureSelections(request: BuildingRequest): ArchitectureSelection[] {
  const ordinary = (reason: ArchitectureSelection['reason']): ArchitectureSelection => ({ requested: 'auto', selected: 'ordinary', reason });
  if (request.building.floors < policy.minimumFloors || !policy.families.includes(FAMILY[request.building.type])) return [ordinary('programme')];
  const o = request.options;
  if (o?.balconies === 'on' || o?.doorMotion === 'pocket' || o?.openFront === 'on' || o?.entranceLayout === 'repeated'
    || o?.windows === 'none' || o?.windowDamage === 'sparse' || o?.facadeServices === 'on'
    || o?.shape && !['auto', 'box'].includes(o.shape)
    || request.parcel.buildingGrid && Math.abs(request.parcel.buildingGrid.spacing - 0.5) > 1e-9) return [ordinary('explicit-options')];
  const choices: ArchitectureSelection[] = [];
  if (policy.luxuryTiers.includes(request.building.tier) && request.parcel.footprint.length === 4) {
    const fixed = (request.apertures ?? []).some(a => a.base >= 0);
    const ranked = policy.luxuryArchitectures.map(({ id, weight }) => ({
      id: id as Architecture, score: -Math.log(Math.max(Number.MIN_VALUE, new Rng(request.seed, `architecture:${id}`).range(0, 1))) / weight,
    })).sort((a, b) => a.score - b.score);
    const assembler = new SectionAssembler();
    for (const { id } of ranked) {
      if (fixed && !isFamilyArchitecture(id)) continue;
      try {
        assembler.assemble({ architecture: id, rectangle: request.parcel.footprint as [[number, number], [number, number], [number, number], [number, number]],
          floorHeights: Array(request.building.floors).fill(4.5), seed: request.seed, fixedFaces: fixed });
        choices.push({ requested: 'auto', selected: id, reason: 'accepted-reference' });
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    }
  }
  if (request.apertures?.length) return [...choices, ordinary('fixed-faces')];
  if (new Rng(request.seed, 'architecture-selection').chance(policy.roundedCornerChance)) choices.push({ requested: 'auto', selected: 'rounded-corner', reason: 'accepted-reference' });
  return [...choices, ordinary('seeded-ordinary')];
}
