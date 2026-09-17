// mirror-shutters as a piece set: horizontal ribbon glazing with bronze mullion
// banks, broken by a narrow service spine.
//
// The 8 m repeat is a 3 m spine between the two halves of a 5 m ribbon cell, so
// the bay boundary falls in the middle of the ribbon. The two halves fuse into
// one continuous glazed cell and the 0.625 m mullion pitch runs through the
// joint, carried by a half mullion on each side of it.

import { family } from '../../families/mirror-shutters/index.ts';
import { DIMENSIONS } from '../../families/mirror-shutters/dimensions.ts';
import { cornerFillet, type Cell, type Ends } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, jointRibbon, signField, wall, type Opening } from '../skin.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, liningStart, ribbonEdges, shellBody, storeyOf } from './common.ts';

const SPINE = DIMENSIONS.service;
const ROOM = DIMENSIONS.room;
const SLAB = DIMENSIONS.slab;
const RECESS = 0.2;
const SPINE_DEPTH = 0.18;
/** The continuous cornice that finishes a group. */
const CORNICE = 0.5;
const HALF_ROOM = ROOM / 2;
const SPINE_START = HALF_ROOM;
const SPINE_END = SPINE_START + SPINE;
const MULLION = 0.07;
const CORNER_PIER = 1.5;

function ribbon(u0: number, u1: number, storey: number): Opening {
  return { u0, u1, y0: SLAB / 2, y1: storey - SLAB / 2 };
}

/** Three service windows sit in the spine, clear of the run boundary. */
function spineWindows(storey: number): Opening[] {
  return [0.75, 1.5, 2.25].map(offset => ({
    u0: SPINE_START + offset - 0.275, u1: SPINE_START + offset + 0.275,
    y0: storey * 0.35, y1: storey * 0.35 + 0.55,
  }));
}

/** Bronze mullions on the cell's own pitch, with a half bar on the run boundary. */
function bronzeBank(context: PieceContext, cell: Cell, u0: number, u1: number, storey: number, boundary?: 'start' | 'end'): void {
  const sink = context.part('shell');
  const bronze = context.material('column');
  const bar = (a: number, b: number, ends: Ends) =>
    cell.solid(sink, bronze, a, b, SLAB / 2, storey - SLAB / 2, 0.12, 0, { back: false, ...ends });
  const pitch = DIMENSIONS.mullionPitch;
  const count = Math.round((u1 - u0) / pitch);
  for (let k = 1; k < count; k++) bar(u0 + k * pitch - MULLION / 2, u0 + k * pitch + MULLION / 2, {});
  if (boundary === 'start') bar(u0, u0 + MULLION / 2, { start: false });
  if (boundary === 'end') bar(u1 - MULLION / 2, u1, { end: false });
}

function floorRibbon(context: PieceContext, cell: Cell, ends: Ends): void {
  jointRibbon(context.part('shell'), cell, context.material('wall-trim'), {
    u0: 0, u1: cell.length, height: SLAB, depth: 0.09, bandHeight: context.height, ends, ...ribbonEdges(context.band),
  });
}

function cornice(context: PieceContext, cell: Cell, storey: number): void {
  cell.solid(context.part('shell'), context.material('roof'), 0, cell.length, storey, context.height, 0.34, 0,
    { back: false, bottom: false, start: false, end: false });
}

function bay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CORNICE) : height;
  const sink = context.part('shell');
  const windows = band === 'ground' ? [] : spineWindows(storey);
  if (band === 'ground') {
    shellBody(context, cell, { height, recess: RECESS, wallRole: 'ground', liningStart: liningStart(context, index, RECESS) });
    for (const u of [0, 2.5, 5]) cell.solid(sink, context.material('ground'), u + 0.05, u + 2.45, 0.4, 2.4, 0.06, 0, { back: false });
  } else {
    shellBody(context, cell, {
      height, recess: RECESS, liningStart: liningStart(context, index, RECESS),
      openings: [ribbon(0, HALF_ROOM, storey), ...windows, ribbon(SPINE_END, cell.length, storey)],
      openingEnds: [{ start: false }, {}, {}, {}, { end: false }],
      openingFaces: [0, SPINE_DEPTH, SPINE_DEPTH, SPINE_DEPTH, 0],
    });
    bronzeBank(context, cell, 0, HALF_ROOM, storey, 'start');
    bronzeBank(context, cell, SPINE_END, cell.length, storey, 'end');
  }
  // The service spine runs the full height of the building, band to band. Its
  // pale face is cut around the service windows, so the solid drops its front.
  cell.solid(sink, context.material('wall-trim'), SPINE_START, SPINE_END, 0, storey, SPINE_DEPTH, 0,
    { ...bandCaps(band), front: false, back: false });
  wall(sink, cell, context.material('ground'), {
    u0: SPINE_START, u1: SPINE_END, y0: 0, y1: storey, openings: windows, depth: SPINE_DEPTH,
  });
  floorRibbon(context, cell, { start: false, end: false });
  if (band === 'crown') cornice(context, cell, storey);
}

/** A corner is a bronze bank turning the angle, handing over to the ribbon. */
function cornerArm(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CORNICE) : height;
  const sink = context.part('shell');
  shellBody(context, cell, {
    height, recess: RECESS, wallRole: band === 'ground' ? 'ground' : 'wall',
    liningStart: liningStart(context, index, RECESS),
    openings: band === 'ground' ? [] : [ribbon(CORNER_PIER, cell.length, storey)],
    openingEnds: [{ end: false }],
  });
  cell.solid(sink, context.material('column'), 0, CORNER_PIER, 0, storey, 0.12, 0, { ...bandCaps(band), back: false, start: false });
  if (band !== 'ground') bronzeBank(context, cell, CORNER_PIER, cell.length, storey, 'end');
  floorRibbon(context, cell, { end: false });
  if (band === 'crown') cornice(context, cell, storey);
}

function entranceBay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  bay(context, cell, index);
  if (band !== 'ground') {
    signField(context, cell, {
      id: band === 'middle' ? 'sign:logo' : 'sign:screen', kind: band === 'middle' ? 'logo' : 'screen',
      u: KIT.bay / 2, y: height / 2, width: SPINE - 0.4, height: SPINE - 0.4, depth: SPINE_DEPTH + 0.02,
    });
    return;
  }
  const sink = context.part('shell');
  // Closed metal entry ribs carry the warm strips over the door.
  for (const u of [SPINE_START - 1.4, SPINE_END + 1.4]) {
    cell.solid(sink, context.material('wall-trim'), u - 0.2, u + 0.2, 0, height - 0.2, 2.1, 0, { back: false });
    cell.solid(sink, context.material('light-fixture'), u - 0.12, u + 0.12, height - 0.5, height - 0.2, 2.12, 2, {});
  }
  entrance(context, cell, { id: 'entry', u: KIT.bay / 2, width: 3.4, height: 3.2, glass: HOST_GLASS, frame: context.material('window-frame') });
  signField(context, cell, { id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: height - 1.3, width: 4.4, height: 0.8 });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: HOST_GLASS },
  heights: { ground: KIT.floorHeight, middle: KIT.floorHeight, crown: KIT.floorHeight + CORNICE },
  backing: RECESS,
  build(context) {
    for (const [index, cell] of context.runs.entries()) {
      if (context.piece === 'corner') cornerArm(context, cell, index);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell, index);
      else bay(context, cell, index);
    }
    if (context.piece === 'corner') {
      cornerFillet(context.part('shell'), context.material('column'), 0.12, 0, context.height, bandCaps(context.band));
    }
  },
};
