// mirror-frame as a piece set: broad graphite piers around deep vertical slots,
// with a pale illuminated portal at the entrance.
//
// The 8 m repeat is the family's own, a 5 m slot between 3 m piers with glazing
// recessed 0.65 m. The bay boundary falls down the middle of a pier, so two
// bays fuse into one 3 m pier and the slot rhythm never breaks.

import { family } from '../../families/mirror-frame/index.ts';
import { dimensions } from '../../families/mirror-frame/dimensions.ts';
import { cornerFillet, type Cell } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, jointPier, jointRibbon, panes, signField, type Opening } from '../skin.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, RIBBON, ribbonEdges, shellBody, storeyOf } from './common.ts';

const PIER = dimensions.pier;
const RECESS = dimensions.recess;
const PROJECTION = dimensions.projection;
/** Stepped pier head above the crown storey. */
const HEAD = 0.73;
const SLOT_START = PIER / 2;
const SLOT_END = SLOT_START + dimensions.slot;
const PORTAL = 0.34;
const INSET = 0.25;

function slotOpening(storey: number): Opening {
  return {
    u0: SLOT_START + INSET, u1: SLOT_END - INSET, y0: 0.35, y1: storey - 0.35,
    panes: panes(dimensions.slot - 2 * INSET, 1.6),
  };
}

function bay(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, HEAD) : height;
  const sink = context.part('shell');
  shellBody(context, cell, {
    height, recess: RECESS, mullion: 0.09,
    openings: band === 'ground' ? [] : [slotOpening(storey)],
  });
  jointPier(sink, cell, context.material('wall'), { width: PIER, depth: PROJECTION, y0: 0, y1: storey, caps: bandCaps(band) });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: SLOT_START, u1: SLOT_END, height: RIBBON, depth: 0.05, bandHeight: height, ...ribbonEdges(band),
  });
  if (band === 'ground') cell.solid(sink, context.material('wall-trim'), SLOT_START, SLOT_END, 0.15, 0.45, 0.1, 0);
  if (band === 'crown') {
    // Stepped pier heads finish the group; the slot gets a flat parapet band.
    jointPier(sink, cell, context.material('wall'), { width: PIER, depth: PROJECTION + 0.14, y0: storey, y1: height });
    cell.solid(sink, context.material('wall-trim'), SLOT_START, SLOT_END, storey, height - 0.2, 0.12, 0);
  }
}

/** A corner is a solid graphite pier: the family's end piers absorb the turn. */
function cornerArm(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, HEAD) : height;
  const sink = context.part('shell');
  shellBody(context, cell, { height, recess: RECESS });
  cell.solid(sink, context.material('wall'), 0, cell.length, 0, storey, PROJECTION, 0,
    { ...bandCaps(band), start: false, end: false });
  if (band === 'crown') {
    cell.solid(sink, context.material('wall'), 0, cell.length, storey, height, PROJECTION + 0.14, 0,
      { start: false, end: false });
  }
}

function entranceBay(context: PieceContext, cell: Cell): void {
  const { band, height } = context;
  if (band !== 'ground') {
    bay(context, cell);
    signField(context, cell, {
      id: band === 'middle' ? 'sign:logo' : 'sign:crest',
      kind: band === 'middle' ? 'logo' : 'screen',
      u: KIT.bay / 2, y: height / 2, width: dimensions.slot - 1.2, height: Math.min(height - 1.6, dimensions.slot - 1.2),
    });
    return;
  }
  const sink = context.part('shell');
  const portalWidth = dimensions.slot + 0.8, u0 = (KIT.bay - portalWidth) / 2;
  shellBody(context, cell, { height, recess: RECESS });
  jointPier(sink, cell, context.material('wall'), { width: PIER, depth: PROJECTION, y0: 0, y1: height, caps: bandCaps(band) });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: SLOT_START, u1: SLOT_END, height: RIBBON, depth: 0.05, bandHeight: height, ...ribbonEdges(band),
  });
  // The pale portal stops below the band boundary, which the floor ribbon owns.
  const head = height - RIBBON / 2;
  const stone = context.material('portal-trim');
  cell.solid(sink, stone, u0, u0 + 0.6, 0, head - 0.5, PORTAL, 0);
  cell.solid(sink, stone, u0 + portalWidth - 0.6, u0 + portalWidth, 0, head - 0.5, PORTAL, 0);
  cell.solid(sink, stone, u0, u0 + portalWidth, head - 0.5, head, PORTAL, 0);
  cell.solid(sink, context.material('portal-light'), u0 + 0.6, u0 + portalWidth - 0.6, head - 0.62, head - 0.5, PORTAL - 0.04, 0.02);
  entrance(context, cell, { id: 'entry', u: KIT.bay / 2, width: 3.2, height: 3.2, glass: HOST_GLASS, frame: context.material('window-frame') });
  signField(context, cell, {
    id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: head - 0.9,
    width: portalWidth - 1.6, height: 0.9, depth: PORTAL + 0.02,
  });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: HOST_GLASS },
  heights: { ground: KIT.floorHeight, middle: KIT.floorHeight, crown: KIT.floorHeight + HEAD },
  backing: family.wallBackingDepth ?? 0.12,
  build(context) {
    for (const cell of context.runs) {
      if (context.piece === 'corner') cornerArm(context, cell);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell);
      else bay(context, cell);
    }
    if (context.piece === 'corner') {
      const sink = context.part('shell');
      const storey = context.band === 'crown' ? storeyOf(context.height, HEAD) : context.height;
      cornerFillet(sink, context.material('wall'), PROJECTION, 0, storey, bandCaps(context.band));
      if (context.band === 'crown') cornerFillet(sink, context.material('wall'), PROJECTION + 0.14, storey, context.height);
    }
  },
};
