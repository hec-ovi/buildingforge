// corporate-sectors as a piece set: panel wings around a recessed bank of slit
// windows, a projecting cassette, a pale shield at the crown and a screen field
// on the entrance stack.
//
// The bay boundary falls on the joint between two 2 m panel columns, so the
// 4 m wing is shared by two bays and reads as the family's fixed left wing.
// The bank is one continuous vertical channel, so it tiles at any floor count.

import { family } from '../../families/corporate-sectors/index.ts';
import { CHANNEL_RECESS, PANEL_WING, WINDOW_CELL, cassetteProfile } from '../../families/corporate-sectors/dimensions.ts';
import { cornerFillet, type Cell } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, glazing, signField, wall, type Opening } from '../skin.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, liningStart, storeyOf } from './common.ts';

const WING = PANEL_WING / 2;
const JOINT = 0.04;
const WING_DEPTH = 0.3;
const BANK_START = WING;
const BANK_END = KIT.bay - WING;
const GLASS = 0.1;
/** Shell thickness: the recessed bank plus its glazing reveal. */
const RECESS = CHANNEL_RECESS + GLASS;
/** Rim above the ground block and shield course at the crown. */
const RIM = 2;
const SHIELD = 1.4;
const CANOPY = 3.25;

function slits(storey: number): Opening[] {
  const cells = Math.round((BANK_END - BANK_START) / WINDOW_CELL);
  return Array.from({ length: cells }, (_, i) => {
    const centre = BANK_START + WINDOW_CELL * (i + 0.5);
    return { u0: centre - 0.7, u1: centre + 0.7, y0: 0.6, y1: storey - 0.6 };
  });
}

/**
 * The shell: a body plane behind each wing, one continuous recessed bank
 * between them, and the lining on the glazing plane.
 */
function body(context: PieceContext, cell: Cell, storey: number, openings: Opening[], liningFrom = 0, glazed = true): void {
  const sink = context.part('shell');
  const skin = context.material(context.band === 'ground' ? 'ground' : 'wall');
  wall(sink, cell, skin, { u0: 0, u1: BANK_START, y0: 0, y1: storey });
  wall(sink, cell, skin, { u0: BANK_END, u1: cell.length, y0: 0, y1: storey });
  // Jamb reveals of the bank; it has no head or sill, so it runs band to band.
  const trim = context.material('wall-trim');
  for (const [u, dir] of [[BANK_START, 1], [BANK_END, -1]] as [number, number][]) {
    sink.quadFacing(trim, cell.point(u, 0, 0), cell.point(u, 0, -CHANNEL_RECESS), cell.point(u, storey, -CHANNEL_RECESS), cell.point(u, storey, 0),
      [cell.axis[0] * dir, 0, cell.axis[2] * dir], [[0, 0], [CHANNEL_RECESS, 0], [CHANNEL_RECESS, storey], [0, storey]]);
  }
  wall(sink, cell, skin, { u0: BANK_START, u1: BANK_END, y0: 0, y1: storey, openings, depth: -CHANNEL_RECESS });
  wall(sink, cell, context.material('inner-wall'), { u0: liningFrom, u1: cell.length, y0: 0, y1: storey, openings, depth: -RECESS, facing: -1 });
  if (!glazed) return;
  for (const opening of openings) {
    glazing(sink, cell, opening, { glass: HOST_GLASS, frame: context.material('window-frame'), face: -CHANNEL_RECESS, recess: GLASS });
  }
}

/** Two 2 m panel columns meeting at the bay boundary, divided by a real joint. */
function panelWings(context: PieceContext, cell: Cell, storey: number): void {
  const sink = context.part('shell');
  const panel = context.material('wall');
  const caps = bandCaps(context.band);
  cell.solid(sink, panel, JOINT / 2, WING - JOINT / 2, 0, storey, WING_DEPTH, 0, { ...caps, back: false });
  cell.solid(sink, panel, cell.length - WING + JOINT / 2, cell.length - JOINT / 2, 0, storey, WING_DEPTH, 0, { ...caps, back: false });
}

function bay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const cap = band === 'ground' ? 0 : band === 'crown' ? SHIELD : 0;
  const storey = storeyOf(height, cap);
  const sink = context.part('shell');
  body(context, cell, storey, band === 'ground' ? [] : slits(storey), liningStart(context, index, RECESS));
  panelWings(context, cell, storey);
  if (band === 'ground') {
    // The single projecting rim that finishes the lower block.
    cell.solid(sink, context.material('wall-trim'), 0, cell.length, height - 0.9, height - 0.5, RIM, 0,
      { back: false, start: false, end: false });
  }
  if (band === 'middle') {
    // The decorative cassette: an apron with a lower fold and closed returns.
    const profile = cassetteProfile(height);
    cell.solid(sink, context.material('wall-trim'), BANK_START, BANK_END, profile.bottom, profile.top, profile.front, profile.back, { back: false });
    cell.solid(sink, context.material('light'), BANK_START, BANK_END, profile.bottom - 0.25, profile.bottom, profile.front - 0.04, profile.back, { back: false });
  }
  if (band === 'crown') {
    // The connected pale shield, jointed on the family's own panel grid.
    const shield = context.material('shield');
    for (let u = 0; u < cell.length - 1e-6; u += WINDOW_CELL) {
      cell.solid(sink, shield, u + JOINT / 2, u + WINDOW_CELL - JOINT / 2, storey, height - 0.2, WING_DEPTH + 0.2, 0, { back: false });
    }
    cell.solid(sink, context.material('roof'), 0, cell.length, height - 0.2, height, WING_DEPTH + 0.3, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

/** A corner is the family's panel wing turning the angle. */
function cornerArm(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const cap = band === 'crown' ? SHIELD : 0;
  const storey = storeyOf(height, cap);
  const sink = context.part('shell');
  const skin = context.material(band === 'ground' ? 'ground' : 'wall');
  wall(sink, cell, skin, { u0: 0, u1: cell.length, y0: 0, y1: storey });
  wall(sink, cell, context.material('inner-wall'), { u0: liningStart(context, index, RECESS), u1: cell.length, y0: 0, y1: storey, depth: -RECESS, facing: -1 });
  for (let u = 0; u < cell.length - 1e-6; u += WINDOW_CELL) {
    cell.solid(sink, context.material('wall'), u + JOINT / 2, u + WINDOW_CELL - JOINT / 2, 0, storey, WING_DEPTH, 0,
      { ...bandCaps(band), back: false });
  }
  if (band === 'ground') {
    cell.solid(sink, context.material('wall-trim'), 0, cell.length, height - 0.9, height - 0.5, RIM, 0,
      { back: false, start: false, end: false });
  }
  if (band === 'crown') {
    for (let u = 0; u < cell.length - 1e-6; u += WINDOW_CELL) {
      cell.solid(sink, context.material('shield'), u + JOINT / 2, u + WINDOW_CELL - JOINT / 2, storey, height - 0.2, WING_DEPTH + 0.2, 0, { back: false });
    }
    cell.solid(sink, context.material('roof'), 0, cell.length, height - 0.2, height, WING_DEPTH + 0.3, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

function entranceBay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const sink = context.part('shell');
  if (band !== 'ground') bay(context, cell, index);
  if (band === 'crown') {
    // Face 2 of the reference carries one portrait screen; the consumer fills it.
    signField(context, cell, { id: 'sign:screen', kind: 'screen', u: KIT.bay / 2, y: height / 2, width: 2.4, height: 4.8, depth: -CHANNEL_RECESS + 0.06 });
    return;
  }
  if (band === 'middle') {
    signField(context, cell, { id: 'sign:logo', kind: 'logo', u: KIT.bay / 2, y: height / 2, width: 3, height: 3, depth: -CHANNEL_RECESS + 0.06 });
    return;
  }
  // The entrance stands in the recessed bank, under a canopy with a cyan edge.
  const opening: Opening = { u0: KIT.bay / 2 - 1.94, u1: KIT.bay / 2 + 1.94, y0: 0, y1: 3.54 };
  body(context, cell, height, [opening], liningStart(context, index, RECESS), false);
  panelWings(context, cell, height);
  cell.solid(sink, context.material('wall-trim'), 0, cell.length, height - 0.9, height - 0.5, RIM, 0,
    { back: false, start: false, end: false });
  entrance(context, cell, {
    id: 'entry', u: KIT.bay / 2, width: 3.6, height: 3.4, depth: GLASS, face: -CHANNEL_RECESS,
    glass: HOST_GLASS, frame: context.material('window-frame'),
  });
  cell.solid(sink, context.material('wall-trim'), 1, cell.length - 1, height - 1.1, height - 0.9, CANOPY, 0, { back: false });
  cell.solid(sink, context.material('light'), 1, cell.length - 1, height - 1.24, height - 1.1, CANOPY, CANOPY - 0.3, {});
  signField(context, cell, { id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: height - 0.6, width: 5, height: 0.8, depth: 0.06 });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: HOST_GLASS },
  heights: { ground: KIT.floorHeight, middle: KIT.floorHeight, crown: KIT.floorHeight + SHIELD },
  backing: RECESS,
  build(context) {
    for (const [index, cell] of context.runs.entries()) {
      if (context.piece === 'corner') cornerArm(context, cell, index);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell, index);
      else bay(context, cell, index);
    }
    if (context.piece === 'corner') {
      cornerFillet(context.part('shell'), context.material('wall'), WING_DEPTH, 0, context.height, bandCaps(context.band));
    }
  },
};
