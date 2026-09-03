// Camera placements the preview offers, as plain vectors so they can be read
// and tested without a WebGL context.

import { edgeDir, edgeNormal, type P2 } from '../../core/polygon.ts';
import type { Blueprint, P3 } from '../../types.ts';

export type ViewMode = 'orbit' | 'eye';

export interface CameraPose { position: P3; target: P3 }

/** Whole building from outside, framed to fit the field of view. */
export function orbitCamera(center: P3, radius: number, fovDeg: number): CameraPose {
  const distance = (radius / Math.sin((fovDeg * Math.PI) / 360)) * 1.1;
  const dir = [1, 0.55, 1];
  const len = Math.hypot(dir[0] as number, dir[1] as number, dir[2] as number);
  return {
    position: [
      center[0] + ((dir[0] as number) / len) * distance,
      center[1] + ((dir[1] as number) / len) * distance,
      center[2] + ((dir[2] as number) / len) * distance,
    ],
    target: center,
  };
}

/**
 * Standing on the pavement in front of the entrance: eye 1.7 m above the ground
 * floor, looking at the door head. This is the view door and window proportions
 * are judged in, so it reads what a player reads.
 */
export function streetEyeCamera(bp: Blueprint, standoff = 10): CameraPose {
  const ground = bp.floors.find((f) => f.index === 0) ?? bp.floors[0]!;
  const door = ground.openings.find((o) => o.accessRole === 'main')
    ?? ground.openings.find((o) => o.id === 'entrance')
    ?? ground.openings.find((o) => o.kind === 'door');
  const outline = ground.outline;
  const edge = door ? door.edge : longestEdge(outline);
  const [vx, vz] = outline[edge] as P2;
  const d = edgeDir(outline, edge);
  const n = edgeNormal(outline, edge);
  const u = door ? door.offset + door.width / 2 : edgeMid(outline, edge);
  const head = door ? door.sill + door.height : 3;
  const x = vx + d[0] * u;
  const z = vz + d[1] * u;
  return {
    position: [x + n[0] * standoff, 1.7, z + n[1] * standoff],
    target: [x, head, z],
  };
}

function longestEdge(outline: P2[]): number {
  let best = 0, len = -1;
  for (let e = 0; e < outline.length; e++) {
    const L = segmentLength(outline, e);
    if (L > len) { len = L; best = e; }
  }
  return best;
}

function edgeMid(outline: P2[], e: number): number {
  return segmentLength(outline, e) / 2;
}

function segmentLength(outline: P2[], e: number): number {
  const [ax, az] = outline[e] as P2;
  const [bx, bz] = outline[(e + 1) % outline.length] as P2;
  return Math.hypot(bx - ax, bz - az);
}
