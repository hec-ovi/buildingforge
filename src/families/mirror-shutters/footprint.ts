import type { FamilyInput, Point } from '../api.ts';
import { DIMENSIONS as D } from './dimensions.ts';

export interface Footprint { outline: Point[]; width: number; depth: number }

/** Complete bays fit a centred shell; bound faces remain byte-for-byte identical. */
export function footprint(input: FamilyInput): Footprint {
  const r = input.rectangle;
  if (r.length !== 4 || r.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) {
    throw new RangeError('mirror-shutters requires four finite rectangle corners');
  }
  const origin = r[0];
  const a: Point = [r[1][0] - origin[0], r[1][1] - origin[1]];
  const b: Point = [r[3][0] - origin[0], r[3][1] - origin[1]];
  const maxWidth = Math.hypot(...a), maxDepth = Math.hypot(...b);
  if (a[0] * b[1] - a[1] * b[0] <= 0 ||
    Math.abs(a[0] * b[0] + a[1] * b[1]) > 1e-7 * maxWidth * maxDepth ||
    Math.hypot(r[2][0] - origin[0] - a[0] - b[0], r[2][1] - origin[1] - a[1] - b[1]) > 1e-7) {
    throw new RangeError('mirror-shutters requires a CCW rectangle');
  }
  const fit = (maximum: number, minimum: number) => input.fixedFaces ? maximum :
    minimum + D.room * Math.floor((maximum - 2 * D.frontageReserve - minimum + 1e-8) / D.room);
  const width = fit(maxWidth, D.minimumWidth), depth = fit(maxDepth, D.minimumDepth);
  if (width < D.minimumWidth || depth < D.minimumDepth) {
    throw new RangeError('mirror-shutters requires a 24 by 14 m shell and 2.5 m attachment clearance on free faces');
  }
  if (input.fixedFaces) return { outline: r.map(p => [...p] as Point), width, depth };
  const startU = (maxWidth - width) / 2, startV = (maxDepth - depth) / 2;
  const point = (u: number, v: number): Point => [origin[0] + a[0] * (u + startU) / maxWidth + b[0] * (v + startV) / maxDepth,
    origin[1] + a[1] * (u + startU) / maxWidth + b[1] * (v + startV) / maxDepth];
  return { outline: [point(0, 0), point(width, 0), point(width, depth), point(0, depth)], width, depth };
}
