import type { Point } from '../api.ts';
import { dimensions } from './dimensions.ts';

function distance(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}

/** A square corner moves sqrt(2) times the face depth; reserve that full movement. */
export function relief(outline: Point[], parcel: Point[]): number {
  let clearance = Infinity;
  for (let i = 0; i < outline.length; i++) for (let j = 0; j < parcel.length; j++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
    const p = parcel[j]!, q = parcel[(j + 1) % parcel.length]!;
    clearance = Math.min(clearance, distance(a, p, q), distance(b, p, q), distance(p, a, b), distance(q, a, b));
  }
  return Math.min(dimensions.relief, clearance / Math.SQRT2);
}
