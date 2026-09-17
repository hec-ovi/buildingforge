// faceted-bays as a piece set: a three-plane glass bay between ivory panel
// piers, finished by a grouped concrete cap.
//
// The reference cell is 12 m; the piece set keeps every element and the same
// order on the 8 m module: a 1 m pier split by the bay boundary, 1.5 m cheeks
// at 45 degrees and a 4 m front. The projecting bay stops at the sill and head
// of each storey, so nothing crosses a band boundary.

import { family } from '../../families/faceted-bays/index.ts';
import { DIMENSIONS } from '../../families/faceted-bays/dimensions.ts';
import { cornerFillet, type Cell } from '../cell.ts';
import { KIT } from '../module.ts';
import { entrance, jointPier, jointRibbon, panes, signField, wall, type Opening } from '../skin.ts';
import type { PartSink, V3 } from '../../mesh/primitives.ts';
import type { KitRecipe, PieceContext } from '../recipe.ts';
import { bandCaps, HOST_GLASS, liningStart, ribbonEdges, shellBody, storeyOf } from './common.ts';

const PIER = DIMENSIONS.slit;
const CHEEK = DIMENSIONS.cheek;
const FRONT = KIT.bay - PIER - 2 * CHEEK;
const RECESS = 0.24;
const PROJECT = CHEEK / Math.SQRT2;
const CAP = DIMENSIONS.separator;
const BAY_START = PIER / 2;
const BAY_END = KIT.bay - PIER / 2;
const SLIT = 0.4;
/** Outward face of the ivory panel column. */
const PANEL = 0.16;

/**
 * The three glass planes of one bay: two 45 degree cheeks and a front, closed
 * top and bottom by concrete sill and head.
 */
function facetedBay(context: PieceContext, cell: Cell, u0: number, u1: number, storey: number): void {
  const sink = context.part('shell');
  const glass = HOST_GLASS, cap = context.material('wall-trim');
  const y0 = DIMENSIONS.sill, y1 = storey - DIMENSIONS.head;
  const a = u0, b = u0 + CHEEK, c = u1 - CHEEK, d = u1;
  const plane = (ua: number, ub: number, da: number, db: number) => {
    const bl = cell.point(ua, y0, da), br = cell.point(ub, y0, db);
    const tr = cell.point(ub, y1, db), tl = cell.point(ua, y1, da);
    const n: V3 = [(bl[2] - br[2]), 0, (br[0] - bl[0])];
    sink.quadFacing(glass, bl, br, tr, tl, outward(cell, n), [[0, 0], [ub - ua, 0], [ub - ua, y1 - y0], [0, y1 - y0]]);
  };
  plane(a, b, 0, PROJECT);
  plane(b, c, PROJECT, PROJECT);
  plane(c, d, PROJECT, 0);
  for (let i = 1; i < panes(FRONT, 1.7); i++) {
    const u = b + (c - b) * i / panes(FRONT, 1.7);
    cell.solid(sink, context.material('window-frame'), u - 0.05, u + 0.05, y0, y1, PROJECT + 0.05, PROJECT, { back: false });
  }
  facetCap(sink, cell, cap, a, b, c, d, y0 - DIMENSIONS.sill, y0, false);
  facetCap(sink, cell, cap, a, b, c, d, y1, y1 + DIMENSIONS.head, true);
}

/**
 * The concrete sill or head that closes a faceted bay, following its plan. Its
 * face at the band boundary is left off: the head of the band below and the
 * sill of the band above fuse into one separator.
 */
function facetCap(sink: PartSink, cell: Cell, material: string, a: number, b: number, c: number, d: number, y0: number, y1: number, top: boolean): void {
  const ring: [number, number][] = [[a, 0], [b, PROJECT], [c, PROJECT], [d, 0]];
  for (let i = 0; i < ring.length - 1; i++) {
    const [ua, da] = ring[i]!, [ub, db] = ring[i + 1]!;
    const bl = cell.point(ua, y0, da), br = cell.point(ub, y0, db);
    const n: V3 = [(bl[2] - br[2]), 0, (br[0] - bl[0])];
    sink.quadFacing(material, bl, br, cell.point(ub, y1, db), cell.point(ua, y1, da), outward(cell, n),
      [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const y = top ? y0 : y1;
  sink.quadFacing(material, cell.point(a, y, 0), cell.point(b, y, PROJECT), cell.point(c, y, PROJECT), cell.point(d, y, 0),
    [0, top ? -1 : 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

function outward(cell: Cell, n: V3): V3 {
  const sign = n[0] * cell.outward[0] + n[2] * cell.outward[1] >= 0 ? 1 : -1;
  return [n[0] * sign, 0, n[2] * sign];
}

/** The 0.4 m vertical service window in the ivory pier. */
function slit(storey: number, u: number): Opening {
  return { u0: u - SLIT / 2, u1: u + SLIT / 2, y0: DIMENSIONS.sill + 0.4, y1: storey - DIMENSIONS.head - 0.4 };
}

function bay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  const openings: Opening[] = band === 'ground' ? [] : [{ u0: BAY_START, u1: BAY_END, y0: DIMENSIONS.sill, y1: storey - DIMENSIONS.head }];
  shellBody(context, cell, { height, recess: RECESS, openings, liningStart: liningStart(context, index, RECESS) });
  if (band !== 'ground') facetedBay(context, cell, BAY_START, BAY_END, storey);
  jointPier(sink, cell, context.material('column'), { width: PIER, depth: PANEL, y0: 0, y1: storey, caps: bandCaps(band) });
  jointRibbon(sink, cell, context.material('wall-trim'), {
    u0: BAY_START, u1: BAY_END, height: KIT.ribbon, depth: 0.05, bandHeight: height, ...ribbonEdges(band),
  });
  if (band === 'ground') {
    // Opaque panel field with a ledge under the cap that wraps the ground block.
    cell.solid(sink, context.material('ground'), BAY_START, BAY_END, height - 1.1, height - 0.75, 0.45, 0, { back: false });
    facetCap(sink, cell, context.material('wall-trim'), BAY_START, BAY_START + CHEEK, BAY_END - CHEEK, BAY_END,
      height - DIMENSIONS.head, height, true);
  }
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, 0.34, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

/** A corner is an ivory panel pier carrying the family's narrow vertical slot. */
function cornerArm(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  const storey = band === 'crown' ? storeyOf(height, CAP) : height;
  const sink = context.part('shell');
  const openings = band === 'ground' ? [] : [slit(storey, 1.6)];
  shellBody(context, cell, {
    height, recess: RECESS, openings, liningStart: liningStart(context, index, RECESS),
    openingFaces: [PANEL],
  });
  // One ivory panel column turns the corner and hands over to the bay's pier.
  cell.solid(sink, context.material('column'), 0, cell.length, 0, storey, PANEL, 0,
    { ...bandCaps(band), front: false, back: false, start: false, end: false });
  wall(sink, cell, context.material('column'), { u0: 0, u1: cell.length, y0: 0, y1: storey, openings, depth: PANEL });
  if (band === 'crown') {
    cell.solid(sink, context.material('roof'), 0, cell.length, storey, height, 0.34, 0,
      { back: false, bottom: false, start: false, end: false });
  }
}

function entranceBay(context: PieceContext, cell: Cell, index: number): void {
  const { band, height } = context;
  bay(context, cell, index);
  if (band !== 'ground') {
    signField(context, cell, {
      id: band === 'middle' ? 'sign:logo' : 'sign:screen', kind: band === 'middle' ? 'logo' : 'screen',
      u: KIT.bay / 2, y: height / 2, width: 2.4, height: 4.8, depth: PROJECT + 0.04,
    });
    return;
  }
  entrance(context, cell, { id: 'entry', u: KIT.bay / 2, width: 3.4, height: 3.2, glass: HOST_GLASS, frame: context.material('window-frame') });
  signField(context, cell, { id: 'sign:marquee', kind: 'marquee', u: KIT.bay / 2, y: height - 1.1, width: 4.6, height: 0.8, depth: 0.5 });
}

export const recipe: KitRecipe = {
  family: family.id,
  materials: { ...family.materials, glass: HOST_GLASS },
  heights: { ground: KIT.floorHeight, middle: KIT.floorHeight, crown: KIT.floorHeight + CAP },
  backing: RECESS,
  build(context) {
    for (const [index, cell] of context.runs.entries()) {
      if (context.piece === 'corner') cornerArm(context, cell, index);
      else if (context.piece === 'entrance-bay') entranceBay(context, cell, index);
      else bay(context, cell, index);
    }
    if (context.piece === 'corner') {
      cornerFillet(context.part('shell'), context.material('column'), PANEL, 0, context.height, bandCaps(context.band));
    }
  },
};
