// Broad structural piers and floor bands shared by meshing and fixture placement.

import { edgeLength, type P2 } from '../core/polygon.ts';
import type { CarvedAperture, FloorLayout, Style } from './model.ts';
import { structuralProfile } from './structuralProfile.ts';

export interface FaceRelief {
  /** centre u of every broad structural pier on this face */
  ribs: number[];
}

export interface Relief {
  /** first above-ground walking surface; vertical trim leaves the street base clear */
  verticalBase: number;
  ribWidth: number;
  ribDepth: number;
  /** how far a floor band stands off the wall */
  bandDepth: number;
  /** floor bands as absolute [y0, y1], spanning every face */
  bands: [number, number][];
  /** by edge index of the ground outline; empty when the outline steps */
  byEdge: FaceRelief[];
  outline: P2[];
}

export function buildRelief(style: Style, floors: FloorLayout[], carved: CarvedAperture[]): Relief {
  const f = style.facade;
  const profile = structuralProfile(style);
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
      for (const fl of above.filter((floor) => floor.index > 0)) {
        for (const o of fl.openings) if (o.edge === e) forbidden.push([o.offset - 0.2, o.offset + o.width + 0.2]);
      }
      for (const c of carved) if (c.aperture.face === e) {
        const us = c.facePoly.map((p) => p[0]);
        forbidden.push([Math.min(...us) - 0.2, Math.max(...us) + 0.2]);
      }
      // One broad member occupies each sufficient solid run, with quiet wall between members.
      const ribs: number[] = [];
      let cursor = 0.3;
      const addPier = (start: number, end: number) => {
        if (end - start < profile.width) return;
        const center = (start + end) / 2;
        if (ribs.length && center - ribs[ribs.length - 1]! < 5) return;
        if (ribs.length < 4) ribs.push(center);
      };
      for (const [start, end] of forbidden.sort((a, b) => a[0] - b[0])) {
        addPier(cursor, Math.min(start, len - 0.3));
        cursor = Math.max(cursor, end);
      }
      addPier(cursor, len - 0.3);
      byEdge.push({ ribs });
    }
  }

  return {
    verticalBase: above[1] ? above[1].elevation + f.bandHeight / 2 : (ground ? ground.elevation + ground.height : 0),
    ribWidth: profile.width, ribDepth: profile.depth,
    bandDepth: f.bandProud, bands, byEdge, outline,
  };
}
