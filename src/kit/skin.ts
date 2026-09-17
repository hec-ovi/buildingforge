// Geometry every family's piece set shares: the wall plane and its openings,
// recessed glazing, the pier a run boundary cuts in half, the ribbon a band
// boundary cuts in half, and the entrance a consumer opens by node.
//
// A piece is closed by its outer wall plane, the reveals of each opening, the
// glazing, and an inner lining on the glazing plane. Lining and glass are
// coplanar, so the shell has one thickness and no open edge.

import { cutWall, rectHole, type Hole } from '../mesh/wallcut.ts';
import type { PartSink, V3 } from '../mesh/primitives.ts';
import type { Cell, Ends } from './cell.ts';
import type { PieceContext } from './recipe.ts';

export interface Opening { u0: number; u1: number; y0: number; y1: number; panes?: number }

export interface WallSpec {
  u0: number; u1: number; y0: number; y1: number;
  openings?: Opening[];
  /** Outward offset of the plane; negative is inward. */
  depth?: number;
  /** -1 turns the plane to face the building interior. */
  facing?: number;
}

/** A plane on the face, cut around its openings. */
export function wall(sink: PartSink, cell: Cell, material: string, spec: WallSpec): void {
  const depth = spec.depth ?? 0, facing = spec.facing ?? 1;
  const holes: Hole[] = (spec.openings ?? []).map(o => rectHole(o.u0 - spec.u0, o.y0, o.u1 - o.u0, o.y1 - o.y0));
  const n: V3 = [cell.outward[0] * facing, 0, cell.outward[1] * facing];
  for (const piece of cutWall(spec.u1 - spec.u0, spec.y0, spec.y1, holes)) {
    const at = (p: [number, number]) => cell.point(spec.u0 + p[0], p[1], depth);
    sink.quadFacing(material, at(piece.bl), at(piece.br), at(piece.tr), at(piece.tl), n,
      [[piece.bl[0], -piece.bl[1]], [piece.br[0], -piece.br[1]], [piece.tr[0], -piece.tr[1]], [piece.tl[0], -piece.tl[1]]]);
  }
}

/**
 * Reveals from the face plane back to the glazing, the glass, and its mullions.
 * `ends` drops a jamb reveal where a ribbon runs on across a run boundary.
 */
export function glazing(
  sink: PartSink, cell: Cell, opening: Opening,
  o: { glass: string | null; frame: string; face?: number; recess: number; mullion?: number; ends?: Ends },
): void {
  const face = o.face ?? 0, back = face - o.recess;
  const { u0, u1, y0, y1 } = opening;
  const uv: [number, number][] = [[0, 0], [o.recess, 0], [o.recess, 1], [0, 1]];
  const reveal = (a: V3, b: V3, c: V3, d: V3, n: V3) => sink.quadFacing(o.frame, a, b, c, d, n, uv);
  if (o.ends?.start !== false) reveal(cell.point(u0, y0, face), cell.point(u0, y0, back), cell.point(u0, y1, back), cell.point(u0, y1, face), cell.axis);
  if (o.ends?.end !== false) reveal(cell.point(u1, y0, face), cell.point(u1, y0, back), cell.point(u1, y1, back), cell.point(u1, y1, face), [-cell.axis[0], 0, -cell.axis[2]]);
  reveal(cell.point(u0, y0, face), cell.point(u1, y0, face), cell.point(u1, y0, back), cell.point(u0, y0, back), [0, 1, 0]);
  reveal(cell.point(u0, y1, face), cell.point(u1, y1, face), cell.point(u1, y1, back), cell.point(u0, y1, back), [0, -1, 0]);
  if (o.glass === null) return;
  cell.plate(sink, o.glass, u0, u1, y0, y1, back);
  const count = opening.panes ?? 1;
  const bar = o.mullion ?? 0.08;
  for (let i = 1; i < count; i++) {
    const u = u0 + (u1 - u0) * i / count;
    cell.solid(sink, o.frame, u - bar / 2, u + bar / 2, y0, y1, back + bar, back, { back: false });
  }
}

/**
 * Half the joint pier at each end of a run. Each half omits the face its
 * neighbour supplies, so two pieces fuse into one pier of `width`.
 */
export function jointPier(sink: PartSink, cell: Cell, material: string, o: { width: number; depth: number; y0: number; y1: number; caps?: Ends }): void {
  const half = o.width / 2;
  const caps = { bottom: o.caps?.bottom, top: o.caps?.top, back: false as const };
  cell.solid(sink, material, 0, half, o.y0, o.y1, o.depth, 0, { ...caps, start: false });
  cell.solid(sink, material, cell.length - half, cell.length, o.y0, o.y1, o.depth, 0, { ...caps, end: false });
}

/** How a band edge treats its half of the floor ribbon. */
export type RibbonEdge = 'joint' | 'closed' | 'none';

/**
 * Half the floor ribbon at the bottom and top of a band. A `joint` half omits
 * the cap the neighbouring band supplies, so stacked bands fuse into one
 * ribbon; a `closed` half is the building's own bottom or top edge.
 */
export function jointRibbon(
  sink: PartSink, cell: Cell, material: string,
  o: { u0: number; u1: number; height: number; depth: number; bandHeight: number; bottom?: RibbonEdge; top?: RibbonEdge; ends?: Ends },
): void {
  const half = o.height / 2;
  const ends = { start: o.ends?.start, end: o.ends?.end, back: o.ends?.back ?? false };
  const bottom = o.bottom ?? 'joint', top = o.top ?? 'joint';
  if (bottom !== 'none') cell.solid(sink, material, o.u0, o.u1, 0, half, o.depth, 0, { ...ends, bottom: bottom === 'closed' });
  if (top !== 'none') cell.solid(sink, material, o.u0, o.u1, o.bandHeight - half, o.bandHeight, o.depth, 0, { ...ends, top: top === 'closed' });
}

/** The inner lining, coplanar with the glazing, cut around the same openings. */
export function lining(sink: PartSink, cell: Cell, material: string, spec: WallSpec & { depth: number }): void {
  wall(sink, cell, material, { ...spec, facing: -1 });
}

const LEAF_THICKNESS = 0.06;

/**
 * A swing entrance a consumer addresses by node: a casing with a clear
 * threshold, and one leaf per node turning on its own hinge.
 */
export function entrance(
  context: PieceContext, cell: Cell,
  o: { id: string; u: number; width: number; height: number; leaves?: number; jamb?: number; glass: string; frame: string; depth?: number; face?: number },
): void {
  const leaves = o.leaves ?? 2;
  const jamb = o.jamb ?? 0.14, depth = o.depth ?? 0.22, face = o.face ?? 0;
  const u0 = o.u - o.width / 2, u1 = o.u + o.width / 2;
  const casing = context.part(`door:${o.id}/frame`, { keepNode: true });
  cell.solid(casing, o.frame, u0 - jamb, u0, 0, o.height + jamb, face, face - depth, { bottom: false });
  cell.solid(casing, o.frame, u1, u1 + jamb, 0, o.height + jamb, face, face - depth, { bottom: false });
  cell.solid(casing, o.frame, u0, u1, o.height, o.height + jamb, face, face - depth, {});
  const leafWidth = o.width / leaves;
  const mid = face - depth / 2;
  for (let i = 0; i < leaves; i++) {
    const hinge = i === 0 ? u0 : u1;
    const pivot = cell.point(hinge, 0, mid);
    const sink = context.part(`door:${o.id}/leaf:${i}`, { pivot, parent: `door:${o.id}/frame` });
    const near = i === 0 ? hinge : hinge - leafWidth;
    cell.solid(sink, o.glass, near, near + leafWidth, 0.02, o.height - 0.02,
      mid + LEAF_THICKNESS / 2, mid - LEAF_THICKNESS / 2, {});
  }
  context.door({ id: o.id, width: o.width, height: o.height, leaves, position: cell.point(o.u, 0, face), facing: cell.normal });
}

/** A sign field the consumer letters: never geometry, always a published anchor. */
export function signField(
  context: PieceContext, cell: Cell,
  o: { id: string; kind: 'marquee' | 'logo' | 'screen'; u: number; y: number; width: number; height: number; depth?: number },
): void {
  context.anchor({
    id: o.id, kind: o.kind,
    position: cell.point(o.u, o.y, o.depth ?? 0.06),
    size: [o.width, o.height],
    facing: cell.normal,
  });
}

/** Pane count across a glazed field at roughly the preferred pane width. */
export function panes(width: number, preferred = 1.7): number {
  return Math.max(1, Math.round(width / preferred));
}
