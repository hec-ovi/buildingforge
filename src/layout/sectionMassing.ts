import { isFamilyArchitecture } from '../families/registry.ts';
import { SectionAssembler, isPaired, type Assembly } from '../sections/index.ts';
import { PlateGrid } from './buildingGrid.ts';
import { ExteriorError } from '../core/errors.ts';
import type { P2 } from '../core/polygon.ts';
import type { BuildingRequest } from '../types.ts';
import type { Massing } from './massing.ts';

export function buildSectionMassing(request: BuildingRequest, heights: readonly number[], accept: (outlines: P2[][]) => boolean): Massing {
  const architecture = request.options?.architecture;
  if (!architecture || architecture === 'auto') throw new ExteriorError('E_INVARIANT', 'architecture selection must resolve before section fitting');
  const grid = new PlateGrid(request.parcel.footprint, request.parcel.buildingGrid);
  const assembler = new SectionAssembler();
  let assembly: Assembly | undefined;
  let reason = 'no complete facade assembly fits the parcel';
  const custom = isFamilyArchitecture(architecture);
  const fixedFaces = custom && !!request.apertures?.some(a => a.base >= 0 || a.base + a.height > 0);
  if (fixedFaces && request.parcel.footprint.length !== 4) throw new ExteriorError('E_SCHEMA', 'family aperture faces require a rectangular parcel');
  const reserve = custom ? 0 : request.options!.architecture === 'terrace-blocks' ? 1.5 : request.options!.architecture === 'chamfered-corners' ? 1 : 0.5;
  const fit = (rectangle: P2[]) => {
    try {
      const candidate = assembler.assemble({ architecture,
        rectangle: rectangle as [P2, P2, P2, P2], seed: request.seed, fixedFaces, floorHeights: heights.slice(-(request.building.floors)) });
      if (!accept(candidate.floors.flatMap(f => f.topOutline ? [f.outline, f.topOutline] : [f.outline]))) { reason = 'the complete facade assembly cannot retain the shared circulation core'; return false; }
      assembly = candidate;
      return true;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      reason = error.message;
      return false;
    }
  };
  if (fixedFaces) {
    if (!fit(request.parcel.footprint) && reason === 'available plate must be a CCW rectangle') throw new ExteriorError('E_SCHEMA', 'family aperture faces require a rectangular parcel');
  } else grid.fit(request.parcel.footprint, reserve, fit);
  if (!assembly) throw new ExteriorError('E_CORE_PLATE', reason);
  const fitted = assembly;
  return { groundOutline: fitted.floors[0]!.outline, outlineOf: floor => floor < 0 && (isPaired(architecture) || custom)
    ? request.parcel.footprint : fitted.floors[Math.max(0, floor)]!.outline,
    rectangular: true, assembly: fitted };
}
