import type { Point } from '../api.ts';

/** Reports self-crossings or nonadjacent touching edges in a contract result. */
export function intersections(outline: Point[]): [number, number][] {
  const found: [number, number][] = [];
  for (let i = 0; i < outline.length; i++) for (let j = i + 1; j < outline.length; j++) {
    if (j === i + 1 || i === 0 && j === outline.length - 1) continue;
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
    const c = outline[j]!, d = outline[(j + 1) % outline.length]!;
    const cross = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const on = (p: Point, q: Point, r: Point) => Math.abs(cross(p, q, r)) < 1e-7 &&
      r[0] >= Math.min(p[0], q[0]) - 1e-7 && r[0] <= Math.max(p[0], q[0]) + 1e-7 &&
      r[1] >= Math.min(p[1], q[1]) - 1e-7 && r[1] <= Math.max(p[1], q[1]) + 1e-7;
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 ||
      on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)) found.push([i, j]);
  }
  return found;
}
