// Per-floor construction-grid plates. Explicit curved forms occupy fitted grid
// rectangles; aperture-bound parcels retain exact source faces. Each setback
// preserves the shared vertical core.

import { Rng } from '../core/rng.ts';
import {
  area, isConvex, edgeDir, edgeLength, type P2,
} from '../core/polygon.ts';
import type { BuildingRequest } from '../types.ts';
import { CORE_PLATE } from '../rules/tables.ts';
import { MIN_PLATE_DEPTH, coreAxis, plateDepth } from './plate.ts';
import { bestCoreFit, coreRects } from './core.ts';
import { roundedOutline } from './roundedOutline.ts';
import { PlateGrid } from './buildingGrid.ts';
import { ExteriorError } from '../core/errors.ts';
import { fitPlateCore } from './plateCore.ts';

// 16-gon unit ring, precomputed so no trig runs at generation time.
const RING16: P2[] = [
  [1, 0], [0.9238795325112867, 0.3826834323650898], [0.7071067811865476, 0.7071067811865476],
  [0.3826834323650898, 0.9238795325112867], [0, 1], [-0.3826834323650898, 0.9238795325112867],
  [-0.7071067811865476, 0.7071067811865476], [-0.9238795325112867, 0.3826834323650898], [-1, 0],
  [-0.9238795325112867, -0.3826834323650898], [-0.7071067811865476, -0.7071067811865476],
  [-0.3826834323650898, -0.9238795325112867], [0, -1], [0.3826834323650898, -0.9238795325112867],
  [0.7071067811865476, -0.7071067811865476], [0.9238795325112867, -0.3826834323650898],
];

export type Shape = 'box' | 'rounded-box' | 'octagon' | 'cylinder' | 'pyramid' | 'setback';

export interface Massing {
  /** outline per above-ground floor index (0..floors-1); basements reuse outline 0 */
  outlineOf(floor: number): P2[];
  groundOutline: P2[];
  /** Rectangular plates keep the vertical core parallel to their construction axes. */
  rectangular: boolean;
}

export function buildMassing(
  req: BuildingRequest, balconyInset: number, facadeInset: number, preferredCoreInset: number,
  floorHeights: readonly number[],
): Massing {
  const rng = new Rng(req.seed, 'massing');
  const parcel = req.parcel.footprint;
  const floors = req.building.floors;
  const hasApertures = (req.apertures ?? []).length > 0;
  const rectangular = !hasApertures && (!req.options?.shape || ['auto', 'box', 'setback', 'pyramid'].includes(req.options.shape));
  // Every plate has to host the interior's core rectangle; the massing picks a
  // box that does rather than leaving the assembler to find out it cannot.
  const rects = coreRects(floorHeights, floors, area(parcel));
  const holdsCore = (ring: P2[], axis?: P2, inset = preferredCoreInset) => {
    const choices = coreRects(floorHeights, floors, area(ring));
    if (area(ring) < Math.min(...choices.map((r) => (r.length + 2 * inset) * (r.depth + 2 * inset)))) return false;
    return fitPlateCore([ring], inset, choices, rectangular, axis).fits !== null;
  };

  let shape = (req.options?.shape ?? 'auto') as Shape | 'auto';
  if (hasApertures) {
    // Walls must sit on parcel segments; prism on the parcel, no shape play.
    shape = 'box';
  } else if (shape === 'auto') {
    shape = 'box';
  }

  // Balconies protrude beyond the outline but must stay inside the parcel.
  const needInset = balconyInset > 0 && !hasApertures;
  const grid = new PlateGrid(parcel, req.parcel.buildingGrid);
  // A perimeter allowance is sufficient for adjacency, but exact opening spans
  // can admit a core on a narrower complete plate. The shared solver checks it.
  const base = baseOutline(shape, parcel, rng, needInset ? balconyInset + 0.1 : 0, hasApertures, holdsCore, grid)
    ?? grid.fit(parcel, 0, (ring) => holdsCore(ring, undefined, facadeInset));
  if (!base) {
    const { reached } = bestCoreFit([parcel], coreAxis(parcel), facadeInset, rects);
    throw new ExteriorError('E_CORE_PLATE',
      `no complete construction-grid rectangle fits the parcel and its ${reached.rect.length} x ${reached.rect.depth} m ${reached.rect.mode}`,
      { band: reached.band, needs: [reached.rect.length, reached.rect.depth], mode: reached.rect.mode });
  }
  const sharedRects = coreRects(floorHeights, floors, area(base));
  const holdsStackCore = (ring: P2[], axis?: P2) =>
    fitPlateCore([base, ring], preferredCoreInset, sharedRects, rectangular, axis).fits !== null;

  if (shape === 'setback' && floors >= 8) {
    const axis = fitPlateCore([base], facadeInset, sharedRects, rectangular).axis;
    const t1 = Math.max(2, Math.round(floors * rng.range(0.3, 0.45)));
    const t2 = Math.max(t1 + 2, Math.round(floors * rng.range(0.65, 0.8)));
    const mid = stepIn(base, axis, rng, holdsStackCore, grid);
    const top = mid ? stepIn(mid, axis, rng, holdsStackCore, grid) : null;
    if (mid) {
      return {
        groundOutline: base, rectangular,
        outlineOf: (f) => (top && f >= t2 ? top : f >= t1 ? mid : base),
      };
    }
  }

  if (shape === 'pyramid' && floors >= 4) {
    // Ziggurat: the outline steps inward every floor, vertical walls, terrace
    // rings, and stops stepping where the next plate would lose its core.
    const axis = fitPlateCore([base], facadeInset, sharedRects, rectangular).axis;
    const steps: P2[][] = [base];
    let current = base;
    const totalInset = Math.min(minHalfWidth(base) * 0.8, floors * 1.2, coreRoom(base, axis));
    const per = Math.max(grid.grid.spacing, Math.floor(totalInset / floors / grid.grid.spacing) * grid.grid.spacing);
    for (let f = 1; f < floors; f++) {
      const next = grid.inset(current, per);
      if (!next || !holdsStackCore(next, axis)) break;
      steps.push(next);
      current = next;
    }
    return {
      groundOutline: base, rectangular,
      outlineOf: (f) => steps[Math.min(f, steps.length - 1)] as P2[],
    };
  }

  return { groundOutline: base, outlineOf: () => base, rectangular };
}

/** The inset a plate can take and still hold a core behind its walls. */
function coreRoom(ring: P2[], axis: P2): number {
  return (plateDepth(ring, axis) - MIN_PLATE_DEPTH) / 2;
}

/** One setback in from a convex plate, as deep as still leaves a core, or none. */
function stepIn(ring: P2[], axis: P2, rng: Rng, holdsCore: (ring: P2[], axis?: P2) => boolean, grid: PlateGrid): P2[] | null {
  if (!isConvex(ring)) return null;
  const [min, max] = CORE_PLATE.setback;
  const spacing = grid.grid.spacing;
  const cap = Math.floor(Math.min(max, coreRoom(ring, axis)) / spacing) * spacing;
  if (cap < min) return null;
  const wanted = Math.max(Math.ceil(min / spacing) * spacing, Math.floor(rng.range(min, cap) / spacing) * spacing);
  for (let d = wanted; d >= min - 1e-9; d -= spacing) {
    const next = grid.inset(ring, d);
    if (next && holdsCore(next, axis)) return next;
  }
  return null;
}

function baseOutline(
  shape: Shape, parcel: P2[], rng: Rng, inset: number, keepParcel: boolean,
  holdsCore: (ring: P2[], axis?: P2) => boolean, grid: PlateGrid,
): P2[] | null {
  // A face carrying an aperture has to sit on its parcel segment, so that
  // building takes the parcel verbatim, slivers and all.
  if (keepParcel) return clone(parcel);

  const boxed = (): P2[] | null => grid.fit(parcel, inset, holdsCore)
    ?? (inset > 0 ? grid.fit(parcel, 0, holdsCore) : null);

  if (shape === 'octagon') {
    const cutShare = rng.range(0.3, 0.5);
    return fitRing(parcel, grid, (hu, hv) => octagon(hu, hv, Math.min(hu, hv) * cutShare), inset, holdsCore)
      ?? boxed();
  }
  if (shape === 'rounded-box') {
    const radiusShare = rng.range(0.14, 0.22);
    return fitRing(parcel, grid, (hu, hv) => roundedOutline(hu, hv,
      Math.min(4, Math.max(1, Math.min(hu, hv) * radiusShare))), inset, holdsCore) ?? boxed();
  }
  if (shape === 'cylinder') {
    return fitRing(parcel, grid, (hu, hv) => {
      const radius = Math.min(hu, hv);
      return RING16.map(([x, z]) => [x * radius, z * radius] as P2);
    }, inset, holdsCore) ?? boxed();
  }
  return boxed();
}

function clone(ring: P2[]): P2[] {
  return ring.map((p) => [...p] as P2);
}

/** An explicit parametric shape occupies a fitted construction-grid rectangle. */
function fitRing(
  parcel: P2[], grid: PlateGrid, make: (halfU: number, halfV: number) => P2[], inset: number,
  accept: (ring: P2[]) => boolean,
): P2[] | null {
  let fitted: P2[] | null = null;
  grid.fit(parcel, inset > 0 ? inset : 0.2, (box) => {
    const width = edgeLength(box, 0), depth = edgeLength(box, 1);
    if (width < 4 || depth < 4) return false;
    const local = make(width / 2, depth / 2);
    const u0 = Math.min(...local.map((p) => p[0])), u1 = Math.max(...local.map((p) => p[0]));
    const v0 = Math.min(...local.map((p) => p[1])), v1 = Math.max(...local.map((p) => p[1]));
    const spacing = grid.grid.spacing;
    const offsetU = Math.floor((width - u1 + u0) / (2 * spacing) + 1e-8) * spacing - u0;
    const offsetV = Math.floor((depth - v1 + v0) / (2 * spacing) + 1e-8) * spacing - v0;
    const u = edgeDir(box, 0), v = edgeDir(box, 1), origin = box[0]!;
    const ring = local.map(([x, z]): P2 => [origin[0] + u[0] * (x + offsetU) + v[0] * (z + offsetV),
      origin[1] + u[1] * (x + offsetU) + v[1] * (z + offsetV)]);
    if (!accept(ring)) return false;
    fitted = ring;
    return true;
  });
  return fitted;
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
