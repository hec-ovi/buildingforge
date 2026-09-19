import type { P2 } from '../core/polygon.ts';
import type { CoreAdjacency, Opening } from '../types.ts';
import type { CoreStairPlacement } from './corePreflight.ts';

/** What the check reads off a floor, in a layout or in a published blueprint. */
interface PlateFloor { index: number; outline: P2[]; openings: Opening[] }

/** The core solid on the plate: stair A's four corners on the shared frame. */
function coreCorners(stair: CoreStairPlacement): P2[] {
  const cross: P2 = [-stair.axis[1]!, stair.axis[0]!];
  const hw = stair.width / 2, hd = stair.depth / 2;
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as P2[]).map(([u, v]): P2 => [
    stair.center[0]! + stair.axis[0]! * u + cross[0] * v,
    stair.center[1]! + stair.axis[1]! * u + cross[1] * v,
  ]);
}

/** Shortest gap between two segments on the plate; zero where they meet. */
function segmentGap(a0: P2, a1: P2, b0: P2, b1: P2): number {
  const at = (p: P2, q: P2, t: number): P2 => [p[0]! + (q[0]! - p[0]!) * t, p[1]! + (q[1]! - p[1]!) * t];
  const clampedFoot = (p: P2, q: P2, point: P2): P2 => {
    const dx = q[0]! - p[0]!, dy = q[1]! - p[1]!;
    const square = dx * dx + dy * dy;
    if (square < 1e-12) return p;
    const t = ((point[0]! - p[0]!) * dx + (point[1]! - p[1]!) * dy) / square;
    return at(p, q, Math.min(1, Math.max(0, t)));
  };
  const side = (p: P2, q: P2, r: P2) => (q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!);
  if (side(a0, a1, b0) * side(a0, a1, b1) < 0 && side(b0, b1, a0) * side(b0, b1, a1) < 0) return 0;
  const span = (p: P2, q: P2, point: P2) => {
    const foot = clampedFoot(p, q, point);
    return Math.hypot(foot[0]! - point[0]!, foot[1]! - point[1]!);
  };
  return Math.min(span(a0, a1, b0), span(a0, a1, b1), span(b0, b1, a0), span(b0, b1, a1));
}

/** Gap from one window's inward reservation face to the core solid, across the plate. */
function coreGap(outline: P2[], opening: { edge: number; offset: number; width: number },
  reservation: number, corners: P2[]): number {
  const a = outline[opening.edge]!, b = outline[(opening.edge + 1) % outline.length]!;
  const length = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  const dir: P2 = [(b[0]! - a[0]!) / length, (b[1]! - a[1]!) / length];
  const inward: P2 = [-dir[1], dir[0]];
  const face = (u: number): P2 => [a[0]! + dir[0] * u + inward[0] * reservation, a[1]! + dir[1] * u + inward[1] * reservation];
  const from = face(opening.offset), to = face(opening.offset + opening.width);
  return Math.min(...corners.map((corner, index) => segmentGap(from, to, corner, corners[(index + 1) % corners.length]!)));
}

/** How far the core stands behind one wall's plane; zero or less means it stands outside it. */
function coreDepthBehind(outline: P2[], edge: number, corners: P2[]): number {
  const a = outline[edge]!, b = outline[(edge + 1) % outline.length]!;
  const length = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  const normal: P2 = [(b[1]! - a[1]!) / length, -(b[0]! - a[0]!) / length];
  return Math.min(...corners.map(corner =>
    -((corner[0]! - a[0]!) * normal[0] + (corner[1]! - a[1]!) * normal[1])));
}

/**
 * Windows the core plate crowds. Interior needs its circulation depth clear
 * between a window's reservation and the core solid, both behind the wall the
 * window sits in and across the plate, so a window that keeps less than that
 * has no corridor in front of it. The family gives up that window; the core
 * never moves.
 */
export function crossingWindows(
  floors: PlateFloor[], stair: CoreStairPlacement, reservation: number, policy: CoreAdjacency,
): Set<string> {
  const corners = coreCorners(stair);
  const crossing = new Set<string>();
  for (const floor of floors) {
    const behind = new Map<number, number>();
    for (const opening of floor.openings) {
      if (opening.kind !== 'window') continue;
      const override = policy.overrides?.find(rule => rule.floor === floor.index && rule.opening === opening.id);
      const needed = (override ?? policy.glazing).clearDepth;
      const depth = behind.get(opening.edge)
        ?? behind.set(opening.edge, coreDepthBehind(floor.outline, opening.edge, corners)).get(opening.edge)!;
      if (depth > 0 && depth - reservation < needed) crossing.add(opening.id);
      else if (coreGap(floor.outline, opening, reservation, corners) < needed) crossing.add(opening.id);
    }
  }
  return crossing;
}

/** The same floors without those windows. */
export function withoutWindows<T extends { openings: Opening[] }>(floors: T[], crossing: Set<string>): T[] {
  return floors.map(floor => ({ ...floor, openings: floor.openings.filter(opening => !crossing.has(opening.id)) }));
}
