// What a facade already carries, per face, in (u, y) face coordinates: every
// opening, every aperture cut, the structural piers and the floor bands. A sign
// or a screen scans this for a clear rectangle before it lands, and the same map
// proves afterwards that nothing overlaps.

import { edgeLength, type P2 } from '../core/polygon.ts';
import type { CarvedAperture, FloorLayout } from './model.ts';
import type { Relief } from './relief.ts';
import { anchorRect, type AnchorSeat } from './anchors.ts';

export interface Rect {
  u0: number; u1: number; y0: number; y1: number;
  what: string;
  /**
   * `opening` is a door, a balcony door or an aperture mouth: nothing may ever
   * cover it. `relief` is structure standing `depth` off the wall (rib, column,
   * floor band, spandrel panel) and `glazing` is a window: an overlay may cross
   * either only by standing further out than it, and only when the facade has no
   * clear wall to offer.
   */
  kind: 'opening' | 'relief' | 'glazing';
  depth: number;
}

export interface ScanRequest {
  /** wanted size and where it would rather be */
  width: number;
  height: number;
  u: number;
  y: number;
  /** the rectangle must stay inside these bounds */
  uMin: number;
  uMax: number;
  yMin: number;
  yMax: number;
  /** clear gap to keep around the rectangle */
  margin: number;
  /** how far the width may shrink before the placement is given up, as a fraction */
  minScale: number;
}

export interface Placement {
  u: number; y: number; width: number; height: number;
  /** how far off the wall the overlay has to start to clear the relief it crosses */
  standoff: number;
}

/** A sign mounted over glazing clears the mullions by this much. */
const GLASS_PROUD = 0.1;

/** Everything already on the faces, keyed by edge index. */
export function faceObstacles(
  floors: FloorLayout[], carved: CarvedAperture[], anchors: AnchorSeat[], relief: Relief, top: number,
): Map<number, Rect[]> {
  const map = new Map<number, Rect[]>();
  const push = (edge: number, r: Rect) => {
    const list = map.get(edge) ?? [];
    list.push(r);
    map.set(edge, list);
  };

  for (const floor of floors) {
    if (floor.index < 0) continue;
    for (const o of floor.openings) {
      const glass = o.kind === 'window';
      const spandrel = o.spandrel ?? 0;
      const head = o.head ?? 0;
      // A curtain-wall bay is opaque panel up to its spandrel top: that part is
      // wall, not glass, and an overlay may sit on it.
      if (spandrel > 0) {
        push(o.edge, {
          u0: o.offset, u1: o.offset + o.width,
          y0: floor.elevation + o.sill, y1: floor.elevation + o.sill + spandrel,
          what: `spandrel ${o.id}`, kind: 'relief', depth: GLASS_PROUD,
        });
      }
      push(o.edge, {
        u0: o.offset, u1: o.offset + o.width,
        y0: floor.elevation + o.sill + spandrel,
        y1: floor.elevation + o.sill + o.height - head,
        what: `${glass ? 'glazing' : 'opening'} ${o.id}`,
        kind: glass ? 'glazing' : 'opening', depth: glass ? GLASS_PROUD : 0,
      });
      if (head > 0) {
        push(o.edge, {
          u0: o.offset, u1: o.offset + o.width,
          y0: floor.elevation + o.sill + o.height - head,
          y1: floor.elevation + o.sill + o.height,
          what: `head spandrel ${o.id}`, kind: 'relief', depth: GLASS_PROUD,
        });
      }
    }
  }

  for (const c of carved) {
    const us = c.facePoly.map((p) => p[0]);
    const ys = c.facePoly.map((p) => p[1]);
    push(c.aperture.face, {
      u0: Math.min(...us), u1: Math.max(...us), y0: Math.min(...ys), y1: Math.max(...ys),
      what: `aperture ${c.aperture.id}`, kind: 'opening', depth: 0,
    });
  }

  // A wire lands on its plate: nothing covers a mount.
  for (const a of anchors) push(a.edge, anchorRect(a, relief.outline));

  relief.byEdge.forEach((face, e) => {
    for (const u of face.ribs) {
      if (top > relief.verticalBase) push(e, { u0: u - relief.ribWidth / 2, u1: u + relief.ribWidth / 2, y0: relief.verticalBase, y1: top, what: 'rib', kind: 'relief', depth: relief.ribDepth });
    }
  });

  const faces = relief.outline.length;
  for (const [y0, y1] of relief.bands) {
    for (let e = 0; e < faces; e++) {
      push(e, { u0: 0, u1: edgeLength(relief.outline, e), y0, y1, what: 'floor band', kind: 'relief', depth: relief.bandDepth });
    }
  }
  return map;
}

/** Everything a rectangle would sit on. */
export function crossed(rects: Rect[] | undefined, r: Rect, margin = 0): Rect[] {
  return (rects ?? []).filter((o) =>
    r.u0 < o.u1 + margin && r.u1 > o.u0 - margin && r.y0 < o.y1 + margin && r.y1 > o.y0 - margin);
}

/**
 * Scans for a clear rectangle: the wanted size where it was asked for, then
 * stepping outward along the face and up and down, then the same search at
 * smaller sizes. Deterministic order, so one facade always lands the same way.
 */
export function findClearRect(rects: Rect[] | undefined, req: ScanRequest): Placement | null {
  const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5].filter((s) => s >= req.minScale - 1e-9);
  // First pass wants wall with nothing on it at all; then crossing relief (a rib,
  // a column, a band) proud of it; then, only for a facade with no bare wall at
  // all, crossing the glazing too. A door or an aperture is never covered.
  const passes: Rect['kind'][][] = [
    ['opening', 'relief', 'glazing'],
    ['opening', 'glazing'],
    ['opening'],
  ];
  for (const forbidden of passes) {
    for (const s of scales) {
      const width = req.width * s;
      const height = req.height * s;
      if (req.uMax - req.uMin < width || req.yMax - req.yMin < height) continue;
      const uc = clamp(req.u, req.uMin + width / 2, req.uMax - width / 2);
      const yc = clamp(req.y, req.yMin + height / 2, req.yMax - height / 2);
      for (const y of offsets(yc, 0.2, (req.yMax - req.yMin) / 2, req.yMin + height / 2, req.yMax - height / 2)) {
        for (const u of offsets(uc, 0.25, (req.uMax - req.uMin) / 2, req.uMin + width / 2, req.uMax - width / 2)) {
          const r: Rect = { u0: u - width / 2, u1: u + width / 2, y0: y - height / 2, y1: y + height / 2, what: 'candidate', kind: 'relief', depth: 0 };
          const on = crossed(rects, r, req.margin);
          if (on.some((o) => forbidden.includes(o.kind))) continue;
          return { u, y, width, height, standoff: standoffOver(on) };
        }
      }
    }
  }
  return null;
}

/** How far an overlay has to start off the wall to clear everything it sits on. */
export function standoffOver(on: Rect[]): number {
  const depth = on.reduce((d, o) => Math.max(d, o.depth), 0);
  return depth > 0 ? depth + 0.04 : 0;
}

/** Preferred value first, then alternating outward on a fixed step, inside the range. */
function offsets(start: number, step: number, reach: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let d = 0; d <= reach + step; d += step) {
    for (const v of d === 0 ? [start] : [start + d, start - d]) {
      if (v >= lo - 1e-9 && v <= hi + 1e-9) out.push(v);
    }
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** u of a world point along an edge, the coordinate the obstacle map is in. */
export function edgeU(outline: P2[], edge: number, x: number, z: number): number {
  const [vx, vz] = outline[edge] as P2;
  const [nx, nz] = outline[(edge + 1) % outline.length] as P2;
  const len = Math.hypot(nx - vx, nz - vz) || 1;
  return ((x - vx) * (nx - vx) + (z - vz) * (nz - vz)) / len;
}
