// Shared authoring helpers for the six family recipes.

import { KIT, type Band } from '../module.ts';
import type { Cell, Ends } from '../cell.ts';
import type { PieceContext } from '../recipe.ts';
import { glazing, lining, wall, type Opening, type RibbonEdge } from '../skin.ts';

export const RIBBON = KIT.ribbon;

/** Glazing is a host role: the families own the skin, the host owns the glass. */
export const HOST_GLASS = 'cyberpunk/paired-window-glass/mid#clear';

/** Storey height of a band, a crown's cap excluded. */
export function storeyOf(height: number, cap = 0): number {
  return height - cap;
}

/** A band's own bottom and top: the street, a joint with its neighbour, or a parapet. */
export function ribbonEdges(band: Band): { bottom: RibbonEdge; top: RibbonEdge } {
  if (band === 'ground') return { bottom: 'closed', top: 'joint' };
  if (band === 'crown') return { bottom: 'joint', top: 'none' };
  return { bottom: 'joint', top: 'joint' };
}

/** Caps of a member that runs the full height of a band and fuses with the next. */
export function bandCaps(band: Band): Ends {
  return { bottom: band === 'ground' ? undefined : false, top: band === 'crown' ? undefined : false };
}

export interface BodySpec {
  height: number;
  recess: number;
  /** Run span the body covers; the whole run by default. */
  u0?: number;
  u1?: number;
  openings?: Opening[];
  glass?: string;
  /** Shift the lining start so a corner's two arms meet without overlapping. */
  liningStart?: number;
  wallRole?: string;
  innerRole?: string;
  frameRole?: string;
  mullion?: number;
  /** Drop a jamb reveal where a glazed ribbon runs on across a run boundary. */
  openingEnds?: Ends[];
  /** Outward face an opening is cut in, when it sits on a projecting element. */
  openingFaces?: number[];
  /** Per-opening reveal depth, for a recess deeper than the shell: a loggia notch. */
  openingRecess?: number[];
  /** `null` leaves an opening unglazed, so its reveals frame an open recess. */
  openingGlass?: (string | null | undefined)[];
  /** Per-opening reveal material role. */
  openingFrames?: string[];
}

/**
 * The closed shell of one run: the outer wall plane cut around its openings,
 * the reveals and glazing, and the inner lining coplanar with the glass.
 */
export function shellBody(context: PieceContext, cell: Cell, spec: BodySpec): void {
  const sink = context.part('shell');
  const openings = spec.openings ?? [];
  const frame = context.material(spec.frameRole ?? 'window-frame');
  const u0 = spec.u0 ?? 0, u1 = spec.u1 ?? cell.length;
  wall(sink, cell, context.material(spec.wallRole ?? 'wall'), { u0, u1, y0: 0, y1: spec.height, openings });
  lining(sink, cell, context.material(spec.innerRole ?? 'inner-wall'), {
    u0: Math.max(u0, spec.liningStart ?? 0), u1, y0: 0, y1: spec.height, openings, depth: -spec.recess,
  });
  for (const [index, opening] of openings.entries()) {
    const face = spec.openingFaces?.[index] ?? 0;
    const glass = spec.openingGlass?.[index] === undefined ? spec.glass ?? HOST_GLASS : spec.openingGlass[index];
    const role = spec.openingFrames?.[index];
    glazing(context, sink, cell, opening, {
      glass, frame: role ? context.material(role) : frame, face, mullion: spec.mullion,
      recess: spec.openingRecess?.[index] ?? spec.recess + face,
      ...(spec.openingEnds?.[index] ? { ends: spec.openingEnds[index]! } : {}),
    });
  }
}

/** Arm 0 of a corner starts its lining one shell thickness along, so the two arms meet cleanly. */
export function liningStart(context: PieceContext, index: number, recess: number): number {
  return context.piece === 'corner' && index === 0 ? recess : 0;
}
