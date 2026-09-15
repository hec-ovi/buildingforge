import type { FacadeField, FloorLayout, ModelInstance } from '../api.ts';
import { entryRibOffsets } from './dimensions.ts';
import { intersects, type Reservation } from './reservations.ts';

/** Existing ornamental trees occupy alternate side bays within the reserved frontage. */
export function treeInstances(floor: FloorLayout, field: FacadeField, clearance: number,
  reserved: Reservation[]): ModelInstance[] {
  const result: ModelInstance[] = [];
  const ribs = entryRibOffsets(field.length);
  const crown = Math.min(2.1, clearance - 0.30);
  const height = 6;
  const depth = crown / 2 + 0.15;
  for (let i = 0; i + 1 < ribs.length; i += 2) {
    const u = (ribs[i]! + ribs[i + 1]!) / 2;
    if (Math.abs(u - field.length / 2) < 2 + crown / 2 + 0.3) continue;
    const area = { u0: u - crown / 2 - 0.15, u1: u + crown / 2 + 0.15,
      y0: floor.elevation, y1: floor.elevation + height };
    if (intersects(area, reserved)) continue;
    result.push({ kind: 'ornamental-tree', position: field.point(u, floor.elevation, depth),
      size: [crown, height, crown], rotation: -Math.atan2(field.dir[1], field.dir[0]) });
  }
  return result;
}
