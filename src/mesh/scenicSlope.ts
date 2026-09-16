import type { FloorLayout } from '../layout/model.ts';
import type { P2 } from '../types.ts';
import type { V3 } from './primitives.ts';
import { slopePoint } from './floorSlope.ts';

/** Fit the mouth to a tapered facade while preserving each room's inward depth. */
export function scenicSlope(floor: FloorLayout, mouth: V3, normal: P2): (point: V3) => V3 {
  if (!floor.topOutline) return point => point;
  return point => {
    const depth = (point[0] - mouth[0]) * normal[0] + (point[2] - mouth[2]) * normal[1];
    const projected: V3 = [point[0] - normal[0] * depth, point[1], point[2] - normal[1] * depth];
    const fitted = slopePoint(floor, projected);
    return [fitted[0] + normal[0] * depth, fitted[1], fitted[2] + normal[1] * depth];
  };
}
