// The core rectangle a plate has to host. The interior lays its stairs, lifts
// and risers in one rectangle on the plate behind the facade; these are its own
// published sizes with half a metre of snap slack, so the massing can pick a box
// the interior can core instead of the assembler finding out later.

import { readFileSync } from 'node:fs';
import { CORE_PLATE } from '../rules/tables.ts';
import type { P2 } from '../core/polygon.ts';

export interface CoreRect {
  /** along the core's axis, the longest ground edge */
  length: number;
  /** across it, behind the facade */
  depth: number;
  mode: string;
}

/** Interior core rectangles, its own numbers (../interior/schemas/core-feasibility.json). */
const CORE_RECTS = {
  walkup: { length: 9.4, depth: 8, mode: 'walkup' },
  walkupTwoStairs: { length: 15.9, depth: 8, mode: 'walkup with two stairs' },
  compact: { length: 10.4, depth: 12, mode: 'compact lift core' },
  standard: { length: 18.4, depth: 8, mode: 'standard lift core' },
} as const;

/**
 * The interior snaps its core positions onto a half metre, so a plate that only
 * just holds a rectangle can lose it to rounding. The massing aims a snap wider
 * than the bare number; the check that names a hopeless lot uses the bare one,
 * so no plate the interior would take is ever refused here.
 */
const SNAP = 0.5;

function grow(rect: CoreRect, slack: number): CoreRect {
  return { length: rect.length + slack, depth: rect.depth + slack, mode: rect.mode };
}

interface Constants {
  twoStairsAreaOver: number;
  twoStairsFloorsOver: number;
  walkupMaxFloors: number;
  facadeDepth: Record<string, number>;
}

const CONSTANTS = readConstants();

function readConstants(): Constants {
  try {
    const c = JSON.parse(readFileSync(
      new URL('../../../interior/schemas/core-feasibility.json', import.meta.url), 'utf8')).constants;
    return {
      twoStairsAreaOver: c.twoStairsAreaOver,
      twoStairsFloorsOver: c.twoStairsFloorsOver,
      walkupMaxFloors: c.walkupMaxFloors,
      facadeDepth: c.facadeDepth,
    };
  } catch {
    return { twoStairsAreaOver: 460, twoStairsFloorsOver: 4, walkupMaxFloors: 6, facadeDepth: {} };
  }
}

/** How far behind the outline skin the plate starts, by facade style. */
export function facadeDepth(style: string): number {
  return CONSTANTS.facadeDepth[style] ?? CONSTANTS.facadeDepth.panel ?? CORE_PLATE.lining;
}

/**
 * The rectangles that would serve this building, best first. A building past
 * the walkup floor cap needs a lift, so only the lift cores serve it; below the
 * cap a stair core does, two stairs where the floor count or the ground area
 * calls for them.
 */
export function coreRects(aboveGroundFloors: number, groundArea: number, aim = false): CoreRect[] {
  const slack = aim ? SNAP : 0;
  const lifts = [CORE_RECTS.standard, CORE_RECTS.compact];
  if (aboveGroundFloors > CONSTANTS.walkupMaxFloors) return lifts.map((r) => grow(r, slack));
  const two = groundArea > CONSTANTS.twoStairsAreaOver || aboveGroundFloors > CONSTANTS.twoStairsFloorsOver;
  const stair = two ? CORE_RECTS.walkupTwoStairs : CORE_RECTS.walkup;
  return [stair, ...lifts].map((r) => grow(r, slack));
}

/**
 * The largest rectangle on this plate, in the core's frame: the depth is what
 * the strip test allows and the length the longest run inside it. A plate is
 * measured at the depth asked for, since a shallow plate can be long and a deep
 * one short.
 */
export function plateBand(outline: P2[], axis: P2, inset: number, depth: number): number {
  const uv = outline.map(([x, z]): P2 => [x * axis[0] + z * axis[1], z * axis[0] - x * axis[1]]);
  let vMin = Infinity, vMax = -Infinity;
  for (const [, v] of uv) { vMin = Math.min(vMin, v); vMax = Math.max(vMax, v); }
  const lo = vMin + inset, hi = vMax - inset;
  if (hi - lo < depth) return 0;

  let best = 0;
  const step = 0.5;
  for (let v0 = lo; v0 <= hi - depth + 1e-9; v0 += step) {
    // Every level of the strip has to be inside the plate, so a notch between
    // two levels cannot be counted as core room.
    let runs = chords(uv, v0, inset);
    for (let v = v0 + step; v < v0 + depth - 1e-9 && runs.length > 0; v += step) {
      runs = intersect(runs, chords(uv, v, inset));
    }
    if (runs.length > 0) runs = intersect(runs, chords(uv, v0 + depth, inset));
    for (const [a, b] of runs) best = Math.max(best, b - a);
  }
  return best;
}

/** Whether the plate hosts any of the rectangles, and the best band it reached. */
export function bestCoreFit(
  outline: P2[], axis: P2, inset: number, rects: readonly CoreRect[],
): { fits: CoreRect | null; reached: { band: number; rect: CoreRect } } {
  let reached = { band: -1, rect: rects[0]! };
  for (const rect of rects) {
    const band = plateBand(outline, axis, inset, rect.depth);
    if (band >= rect.length - 1e-9) return { fits: rect, reached: { band, rect } };
    if (band > reached.band) reached = { band, rect };
  }
  return { fits: null, reached };
}

/** The u-runs inside the plate at height v, each pulled in by the facade inset. */
function chords(uv: P2[], v: number, inset: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0; i < uv.length; i++) {
    const [u1, v1] = uv[i] as P2;
    const [u2, v2] = uv[(i + 1) % uv.length] as P2;
    if ((v1 > v) === (v2 > v)) continue;
    xs.push(u1 + ((v - v1) / (v2 - v1)) * (u2 - u1));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const a = (xs[i] as number) + inset, b = (xs[i + 1] as number) - inset;
    if (b > a) out.push([a, b]);
  }
  return out;
}

function intersect(a: [number, number][], b: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a0, a1] of a) {
    for (const [b0, b1] of b) {
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
      if (hi > lo) out.push([lo, hi]);
    }
  }
  return out;
}
