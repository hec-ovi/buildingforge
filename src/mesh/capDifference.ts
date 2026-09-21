import type { P2 } from '../core/polygon.ts';

type Edge = [P2, P2];
type Interval = [Edge, Edge];
const EPS = 1e-8;
const edges = (ring: P2[]): Edge[] => ring.map((point, i) => [point, ring[(i + 1) % ring.length]!]);
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const subtract = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const at = ([a, b]: Edge, x: number) => a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);

/**
 * Exact polygon difference as disjoint trapezoids. A terrace's upper outline
 * touches its lower outline, so it is not an interior hole that Earcut can bridge.
 * Between consecutive vertices/intersections every boundary is a straight edge.
 */
export function capDifference(ring: P2[], hole: P2[]): P2[][] {
  const outside = edges(ring), inside = edges(hole);
  const breaks = [...ring, ...hole].map(point => point[0]);
  for (const [a, b] of outside) for (const [c, d] of inside) {
    const u = subtract(b, a), v = subtract(d, c), delta = subtract(c, a);
    const determinant = cross(u, v);
    if (Math.abs(determinant) < EPS) continue;
    const t = cross(delta, v) / determinant, s = cross(delta, u) / determinant;
    if (t >= -EPS && t <= 1 + EPS && s >= -EPS && s <= 1 + EPS) breaks.push(a[0] + t * u[0]);
  }
  breaks.sort((a, b) => a - b);
  const columns = breaks.filter((x, i) => i === 0 || x - breaks[i - 1]! > EPS);
  const intervals = (boundary: Edge[], x: number): Interval[] => {
    const crossings = boundary.filter(([a, b]) => x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]))
      .sort((a, b) => at(a, x) - at(b, x));
    const result: Interval[] = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      if (at(crossings[i + 1]!, x) - at(crossings[i]!, x) > EPS) result.push([crossings[i]!, crossings[i + 1]!]);
    }
    return result;
  };
  const pieces: P2[][] = [];
  for (let i = 0; i + 1 < columns.length; i++) {
    const left = columns[i]!, right = columns[i + 1]!, middle = (left + right) / 2;
    const cuts = intervals(inside, middle);
    const emit = (low: Edge, high: Edge) => pieces.push([
      [left, at(low, left)], [right, at(low, right)], [right, at(high, right)], [left, at(high, left)],
    ]);
    for (const [low, high] of intervals(outside, middle)) {
      let cursor = low;
      const top = at(high, middle);
      for (const [bottomCut, topCut] of cuts) {
        const from = at(bottomCut, middle), to = at(topCut, middle), current = at(cursor, middle);
        if (to <= current + EPS) continue;
        if (from >= top - EPS) break;
        if (from > current + EPS) emit(cursor, bottomCut);
        if (to >= top - EPS) { cursor = high; break; }
        cursor = topCut;
      }
      if (top - at(cursor, middle) > EPS) emit(cursor, high);
    }
  }
  return pieces;
}
