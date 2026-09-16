import type { FamilyInput, Point } from '../api.ts';
import { BODY_MARGIN, FIXED_FRONT, WINDOW_CELL, fittedLength } from './dimensions.ts';

export function fit(input: FamilyInput): { outline: Point[]; width: number; depth: number; inset: number } {
  const r = input.rectangle;
  if (r.length !== 4 || r.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw new RangeError('Corporate sectors require a finite rectangle.');
  const x: Point = [r[1][0] - r[0][0], r[1][1] - r[0][1]];
  const z: Point = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
  const w = Math.hypot(...x), d = Math.hypot(...z);
  if (x[0] * z[1] - x[1] * z[0] <= 0 || Math.abs(x[0] * z[0] + x[1] * z[1]) > 1e-6 * w * d || Math.hypot(r[2][0] - r[1][0] - z[0], r[2][1] - r[1][1] - z[1]) > 1e-6) throw new RangeError('Corporate sectors require four CCW rectangle corners.');
  const width = fittedLength(w - BODY_MARGIN * 2);
  const depth = 17 + WINDOW_CELL * Math.floor((d - BODY_MARGIN * 2 - 17 + 1e-8) / WINDOW_CELL);
  if (width < FIXED_FRONT + WINDOW_CELL || depth < 17) throw new RangeError('Corporate sectors require a 28 x 17 m body and a 3.5 m perimeter for attached details.');
  if (input.fixedFaces) return { outline: r.map(p => [...p]), width: w, depth: d, inset: BODY_MARGIN };
  const left = (w - width) / 2, near = (d - depth) / 2;
  const point = (u: number, v: number): Point => [r[0][0] + x[0] * u / w + z[0] * v / d, r[0][1] + x[1] * u / w + z[1] * v / d];
  return { width, depth, inset: 0, outline: [point(left, near), point(left + width, near), point(left + width, near + depth), point(left, near + depth)] };
}
