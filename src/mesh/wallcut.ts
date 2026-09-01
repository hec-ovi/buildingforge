// Wall band with openings, built by trapezoid decomposition: vertical strips
// between the u-coordinates of every hole vertex, wall pieces below and above
// the hole in each strip. Shared strip-line vertices make the result watertight
// with no T-junctions; a diagonal cut polygon is reproduced exactly because its
// boundary is linear between breakpoints.

export interface Hole {
  /** polygon in face coords [u, yAbs]; convex, or a rectangle */
  poly: [number, number][];
}

export interface WallPiece {
  /** corners in face coords, CCW as (u right, y up): bl, br, tr, tl */
  bl: [number, number]; br: [number, number]; tr: [number, number]; tl: [number, number];
}

export function cutWall(length: number, y0: number, y1: number, holes: Hole[]): WallPiece[] {
  const eps = 1e-9;
  const bounded = holes
    .map((h) => ({ poly: h.poly, minU: Math.min(...h.poly.map((p) => p[0])), maxU: Math.max(...h.poly.map((p) => p[0])) }))
    .filter((h) => h.maxU > eps && h.minU < length - eps)
    .filter((h) => Math.min(...h.poly.map((p) => p[1])) < y1 - eps && Math.max(...h.poly.map((p) => p[1])) > y0 + eps);

  const breaks = new Set<number>([0, length]);
  for (const h of bounded) for (const [u] of h.poly) if (u > eps && u < length - eps) breaks.add(u);
  const us = [...breaks].sort((a, b) => a - b);

  const pieces: WallPiece[] = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const u0 = us[i] as number;
    const u1 = us[i + 1] as number;
    if (u1 - u0 < eps) continue;
    const um = (u0 + u1) / 2;
    const hole = bounded.find((h) => um > h.minU && um < h.maxU);
    if (!hole) {
      // Full-height strip: bottom edge flat at y0, top edge flat at y1.
      pieces.push(piece(u0, u1, y0, y0, y1, y1));
      continue;
    }
    const [lo0, hi0] = yRangeAt(hole.poly, u0);
    const [lo1, hi1] = yRangeAt(hole.poly, u1);
    // Below the hole.
    const b0 = clamp(lo0, y0, y1), b1 = clamp(lo1, y0, y1);
    if (b0 > y0 + eps || b1 > y0 + eps) {
      pieces.push({ bl: [u0, y0], br: [u1, y0], tr: [u1, b1], tl: [u0, b0] });
    }
    // Above the hole.
    const t0 = clamp(hi0, y0, y1), t1 = clamp(hi1, y0, y1);
    if (t0 < y1 - eps || t1 < y1 - eps) {
      pieces.push({ bl: [u0, t0], br: [u1, t1], tr: [u1, y1], tl: [u0, y1] });
    }
  }
  return pieces;
}

function piece(u0: number, u1: number, b0: number, b1: number, t0: number, t1: number): WallPiece {
  return { bl: [u0, b0], br: [u1, b1], tr: [u1, t1], tl: [u0, t0] };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** [lowest, highest] boundary y of a convex polygon at vertical line u (clamped into the polygon's u-range). */
function yRangeAt(poly: [number, number][], u: number): [number, number] {
  const minU = Math.min(...poly.map((p) => p[0]));
  const maxU = Math.max(...poly.map((p) => p[0]));
  const x = clamp(u, minU, maxU);
  let lo = Infinity, hi = -Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = poly[i] as [number, number];
    const [bx, by] = poly[(i + 1) % n] as [number, number];
    if (ax === bx) {
      if (Math.abs(ax - x) < 1e-9) { lo = Math.min(lo, ay, by); hi = Math.max(hi, ay, by); }
      continue;
    }
    const t = (x - ax) / (bx - ax);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const y = ay + (by - ay) * t;
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  if (lo === Infinity) return [0, 0];
  return [lo, hi];
}

/** Rectangle hole helper for doors. */
export function rectHole(u0: number, y0: number, w: number, h: number): Hole {
  return { poly: [[u0, y0], [u0 + w, y0], [u0 + w, y0 + h], [u0, y0 + h]] };
}
