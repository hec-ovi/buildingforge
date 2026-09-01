// 2D polygon math on [x, z] rings, CCW, first point not repeated.
// Only exactly-rounded float ops (+ - * / sqrt): deterministic across JS engines.

export type P2 = [number, number];

export function signedArea(poly: P2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i] as P2;
    const [x2, z2] = poly[(i + 1) % poly.length] as P2;
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/** CCW on the XZ ground plane seen from +Y (atlas convention). */
export function isCCW(poly: P2[]): boolean {
  return signedArea(poly) < 0;
}

export function ensureCCW(poly: P2[]): P2[] {
  return isCCW(poly) ? poly : [...poly].reverse();
}

export function area(poly: P2[]): number {
  return Math.abs(signedArea(poly));
}

export function perimeter(poly: P2[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i] as P2;
    const [x2, z2] = poly[(i + 1) % poly.length] as P2;
    p += Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  }
  return p;
}

export function centroid(poly: P2[]): P2 {
  let cx = 0, cz = 0, aSum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i] as P2;
    const [x2, z2] = poly[(i + 1) % poly.length] as P2;
    const cross = x1 * z2 - x2 * z1;
    aSum += cross;
    cx += (x1 + x2) * cross;
    cz += (z1 + z2) * cross;
  }
  if (aSum === 0) {
    const n = poly.length;
    let sx = 0, sz = 0;
    for (const [x, z] of poly) { sx += x; sz += z; }
    return [sx / n, sz / n];
  }
  return [cx / (3 * aSum), cz / (3 * aSum)];
}

export function edgeLength(poly: P2[], i: number): number {
  const [x1, z1] = poly[i] as P2;
  const [x2, z2] = poly[(i + 1) % poly.length] as P2;
  return Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
}

/** Unit direction of edge i (vertex i to i+1). */
export function edgeDir(poly: P2[], i: number): P2 {
  const [x1, z1] = poly[i] as P2;
  const [x2, z2] = poly[(i + 1) % poly.length] as P2;
  const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  return [(x2 - x1) / len, (z2 - z1) / len];
}

/**
 * Unit outward normal of edge i, independent of ring orientation: the candidate
 * is flipped until a point nudged off the edge midpoint lies outside the ring.
 * This is the defense against the inverted-normal failure mode.
 */
export function edgeNormal(poly: P2[], i: number): P2 {
  const [dx, dz] = edgeDir(poly, i);
  const n: P2 = [-dz, dx];
  const [x1, z1] = poly[i] as P2;
  const [x2, z2] = poly[(i + 1) % poly.length] as P2;
  const mid: P2 = [(x1 + x2) / 2, (z1 + z2) / 2];
  const eps = Math.min(0.01, edgeLength(poly, i) * 0.01);
  const probe: P2 = [mid[0] + n[0] * eps, mid[1] + n[1] * eps];
  if (pointInPolygon(poly, probe)) return [-n[0], -n[1]];
  return n;
}

export function pointInPolygon(poly: P2[], p: P2): boolean {
  const [px, pz] = p;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i] as P2;
    const [xj, zj] = poly[j] as P2;
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function isConvex(poly: P2[]): boolean {
  const n = poly.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i] as P2;
    const [bx, bz] = poly[(i + 1) % n] as P2;
    const [cx, cz] = poly[(i + 2) % n] as P2;
    const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

export function selfIntersects(poly: P2[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
      if (segmentsCross(poly[i] as P2, poly[(i + 1) % n] as P2, poly[j] as P2, poly[(j + 1) % n] as P2)) return true;
    }
  }
  return false;
}

function segmentsCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o = (p: P2, q: P2, r: P2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * Inset a convex CCW-from-above ring by distance d (miter offset toward the interior).
 * Returns null when the inset collapses (offset edges no longer form a valid ring).
 */
export function insetConvex(poly: P2[], d: number): P2[] | null {
  const n = poly.length;
  const lines: { px: number; pz: number; dx: number; dz: number }[] = [];
  for (let i = 0; i < n; i++) {
    const [dx, dz] = edgeDir(poly, i);
    const [nx, nz] = edgeNormal(poly, i);
    const [x, z] = poly[i] as P2;
    lines.push({ px: x - nx * d, pz: z - nz * d, dx, dz });
  }
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n]!;
    const b = lines[i]!;
    const det = a.dx * b.dz - a.dz * b.dx;
    if (Math.abs(det) < 1e-12) {
      out.push([b.px, b.pz]);
      continue;
    }
    const t = ((b.px - a.px) * b.dz - (b.pz - a.pz) * b.dx) / det;
    out.push([a.px + a.dx * t, a.pz + a.dz * t]);
  }
  const sIn = signedArea(poly);
  const sOut = signedArea(out);
  if (sIn * sOut <= 0 || Math.abs(sOut) >= Math.abs(sIn) || Math.abs(sOut) < 1e-6) return null;
  for (const p of out) if (!pointInPolygon(poly, p)) return null;
  return out;
}

/** Oriented bounding rectangle via rotating over polygon edges (no trig, exact vector math). */
export function orientedBoundingBox(poly: P2[]): { center: P2; axisU: P2; axisV: P2; halfU: number; halfV: number } {
  let best: { center: P2; axisU: P2; axisV: P2; halfU: number; halfV: number; areaVal: number } | null = null;
  for (let i = 0; i < poly.length; i++) {
    const u = edgeDir(poly, i);
    const v: P2 = [-u[1], u[0]];
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, z] of poly) {
      const pu = x * u[0] + z * u[1];
      const pv = x * v[0] + z * v[1];
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const areaVal = (maxU - minU) * (maxV - minV);
    if (!best || areaVal < best.areaVal) {
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = {
        center: [u[0] * cu + v[0] * cv, u[1] * cu + v[1] * cv],
        axisU: u,
        axisV: v,
        halfU: (maxU - minU) / 2,
        halfV: (maxV - minV) / 2,
        areaVal,
      };
    }
  }
  const { center, axisU, axisV, halfU, halfV } = best!;
  return { center, axisU, axisV, halfU, halfV };
}

/** Quantize to the layout grid (0.05 m) with exactly representable arithmetic. */
export function quant(v: number): number {
  return Math.round(v * 20) / 20;
}
