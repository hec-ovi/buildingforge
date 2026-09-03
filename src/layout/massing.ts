// Massing: the per-floor outline function. Shapes beyond the parcel box are
// generated parametrically inside the parcel's oriented bounding box; any face
// carrying an aperture forces the parcel footprint verbatim so face indexes and
// planes stay exact (connections convention). Every plate above the ground
// keeps the depth a core needs across the core's axis, or the massing takes no
// setback there.

import { Rng } from '../core/rng.ts';
import {
  area, insetConvex, isConvex, orientedBoundingBox, ringInsidePolygon, edgeLength, quant, type P2,
} from '../core/polygon.ts';
import type { BuildingRequest } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import { CORE_PLATE, FACADE } from '../rules/tables.ts';
import { MIN_PLATE_DEPTH, coreAxis, plateDepth } from './plate.ts';
import { bestCoreFit, coreRects } from './core.ts';

// 16-gon unit ring, precomputed so no trig runs at generation time.
const RING16: P2[] = [
  [1, 0], [0.9238795325112867, 0.3826834323650898], [0.7071067811865476, 0.7071067811865476],
  [0.3826834323650898, 0.9238795325112867], [0, 1], [-0.3826834323650898, 0.9238795325112867],
  [-0.7071067811865476, 0.7071067811865476], [-0.9238795325112867, 0.3826834323650898], [-1, 0],
  [-0.9238795325112867, -0.3826834323650898], [-0.7071067811865476, -0.7071067811865476],
  [-0.3826834323650898, -0.9238795325112867], [0, -1], [0.3826834323650898, -0.9238795325112867],
  [0.7071067811865476, -0.7071067811865476], [0.9238795325112867, -0.3826834323650898],
];

export type Shape = 'box' | 'octagon' | 'cylinder' | 'pyramid' | 'setback';

export interface Massing {
  /** outline per above-ground floor index (0..floors-1); basements reuse outline 0 */
  outlineOf(floor: number): P2[];
  groundOutline: P2[];
}

export function buildMassing(
  req: BuildingRequest, family: Family, tier: Tier, balconyInset: number, facadeInset: number,
  floorHeights: readonly number[],
): Massing {
  const rng = new Rng(req.seed, 'massing');
  const parcel = req.parcel.footprint;
  const floors = req.building.floors;
  const hasApertures = (req.apertures ?? []).length > 0;
  // Every plate has to host the interior's core rectangle; the massing picks a
  // box that does rather than leaving the assembler to find out it cannot.
  const rects = coreRects(floorHeights, floors, area(parcel), true);
  const holdsCore = (ring: P2[], axis?: P2) =>
    bestCoreFit([ring], axis ?? coreAxis(ring), facadeInset, rects, axis === undefined).fits !== null;

  let shape = (req.options?.shape ?? 'auto') as Shape | 'auto';
  if (hasApertures) {
    // Walls must sit on parcel segments; prism on the parcel, no shape play.
    shape = 'box';
  } else if (shape === 'auto') {
    shape = pickShape(rng, family, tier, floors);
  }

  // Balconies protrude beyond the outline but must stay inside the parcel.
  const needInset = balconyInset > 0 && !hasApertures;
  const base = baseOutline(shape, parcel, rng, needInset ? balconyInset + 0.1 : 0, hasApertures, holdsCore);

  if (shape === 'setback' && floors >= 8) {
    const axis = bestCoreFit([base], coreAxis(base), facadeInset, rects).axis;
    const t1 = Math.max(2, Math.round(floors * rng.range(0.3, 0.45)));
    const t2 = Math.max(t1 + 2, Math.round(floors * rng.range(0.65, 0.8)));
    const mid = stepIn(base, axis, rng, holdsCore);
    const top = mid ? stepIn(mid, axis, rng, holdsCore) : null;
    if (mid) {
      return {
        groundOutline: base,
        outlineOf: (f) => (top && f >= t2 ? top : f >= t1 ? mid : base),
      };
    }
  }

  if (shape === 'pyramid' && floors >= 4) {
    // Ziggurat: the outline steps inward every floor, vertical walls, terrace
    // rings, and stops stepping where the next plate would lose its core.
    const axis = bestCoreFit([base], coreAxis(base), facadeInset, rects).axis;
    const steps: P2[][] = [base];
    let current = base;
    const totalInset = Math.min(minHalfWidth(base) * 0.8, floors * 1.2, coreRoom(base, axis));
    const per = quant(Math.max(0.4, totalInset / floors));
    for (let f = 1; f < floors; f++) {
      const next = isConvex(current) ? insetConvex(current, per) : null;
      if (!next || !holdsCore(next, axis)) break;
      steps.push(next);
      current = next;
    }
    return {
      groundOutline: base,
      outlineOf: (f) => steps[Math.min(f, steps.length - 1)] as P2[],
    };
  }

  return { groundOutline: base, outlineOf: () => base };
}

/** The inset a plate can take and still hold a core behind its walls. */
function coreRoom(ring: P2[], axis: P2): number {
  return (plateDepth(ring, axis) - MIN_PLATE_DEPTH) / 2;
}

/** One setback in from a convex plate, as deep as still leaves a core, or none. */
function stepIn(ring: P2[], axis: P2, rng: Rng, holdsCore: (ring: P2[], axis?: P2) => boolean): P2[] | null {
  if (!isConvex(ring)) return null;
  const [min, max] = CORE_PLATE.setback;
  const cap = Math.floor(Math.min(max, coreRoom(ring, axis)) * 20) / 20;
  if (cap < min) return null;
  const wanted = quant(rng.range(min, cap));
  for (let d = wanted; d >= min - 1e-9; d = quant(d - 0.5)) {
    const next = insetConvex(ring, d);
    if (next && holdsCore(next, axis)) return next;
  }
  return null;
}

function pickShape(rng: Rng, family: Family, tier: Tier, floors: number): Shape {
  if (family === 'industrial' || family === 'commerce' || family === 'security' || family === 'hospital') return 'box';
  if (family === 'corpo' || family === 'office') {
    if (floors >= 12) {
      const shapes: Shape[] = ['box', 'setback', 'octagon', 'cylinder', 'pyramid'];
      const weights = [0.35, 0.35, 0.18, 0.09, tier === 'high_rich' ? 0.03 : 0];
      return rng.pick(shapes, weights);
    }
    return rng.pick(['box', 'octagon'] as Shape[], [0.8, 0.2]);
  }
  // residential, hotel
  if (floors >= 10) return rng.pick(['box', 'setback', 'cylinder'] as Shape[], [0.6, 0.3, 0.1]);
  return 'box';
}

function baseOutline(
  shape: Shape, parcel: P2[], rng: Rng, inset: number, keepParcel: boolean,
  holdsCore: (ring: P2[], axis?: P2) => boolean,
): P2[] {
  // A face carrying an aperture has to sit on its parcel segment, so that
  // building takes the parcel verbatim, slivers and all.
  if (keepParcel) return clone(parcel);

  // Whole panels corner to corner: a box's sides are whole wall panels, so no
  // face ends on a cut tile and every rib stands on a painted joint. A shape
  // that leaves no core falls back to the box, and a parcel that holds no such
  // box keeps its own outline.
  const boxed = (): P2[] => {
    const snapped = fitRing(parcel, rng, (hu, hv) => rect(onPanel(hu), onPanel(hv)), inset, holdsCore);
    if (snapped) return snapped;
    if (inset > 0) return (isConvex(parcel) ? insetConvex(parcel, inset) : null) ?? clone(parcel);
    return clone(parcel);
  };

  if (shape === 'octagon') {
    return fitRing(parcel, rng, (hu, hv) => octagon(hu, hv, Math.min(hu, hv) * rng.range(0.3, 0.5)), inset, holdsCore)
      ?? boxed();
  }
  if (shape === 'cylinder') {
    return fitRing(parcel, rng, (hu, hv) => {
      const radius = Math.min(hu, hv);
      return RING16.map(([x, z]) => [x * radius, z * radius] as P2);
    }, inset, holdsCore) ?? boxed();
  }
  return boxed();
}

/** Half a side, snapped down so the whole side is a whole number of wall panels. */
function onPanel(half: number): number {
  const panels = Math.floor((2 * half) / FACADE.panel.width + 1e-9);
  return (Math.max(1, panels) * FACADE.panel.width) / 2;
}

function clone(ring: P2[]): P2[] {
  return ring.map((p) => [...p] as P2);
}

/** Place a parametric ring (built in OBB-local coords) inside the parcel; null when no scale fits. */
function fitRing(
  parcel: P2[], rng: Rng, make: (halfU: number, halfV: number) => P2[], inset: number,
  accept: (ring: P2[]) => boolean = () => true,
): P2[] | null {
  const obb = orientedBoundingBox(parcel);
  const margin = inset > 0 ? inset : 0.2;
  for (let scale = 1; scale >= 0.3; scale = quant(scale - 0.05)) {
    const hu = (obb.halfU - margin) * scale;
    const hv = (obb.halfV - margin) * scale;
    if (hu < 2 || hv < 2) break;
    const local = make(hu, hv);
    const world = local.map(([u, v]): P2 => [
      obb.center[0] + obb.axisU[0] * u + obb.axisV[0] * v,
      obb.center[1] + obb.axisU[1] * u + obb.axisV[1] * v,
    ]);
    if (ringInsidePolygon(parcel, world) && accept(world)) return world;
  }
  return null;
}

function rect(hu: number, hv: number): P2[] {
  return [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]];
}

function octagon(hu: number, hv: number, cut: number): P2[] {
  return [
    [-hu + cut, -hv], [hu - cut, -hv], [hu, -hv + cut], [hu, hv - cut],
    [hu - cut, hv], [-hu + cut, hv], [-hu, hv - cut], [-hu, -hv + cut],
  ];
}

function minHalfWidth(ring: P2[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, edgeLength(ring, i));
  return best / 2;
}
