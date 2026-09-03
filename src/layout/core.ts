// Exterior-side preflight for the vertical core. All dimensions come from the
// interior's published schema; this module deliberately imports no interior
// implementation code.

import { CORE_PLATE } from '../rules/tables.ts';
import { pointInPolygon, type P2 } from '../core/polygon.ts';
import { CORE_CONSTANTS } from './coreFeasibility.ts';

export interface CoreRect {
  /** required run along the core frame */
  length: number;
  /** minimum plate depth across the core frame */
  depth: number;
  mode: 'standard lift core' | 'compact lift core' | 'walkup' | 'walkup with two stairs';
  /** full depth of compact stair columns behind the corridor face */
  columnDepth?: number;
}

const CONSTANTS = CORE_CONSTANTS;

/** How far behind the outline skin the interior plate starts, by facade style. */
export function facadeDepth(style: string): number {
  return CONSTANTS.facadeDepth[style] ?? CONSTANTS.facadeDepth.panel ?? CORE_PLATE.lining;
}

/**
 * Core choices for these exact storey climbs. The order matches interior:
 * standard, compact, then a stair-only walkup where its floor cap permits it.
 */
export function coreRects(
  floorHeights: readonly number[], aboveGroundFloors: number, groundArea: number, aim = false,
): CoreRect[] {
  const stairDepth = stairShaftDepth(floorHeights);
  const two = groundArea > CONSTANTS.twoStairsAreaOver || aboveGroundFloors > CONSTANTS.twoStairsFloorsOver;
  const rowFixed = stairDepth + CONSTANTS.riserShaft + CONSTANTS.serviceStub
    + (two ? stairDepth : 0) + CONSTANTS.margin;
  const compactFixed = CONSTANTS.stairColumnWidth * (two ? 2 : 1)
    + CONSTANTS.riserShaft + CONSTANTS.serviceStub + CONSTANTS.margin;
  const slack = aim ? CONSTANTS.snap : 0;
  const crossDepth = CONSTANTS.minStripDepth + CONSTANTS.corridorWidth + CONSTANTS.elevatorShaft;
  const walkupMode = two ? 'walkup with two stairs' : 'walkup';
  const out: CoreRect[] = [
    { length: rowFixed + CONSTANTS.elevatorShaft + slack, depth: crossDepth + slack, mode: 'standard lift core' },
    {
      length: compactFixed + CONSTANTS.elevatorShaft + slack,
      depth: CONSTANTS.minStripDepth + CONSTANTS.corridorWidth + stairDepth + slack,
      columnDepth: stairDepth + slack,
      mode: 'compact lift core',
    },
  ];
  if (aboveGroundFloors <= CONSTANTS.walkupMaxFloors) {
    out.push({ length: rowFixed + slack, depth: crossDepth + slack, mode: walkupMode });
  }
  return out;
}

/** Deepest flight needed by a one- or adjacent-two-storey climb. */
function stairShaftDepth(floorHeights: readonly number[]): number {
  const climbs = [...floorHeights];
  for (let i = 0; i + 1 < floorHeights.length; i++) climbs.push(floorHeights[i]! + floorHeights[i + 1]!);
  let worst = 0;
  for (const climb of climbs) {
    const idealCount = climb / CONSTANTS.stairRiserIdeal;
    const flights = 2 * Math.ceil(idealCount / (2 * CONSTANTS.maxRisersPerFlight));
    const low = Math.ceil(climb / CONSTANTS.stairRiserMax - 1e-9);
    const high = Math.floor(climb / CONSTANTS.stairRiserMin + 1e-9);
    let total: number | null = null;
    for (let count = low; count <= high; count++) {
      if (count % flights !== 0) continue;
      if (total === null || Math.abs(count - idealCount) < Math.abs(total - idealCount)) total = count;
    }
    const resolved = total ?? Math.max(flights, Math.round(idealCount / flights) * flights);
    worst = Math.max(worst, resolved / flights);
  }
  return Math.round(Math.ceil((worst * CONSTANTS.stairTread + 2 * CONSTANTS.stairLanding
    + CONSTANTS.wallThickness) / 0.1 - 1e-9) * 0.1 * 1000) / 1000;
}

interface Band {
  u0: number;
  u1: number;
  vFace: number;
}

interface FrameFit {
  fits: CoreRect | null;
  reached: { band: number; rect: CoreRect };
  axis: P2;
}

/**
 * Longest shared run in a fixed-depth strip. Kept exported for geometry tests;
 * normal callers use bestCoreFit, which also enforces the room strip and modes.
 */
export function plateBand(outlines: readonly P2[][], axis: P2, inset: number, depth: number): number {
  const uv = outlines.map((outline) => project(outline, axis));
  const ground = bounds(uv[0]!);
  let best = 0;
  const lo = snapUp(ground.v0 + inset);
  const hi = snapDown(ground.v1 - inset - depth);
  for (let v = lo; v <= hi + 1e-9; v += CONSTANTS.snap) {
    const band = fullCoverage(uv, v, v + depth, inset);
    best = Math.max(best, band.u1 - band.u0);
  }
  return best;
}

/** Whether all floors share one core placement, including rotated fallback frames. */
export function bestCoreFit(
  outlines: readonly P2[][], principalAxis: P2, inset: number, rects: readonly CoreRect[], sweep = true,
): FrameFit {
  const first = fitFrame(outlines, normalize(principalAxis), inset, rects);
  if (first.fits || !sweep) return first;

  let best = first;
  let bestRank = Infinity;
  const base = Math.atan2(principalAxis[1], principalAxis[0]);
  for (let deg = CONSTANTS.frameSweepStepDeg; deg < 180; deg += CONSTANTS.frameSweepStepDeg) {
    const a = base + deg * Math.PI / 180;
    const fit = fitFrame(outlines, [Math.cos(a), Math.sin(a)], inset, rects);
    if (!fit.fits) {
      if (fit.reached.band > best.reached.band) best = fit;
      continue;
    }
    const rank = modeRank(fit.fits) * 1000 - Math.min(999, fit.reached.band);
    if (rank < bestRank) {
      bestRank = rank;
      best = fit;
    }
    if (fit.fits.mode === 'standard lift core') break;
  }
  return best;
}

function fitFrame(outlines: readonly P2[][], axis: P2, inset: number, rects: readonly CoreRect[]): FrameFit {
  const uv = outlines.map((outline) => project(outline, axis));
  const ground = bounds(uv[0]!);
  const usableDepth = ground.v1 - ground.v0 - 2 * inset;
  const ideal = usableDepth < CONSTANTS.singleLoadedBelowDepth
    ? snapDown(ground.v1 - inset - CONSTANTS.elevatorShaft)
    : snap((ground.v0 + ground.v1 + CONSTANTS.corridorWidth) / 2);
  const vMin = snapUp(ground.v0 + inset + CONSTANTS.minStripDepth + CONSTANTS.corridorWidth);
  const vMax = snapDown(ground.v1 - inset - CONSTANTS.elevatorShaft);
  const candidates: number[] = [];
  for (let offset = 0; offset <= CONSTANTS.vFaceScanRange + 1e-9; offset += CONSTANTS.snap) {
    for (const v of offset === 0 ? [ideal] : [ideal - offset, ideal + offset]) {
      if (v >= vMin - 1e-9 && v <= vMax + 1e-9 && !candidates.includes(v)) candidates.push(v);
    }
  }

  const bands = candidates.map((vFace): Band => {
    const run = fullCoverage(uv, vFace - CONSTANTS.corridorWidth, vFace + CONSTANTS.elevatorShaft, inset);
    return { ...run, vFace };
  });
  const bestBand = bands.reduce((best, band) => band.u1 - band.u0 > best.u1 - best.u0 ? band : best,
    { u0: 0, u1: 0, vFace: ideal });
  let reached = { band: Math.max(0, bestBand.u1 - bestBand.u0), rect: rects[0]! };

  for (const rect of rects) {
    for (const band of bands) {
      const length = band.u1 - band.u0;
      if (length < rect.length - 1e-9) continue;
      if (rect.columnDepth && !compactFits(uv, band, rect, inset)) continue;
      return { fits: rect, reached: { band: length, rect }, axis };
    }
    if (bestBand.u1 - bestBand.u0 > reached.band) reached = { band: bestBand.u1 - bestBand.u0, rect };
  }
  return { fits: null, reached, axis };
}

function compactFits(uv: readonly P2[][], band: Band, rect: CoreRect, inset: number): boolean {
  const u0 = Math.max(snapUp(band.u0), snap(band.u0 + (band.u1 - band.u0 - rect.length) / 2));
  return uv.every((outline) => rectInside(outline, u0, band.vFace, rect.length, rect.columnDepth!, inset));
}

/** Interior-equivalent 0.5 m cell scan for the longest full-coverage run. */
function fullCoverage(uv: readonly P2[][], v0: number, v1: number, inset: number): { u0: number; u1: number } {
  let lo = -Infinity, hi = Infinity;
  for (const outline of uv) {
    const b = bounds(outline);
    lo = Math.max(lo, b.u0 + inset);
    hi = Math.min(hi, b.u1 - inset);
  }
  lo = snapUp(lo);
  hi = snapDown(hi);
  if (hi - lo < CONSTANTS.snap - 1e-9) return { u0: lo, u1: lo };

  let runStart = lo;
  let best: [number, number] = [lo, lo];
  for (let u = lo; u < hi - 1e-9; u += CONSTANTS.snap) {
    const width = Math.min(CONSTANTS.snap, hi - u);
    const covered = uv.every((outline) => rectInside(outline, u, v0, width, v1 - v0, inset));
    if (!covered) {
      if (u - runStart > best[1] - best[0]) best = [runStart, u];
      runStart = u + width;
    }
  }
  if (hi - runStart > best[1] - best[0]) best = [runStart, hi];
  return { u0: best[0], u1: best[1] };
}

/** Whole rectangle inside the outline and at least inset from every boundary segment. */
function rectInside(outline: readonly P2[], u: number, v: number, width: number, depth: number, inset: number): boolean {
  if (width <= 0 || depth <= 0) return false;
  const corners: P2[] = [[u, v], [u + width, v], [u + width, v + depth], [u, v + depth]];
  if (!corners.every((p) => pointInPolygon(outline as P2[], p))) return false;
  const inset2 = (inset - 1e-7) ** 2;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    for (let j = 0; j < outline.length; j++) {
      const c = outline[j]!;
      const d = outline[(j + 1) % outline.length]!;
      if (segmentsProperlyCross(a, b, c, d)) return false;
      if (segmentDistanceSq(a, b, c, d) < inset2) return false;
    }
  }
  return true;
}

function segmentDistanceSq(a: P2, b: P2, c: P2, d: P2): number {
  if (segmentsProperlyCross(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistanceSq(a, c, d), pointSegmentDistanceSq(b, c, d),
    pointSegmentDistanceSq(c, a, b), pointSegmentDistanceSq(d, a, b),
  );
}

function pointSegmentDistanceSq(p: P2, a: P2, b: P2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  const x = p[0] - a[0] - dx * t;
  const z = p[1] - a[1] - dz * t;
  return x * x + z * z;
}

function segmentsProperlyCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o = (p: P2, q: P2, r: P2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function project(outline: readonly P2[], axis: P2): P2[] {
  return outline.map(([x, z]) => [x * axis[0] + z * axis[1], -x * axis[1] + z * axis[0]]);
}

function bounds(outline: readonly P2[]): { u0: number; u1: number; v0: number; v1: number } {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [u, v] of outline) {
    u0 = Math.min(u0, u); u1 = Math.max(u1, u);
    v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  return { u0, u1, v0, v1 };
}

function snap(value: number): number {
  return Math.round(value / CONSTANTS.snap) * CONSTANTS.snap;
}

function snapDown(value: number): number {
  return Math.floor(value / CONSTANTS.snap + 1e-9) * CONSTANTS.snap;
}

function snapUp(value: number): number {
  return Math.ceil(value / CONSTANTS.snap - 1e-9) * CONSTANTS.snap;
}

function normalize([x, z]: P2): P2 {
  const d = Math.hypot(x, z) || 1;
  return [x / d, z / d];
}

function modeRank(rect: CoreRect): number {
  if (rect.mode === 'standard lift core') return 0;
  if (rect.mode === 'compact lift core') return 1;
  return 2;
}
