// balcony-grid as a piece set: a paired glazed room beside a recessed loggia,
// between coated metal piers, with a continuous cast concrete slab front.
//
// The reference repeat is 17 m; the piece set keeps its order and its parts on
// the 8 m module. The bay boundary falls down the middle of a 1 m pier, so two
// bays fuse into one pier and loggia and glazing alternate without a break.

import { family } from '../../families/balcony-grid/index.ts';
import { finishes } from '../../families/balcony-grid/materials.ts';
import { PIER } from '../../families/balcony-grid/dimensions.ts';
import { cornerFillet, type Cell } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, glazing, jointPier, jointRibbon, panes, signField, wall, type Opening } from '../skin.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, liningStart, ribbonEdges, shellBody, storeyOf } from './common.ts';

const LOGGIA = 3;
const ROOM = 3;
const DEPTH = 2;
const RECESS = 0.15;
const SLAB = 0.3;
const RAIL = 1.105;
const CAP = SLAB;
const L0 = PIER / 2;
const L1 = L0 + LOGGIA;
const R0 = L1 + PIER;
const R1 = R0 + ROOM;

function glazed(storey: number): Opening {
  return { u0: R0, u1: R1, y0: SLAB / 2 + 0.08, y1: storey - SLAB / 2 - 0.08, panes: panes(ROOM, 1.5) };
}

/** The loggia notch: side returns, a concrete deck, a ceiling and a rear wall. */
function loggia(context: PieceContext, cell: Cell, storey: number, notch: Opening): void {
  const sink = context.part('shell');
  const pier = context.material('column');
  const door: Opening = { u0: L0 + 0.7, u1: L1 - 0.7, y0: notch.y0, y1: notch.y1 - 0.4, panes: 2 };
  wall(sink, cell, context.material('inner-wall'), { u0: L0, u1: L1, y0: notch.y0, y1: notch.y1, openings: [door], depth: -DEPTH });
  glazing(sink, cell, door, { glass: HOST_GLASS, frame: context.material('window-frame'), face: -DEPTH, recess: 0.1 });
  // Glass infill between metal posts, the reference's loggia rail.
  const rail = notch.y0 + RAIL;
  cell.solid(sink, HOST_GLASS, L0, L1, notch.y0 + 0.12, rail - 0.06, -0.08, -0.12, { start: false, end: false });
  for (const u of [L0 + 0.05, (L0 + L1) / 2, L1 - 0.05]) cell.solid(sink, pier, u - 0.05, u + 0.05, notch.y0, rail, -0.04, -0.14, {});
  cell.solid(sink, pier, L0, L1, rail - 0.06, rail, -0.02, -0.16, { start: false, end: false });
}

function bay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  if (band === 'ground') {
    shellBody(context, cell, { height, recess: RECESS, wallRole: 'ground', liningStart: liningStart(context, index, RECESS) });
    for (const u of [0.4, 4.2]) cell.solid(sink, context.material('ground'), u, u + 3.4, 0.6, height - 0.9, 0.07, 0, { back: false });
  } else {
    const notch: Opening = { u0: L0, u1: L1, y0: SLAB / 2, y1: storey - SLAB / 2 };
    shellBody(context, cell, {
      height, recess: RECESS, openings: [notch, glazed(storey)],
      openingRecess: [DEPTH, RECESS], openingGlass: [null, undefined], openingFrames: ['wall-trim'],
      liningStart: liningStart(context, index, RECESS),
    });
    loggia(context, cell, storey, notch);
  }
  jointPier(sink, cell, context.material(band === 'ground' ? 'ground' : 'column'), {
    width: PIER, depth: 0.1, y0: 0, y1: storey, caps: bandCaps(band),
  });
  for (const [u0, u1, closed] of [[0, L0, false], [L0, L1, true], [L1, cell.length, false]] as [number, number, boolean][]) {
    jointRibbon(sink, cell, context.material('wall-trim'), {
      u0, u1, height: SLAB, depth: 0.02, bandHeight: height,
      ends: { start: false, end: false, back: closed && band !== 'ground' }, ...ribbonEdges(band),
    });
  }
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, 0.18, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

/** A corner is the family's end pier: a 3.5 m coated metal strip turning the angle. */
function cornerArm(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  const end = cell.length - PIER / 2;
  shellBody(context, cell, {
    height, recess: RECESS, wallRole: band === 'ground' ? 'ground' : 'wall',
    liningStart: liningStart(context, index, RECESS),
    openings: band === 'ground' ? [] : [{ u0: 1.2, u1: end - 0.3, y0: SLAB / 2 + 0.08, y1: storey - SLAB / 2 - 0.08, panes: 2 }],
  });
  cell.solid(sink, context.material(band === 'ground' ? 'ground' : 'column'), 0, 1.2, 0, storey, 0.1, 0,
    { ...bandCaps(band), back: false, start: false });
  jointPier(sink, cell, context.material(band === 'ground' ? 'ground' : 'column'), {
    width: PIER, depth: 0.1, y0: 0, y1: storey, caps: bandCaps(band),
  });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: 0, u1: cell.length, height: SLAB, depth: 0.02, bandHeight: height,
    ends: { start: false, end: false }, ...ribbonEdges(band),
  });
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, 0.18, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

function entranceBay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  bay(context, cell, index);
  if (band !== 'ground') {
    signField(context, cell, {
      id: band === 'middle' ? 'sign:logo' : 'sign:screen', kind: band === 'middle' ? 'logo' : 'screen',
      u: (R0 + R1) / 2, y: height / 2, width: ROOM - 0.6, height: ROOM - 0.6, depth: 0.12,
    });
    return;
  }
  entrance(context, cell, { id: 'entry', u: KIT.bay / 2, width: 3.2, height: 3.1, glass: HOST_GLASS, frame: context.material('window-frame') });
  signField(context, cell, { id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: height - 0.8, width: 4.4, height: 0.7, depth: 0.12 });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: finishes.glass, light: finishes.light },
  heights: { ground: KIT.floorHeight, middle: KIT.floorHeight, crown: KIT.floorHeight + CAP },
  backing: RECESS,
  jointPier: PIER,
  build(context) {
    for (const [index, cell] of context.runs.entries()) {
      if (context.piece === 'corner') cornerArm(context, cell, index);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell, index);
      else bay(context, cell, index);
    }
    if (context.piece === 'corner') {
      cornerFillet(context.part('shell'), context.material(context.band === 'ground' ? 'ground' : 'column'),
        0.1, 0, context.height, bandCaps(context.band));
    }
  },
};
