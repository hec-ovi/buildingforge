// Subtract the union of convex opening polygons from one facade floor band.
// Strip boundaries include vertices and crossings, so each remaining edge is linear.

export interface Hole { poly: [number, number][] }
export interface WallPiece {
  /** Corners in face coordinates, CCW as U right and Y up. */
  bl: [number, number]; br: [number, number]; tr: [number, number]; tl: [number, number];
}

type Point = [number, number];
interface Interval { low: [number, number]; high: [number, number] }
const EPSILON = 1e-9;

export function cutWall(length: number, y0: number, y1: number, holes: Hole[]): WallPiece[] {
  const bounded = holes.map(h => ({ poly: h.poly, minU: Math.min(...h.poly.map(p => p[0])), maxU: Math.max(...h.poly.map(p => p[0])) }))
    .filter(h => h.maxU > EPSILON && h.minU < length - EPSILON
      && Math.min(...h.poly.map(p => p[1])) < y1 - EPSILON && Math.max(...h.poly.map(p => p[1])) > y0 + EPSILON);
  const breaks = new Set<number>([0, length]);
  const addBreak = (u: number) => { if (u > EPSILON && u < length - EPSILON) breaks.add(u); };
  const segments = bounded.flatMap(h => h.poly.map((a, i) => [a, h.poly[(i + 1) % h.poly.length]!] as [Point, Point]));
  for (const [a, b] of segments) {
    addBreak(a[0]);
    for (const y of [y0, y1]) if ((a[1] - y) * (b[1] - y) < 0) addBreak(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
  }
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const crossing = intersection(segments[i]!, segments[j]!);
    if (crossing !== undefined) addBreak(crossing);
  }
  const us = [...breaks].sort((a, b) => a - b);
  const pieces: WallPiece[] = [];
  for (let i = 1; i < us.length; i++) {
    const left = us[i - 1]!, right = us[i]!, middle = (left + right) / 2;
    if (right - left < EPSILON) continue;
    const intervals: Interval[] = bounded.filter(h => middle > h.minU && middle < h.maxU).map(h => {
      const [lo0, hi0] = yRangeAt(h.poly, left), [lo1, hi1] = yRangeAt(h.poly, right);
      return { low: [clamp(lo0, y0, y1), clamp(lo1, y0, y1)], high: [clamp(hi0, y0, y1), clamp(hi1, y0, y1)] };
    });
    intervals.sort((a, b) => a.low[0] + a.low[1] - b.low[0] - b.low[1]);
    const union: Interval[] = [];
    for (const interval of intervals) {
      const previous = union.at(-1);
      if (previous && interval.low[0] + interval.low[1] <= previous.high[0] + previous.high[1] + EPSILON) {
        previous.high = [Math.max(previous.high[0], interval.high[0]), Math.max(previous.high[1], interval.high[1])];
      } else union.push(interval);
    }
    let bottom: [number, number] = [y0, y0];
    const emit = (top: [number, number]) => {
      if (top[0] > bottom[0] + EPSILON || top[1] > bottom[1] + EPSILON) pieces.push({
        bl: [left, bottom[0]], br: [right, bottom[1]], tr: [right, top[1]], tl: [left, top[0]],
      });
    };
    for (const interval of union) { emit(interval.low); bottom = interval.high; }
    emit([y1, y1]);
  }
  return pieces;
}

/** Horizontal coordinate of a proper segment crossing; vertices already supply their own breaks. */
function intersection([a, b]: [Point, Point], [c, d]: [Point, Point]): number | undefined {
  const x = b[0] - a[0], y = b[1] - a[1], u = d[0] - c[0], v = d[1] - c[1];
  const denominator = x * v - y * u;
  if (Math.abs(denominator) < EPSILON) return undefined;
  const t = ((c[0] - a[0]) * v - (c[1] - a[1]) * u) / denominator;
  const s = ((c[0] - a[0]) * y - (c[1] - a[1]) * x) / denominator;
  return t > EPSILON && t < 1 - EPSILON && s > EPSILON && s < 1 - EPSILON ? a[0] + x * t : undefined;
}

function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)); }

/** Lower and upper boundaries of a convex polygon at one vertical line. */
function yRangeAt(poly: Point[], u: number): [number, number] {
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    if (Math.abs(a[0] - b[0]) < EPSILON) {
      if (Math.abs(a[0] - u) < EPSILON) { low = Math.min(low, a[1], b[1]); high = Math.max(high, a[1], b[1]); }
      continue;
    }
    const t = (u - a[0]) / (b[0] - a[0]);
    if (t < -EPSILON || t > 1 + EPSILON) continue;
    const y = a[1] + (b[1] - a[1]) * t;
    low = Math.min(low, y); high = Math.max(high, y);
  }
  return low === Infinity ? [0, 0] : [low, high];
}

export function rectHole(u0: number, y0: number, width: number, height: number): Hole {
  return { poly: [[u0, y0], [u0 + width, y0], [u0 + width, y0 + height], [u0, y0 + height]] };
}
