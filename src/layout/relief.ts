// Where the facade's structure lands: the ribs on the panel grid, the perimeter
// columns and the floor bands. The mesher builds from this and the placement
// scan avoids it, so a sign can never sit on a rib the mesher drew somewhere
// else.

import { MODULE_U, OPENING } from '../rules/tables.ts';
import { edgeLength, type P2 } from '../core/polygon.ts';
import type { CarvedAperture, FloorLayout, Style } from './model.ts';

/** A perimeter column stands this far off the wall (the mesher builds it there). */
export const COLUMN_PROUD = 0.12;

export interface FaceRelief {
  /** center u of every vertical rib on this face */
  ribs: number[];
  /** center u of every perimeter column on this face */
  columns: number[];
}

export interface Relief {
  ribWidth: number;
  ribDepth: number;
  columnWidth: number;
  /** how far a column and a floor band stand off the wall */
  columnDepth: number;
  bandDepth: number;
  /** floor bands as absolute [y0, y1], spanning every face */
  bands: [number, number][];
  /** by edge index of the ground outline; empty when the outline steps */
  byEdge: FaceRelief[];
  outline: P2[];
}

export function buildRelief(style: Style, floors: FloorLayout[], carved: CarvedAperture[]): Relief {
  const f = style.facade;
  const above = floors.filter((fl) => fl.index >= 0);
  const ground = above[0];
  const constant = above.length > 0 && above.every((fl) => fl.outline === ground!.outline);
  const outline = ground?.outline ?? [];

  const bands: [number, number][] = [];
  if (f.bandHeight > 0) {
    for (const fl of above) {
      if (fl.index === 0) continue; // the ground band would sit on the pavement
      bands.push([fl.elevation - f.bandHeight / 2, fl.elevation + f.bandHeight / 2]);
    }
  }

  const byEdge: FaceRelief[] = [];
  if (constant) {
    for (let e = 0; e < outline.length; e++) {
      const len = edgeLength(outline, e);
      // No rib and no column ever lands on an opening or an aperture cut.
      const forbidden: [number, number][] = [];
      for (const fl of above) for (const o of fl.openings) if (o.edge === e) forbidden.push([o.offset - 0.2, o.offset + o.width + 0.2]);
      for (const c of carved) if (c.aperture.face === e) {
        const us = c.facePoly.map((p) => p[0]);
        forbidden.push([Math.min(...us) - 0.2, Math.max(...us) + 0.2]);
      }
      const clear = (u: number, w: number) => !forbidden.some(([a, b]) => u + w / 2 > a && u - w / 2 < b);
      // Ribs stand on panel seams; a column is one panel wide and covers whole panels from a grid line.
      const ribs: number[] = [];
      if (f.ribWidth > 0) {
        const pitch = Math.max(MODULE_U, Math.round(f.panelModule / MODULE_U) * MODULE_U);
        for (let u = pitch; u < len - f.ribWidth / 2; u += pitch) if (clear(u, f.ribWidth)) ribs.push(u);
      }
      const columns: number[] = [];
      if (style.showColumns) {
        const w = MODULE_U;
        const pitch = Math.max(2 * MODULE_U, Math.round(style.columnSpacing / MODULE_U) * MODULE_U);
        for (let u = OPENING.cornerMargin + pitch + w / 2; u < len - w; u += pitch) if (clear(u, w)) columns.push(u);
      }
      byEdge.push({ ribs, columns });
    }
  }

  return {
    ribWidth: f.ribWidth, ribDepth: f.ribDepth, columnWidth: MODULE_U,
    columnDepth: COLUMN_PROUD, bandDepth: f.bandProud, bands, byEdge, outline,
  };
}
