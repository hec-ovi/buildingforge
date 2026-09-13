import { ExteriorError } from '../core/errors.ts';
import { edgeDir, edgeLength } from '../core/polygon.ts';
import { PlateGrid } from '../layout/buildingGrid.ts';
import { clearHeight } from '../rules/proportions.ts';
import type { BuildingRequest, Floor, RoomEnvelope } from '../types.ts';

/** Fits room rectangles behind the shell and the complete opening movement depth. */
export class RoomEnvelopes {
  private readonly grid: PlateGrid;
  private readonly fitted = new Map<string, Omit<RoomEnvelope, 'vertical'>>();

  constructor(request: BuildingRequest) {
    this.grid = new PlateGrid(request.parcel.footprint, request.parcel.buildingGrid);
  }

  forFloor(floor: Floor, wallDepth: number): RoomEnvelope {
    const clearance = floor.openings.reduce((depth, opening) => Math.max(depth,
      wallDepth + (opening.door?.motion.clearDepth ?? opening.portal?.clearDepth ?? 0),
      opening.glazing?.housingBackDepth ?? 0, opening.door?.cassette?.backDepth ?? 0), wallDepth);
    const key = JSON.stringify([floor.outline, clearance]);
    let horizontal = this.fitted.get(key);
    if (!horizontal) {
      const corners = this.grid.fit(floor.outline, clearance, () => true);
      if (!corners) throw new ExteriorError('E_INVARIANT', 'floor has no rectangular room envelope behind its openings', {
        floor: floor.index, clearance,
      });
      horizontal = {
        corners, origin: corners[0]!, axisU: edgeDir(corners, 0), axisV: edgeDir(corners, 1),
        width: edgeLength(corners, 0), depth: edgeLength(corners, 1), grid: this.grid.grid,
      };
      this.fitted.set(key, horizontal);
    }
    return { ...horizontal, vertical: { min: floor.elevation, max: floor.elevation + clearHeight(floor.height) } };
  }
}
