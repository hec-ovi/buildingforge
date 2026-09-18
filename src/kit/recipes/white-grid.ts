// white-grid as a piece set: ivory piers and one ivory diagonal brace over tall
// glazing and reflective floor ribbons, on a dark reflective podium.
//
// The bay boundary falls down the middle of a 1.5 m pier, so two bays fuse into
// one pier. The reference brace crosses a three-floor group; a piece set has to
// tile at any floor count, so the brace spans one bay per storey and the bays
// together read as the same continuous ivory diagonal.

import { family } from '../../families/white-grid/index.ts';
import { dimensions } from '../../families/white-grid/dimensions.ts';
import { cornerFillet, type Cell } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, jointPier, jointRibbon, panes, signField, type Opening } from '../skin.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, ribbonEdges, shellBody, storeyOf } from './common.ts';

const PIER = dimensions.pier;
const RECESS = 0.3;
const RIBBON = dimensions.sill + dimensions.head;
const GLASS_START = PIER / 2;
const GLASS_END = KIT.bay - PIER / 2;
const BRACE = 0.14;
const CAP = dimensions.relief;
/** Reference ground: 40 percent dark metal base under a 60 percent podium. */
const BASE_FRACTION = 0.4;

function glazed(u0: number, u1: number, storey: number): Opening {
  return { u0, u1, y0: dimensions.sill, y1: storey - dimensions.head, panes: panes(u1 - u0, 1.69) };
}

/**
 * One ivory brace across the glazed field, standing 0.14 m ahead of the
 * reflective ribbons. It starts and ends on the piers, so nothing crosses the
 * run boundary and the diagonal continues into the bay above and beside it.
 */
function brace(context: PieceContext, cell: Cell, u0: number, u1: number, storey: number): void {
  const sink = context.part('shell');
  const ivory = context.material('column');
  const y0 = dimensions.sill, y1 = storey - dimensions.head;
  const rise = (y1 - y0 - 0.34) / (u1 - u0);
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const a = u0 + (u1 - u0) * i / steps, b = u0 + (u1 - u0) * (i + 1) / steps;
    cell.solid(sink, ivory, a, b, y0 + (a - u0) * rise, y0 + (b - u0) * rise + 0.34, BRACE, 0);
  }
}

function bay(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  if (band === 'ground') {
    shellBody(context, cell, { height, recess: RECESS, wallRole: 'ground' });
    podium(context, cell);
  } else {
    shellBody(context, cell, {
      height, recess: RECESS,
      openings: [glazed(GLASS_START, GLASS_END, storey)],
    });
    brace(context, cell, GLASS_START, GLASS_END, storey);
  }
  jointPier(sink, cell, context.material(band === 'ground' ? 'ground' : 'column'), {
    width: PIER, depth: dimensions.relief, y0: 0, y1: storey, caps: bandCaps(band),
  });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: GLASS_START, u1: GLASS_END, height: RIBBON, depth: 0.1, bandHeight: height, ...ribbonEdges(band),
  });
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, dimensions.relief, 0,
      { start: false, end: false });
  }
}

/** Ground divides into a dark reflective base and a lighter podium under an ivory fascia. */
function podium(context: PieceContext, cell: Cell): void {
  const sink = context.part('shell');
  const split = context.height * BASE_FRACTION;
  const fascia = context.height - RIBBON / 2;
  cell.solid(sink, context.material('wall-trim'), 0, cell.length, split, fascia - 0.35, 0.08, 0,
    { start: false, end: false });
  // The ivory fascia stops clear of the band boundary, which the floor ribbon owns.
  cell.solid(sink, context.material('column'), 0, cell.length, fascia - 0.35, fascia, dimensions.relief - 0.02, 0,
    { start: false, end: false });
}

/** A corner is an ivory panel column with its own glazed return. */
function cornerArm(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  const column = 1.5;
  if (band === 'ground') {
    shellBody(context, cell, { height, recess: RECESS, wallRole: 'ground' });
    podium(context, cell);
  } else {
    shellBody(context, cell, {
      height, recess: RECESS,
      openings: [glazed(column, cell.length - PIER / 2, storey)],
    });
    brace(context, cell, column, cell.length - PIER / 2, storey);
  }
  cell.solid(sink, context.material(band === 'ground' ? 'ground' : 'column'), 0, column, 0, storey, dimensions.relief, 0,
    { ...bandCaps(band), start: false });
  cell.solid(sink, context.material(band === 'ground' ? 'ground' : 'column'), cell.length - PIER / 2, cell.length, 0, storey, dimensions.relief, 0,
    { ...bandCaps(band), end: false });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: column, u1: cell.length - PIER / 2, height: RIBBON, depth: 0.1, bandHeight: height, ...ribbonEdges(band),
  });
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, dimensions.relief, 0,
      { start: false, end: false });
  }
}

function entranceBay(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  bay(context, cell);
  if (band !== 'ground') {
    signField(context, cell, {
      id: band === 'middle' ? 'sign:logo' : 'sign:screen', kind: band === 'middle' ? 'logo' : 'screen',
      u: KIT.bay / 2, y: height / 2, width: 3, height: 3, depth: BRACE + 0.04,
    });
    return;
  }
  entrance(context, cell, { id: 'entry', u: KIT.bay / 2, width: 3.6, height: 3.4, glass: HOST_GLASS, frame: context.material('window-frame') });
  signField(context, cell, { id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: height - 0.9, width: 5, height: 0.9, depth: 0.1 });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: HOST_GLASS },
  heights: { ground: family.groundFloorHeight ?? 5, middle: KIT.floorHeight, crown: KIT.floorHeight + CAP },
  backing: family.wallBackingDepth ?? 0.12,
  build(context) {
    for (const cell of context.runs) {
      if (context.piece === 'corner') cornerArm(context, cell);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell);
      else bay(context, cell);
    }
    if (context.piece === 'corner') {
      cornerFillet(context.part('shell'), context.material(context.band === 'ground' ? 'ground' : 'column'),
        dimensions.relief, 0, context.height, bandCaps(context.band));
      if (context.band === 'ground') {
        const fascia = context.height - RIBBON / 2;
        cornerFillet(context.part('shell'), context.material('wall-trim'), 0.08, context.height * BASE_FRACTION, fascia - 0.35);
        cornerFillet(context.part('shell'), context.material('column'), dimensions.relief - 0.02, fascia - 0.35, fascia);
      }
    }
  },
};
