// Wire anchors: the attach point a wire from the connections layer lands on and
// the mount plate it sits on. A punched facade keeps the plate's footprint clear
// of openings; a curtain wall glazes straight across it and the plate stands
// proud of the mullions.

import { ANCHOR_MOUNT } from '../rules/tables.ts';
import { edgeDir, edgeNormal, quant, type P2 } from '../core/polygon.ts';
import { crossed, edgeU, standoffOver, type Rect } from './obstructions.ts';
import type { Aperture, P3 } from '../types.ts';

export interface AnchorSeat {
  id: string;
  /** attach point on the face plane */
  position: P3;
  normal: P2;
  edge: number;
  /** plate side: the cut plus a margin, inside the plate range */
  size: number;
}

export interface AnchorMount extends AnchorSeat {
  /** where the plate's back plane sits, off the wall */
  standoff: number;
}

/** The seat of a wire anchor: the cut's center on its face, the plate sized to cover the cut. */
export function anchorSeat(a: Aperture, outline: P2[], minU: number, maxU: number): AnchorSeat {
  const [vx, vz] = outline[a.face] as P2;
  const d = edgeDir(outline, a.face);
  const uc = (minU + maxU) / 2;
  const [lo, hi] = ANCHOR_MOUNT.plate;
  const extent = Math.max(maxU - minU, a.height) + ANCHOR_MOUNT.plateMargin;
  return {
    id: a.id,
    edge: a.face,
    position: [vx + d[0] * uc, a.base + a.height / 2, vz + d[1] * uc],
    normal: edgeNormal(outline, a.face),
    size: Math.min(hi, Math.max(lo, quant(extent))),
  };
}

/**
 * Seats every plate off the wall, proud of the mullions, ribs and bands its
 * footprint crosses. The footprint itself is on the map as something never
 * covered; a door or an aperture mouth is never under an anchor, the facade
 * kept them apart.
 */
export function mountAnchors(seats: AnchorSeat[], outline: P2[], obstacles: Map<number, Rect[]>): AnchorMount[] {
  return seats.map((s) => {
    const rect = anchorRect(s, outline);
    const under = crossed(obstacles.get(s.edge), rect).filter((o) => o.kind !== 'opening');
    return { ...s, standoff: standoffOver(under) };
  });
}

/** The plate's footprint on its face, in the obstacle map's (u, y) coordinates. */
export function anchorRect(s: AnchorSeat, outline: P2[]): Rect {
  const u = edgeU(outline, s.edge, s.position[0], s.position[2]);
  const half = s.size / 2;
  return {
    u0: u - half, u1: u + half, y0: s.position[1] - half, y1: s.position[1] + half,
    what: `anchor ${s.id}`, kind: 'opening', depth: 0,
  };
}
