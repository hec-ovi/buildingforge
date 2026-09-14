// Camera placements the preview offers, as plain vectors so they can be read
// and tested without a WebGL context.

import { edgeDir, edgeNormal, type P2 } from '../../core/polygon.ts';
import type { Blueprint, P3 } from '../../types.ts';

export type ViewMode = 'orbit' | 'eye' | 'interior' | 'corner' | 'reference';

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

/** A room-contained eye looking toward an authored corner or the nearest facade. */
export function interiorCamera(bp: Blueprint, outside = false): CameraPose {
  const floor = bp.floors.find(f => f.index === 1) ?? bp.floors.find(f => f.index === 0)!;
  const envelope = floor.roomEnvelope;
  const center: P2 = envelope
    ? [envelope.origin[0] + envelope.axisU[0] * envelope.width / 2 + envelope.axisV[0] * envelope.depth / 2,
      envelope.origin[1] + envelope.axisU[1] * envelope.width / 2 + envelope.axisV[1] * envelope.depth / 2]
    : [floor.outline.reduce((sum, p) => sum + p[0], 0) / floor.outline.length,
      floor.outline.reduce((sum, p) => sum + p[1], 0) / floor.outline.length];
  const plan = bp.assembly?.floors.find(f => f.floor === floor.index);
  const corner = plan?.sections.find(s => s.technique === 'rounded-glass' || s.technique === 'chamfered-glass');
  const face = corner?.edge ?? 1;
  const a = floor.outline[face]!, b = floor.outline[(face + 1) % floor.outline.length]!;
  let target: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let outward = edgeNormal(floor.outline, face);
  if (corner) {
    const spans = plan!.sections.filter(s => s.corner === corner.corner && s.technique === corner.technique)
      .flatMap(s => s.spans ?? [{ edge: s.edge }]);
    target = [0, 0]; outward = [0, 0];
    for (const span of spans) {
      const p = floor.outline[span.edge]!, q = floor.outline[(span.edge + 1) % floor.outline.length]!;
      const n = edgeNormal(floor.outline, span.edge);
      target[0] += (p[0] + q[0]) / (2 * spans.length);
      target[1] += (p[1] + q[1]) / (2 * spans.length);
      outward[0] += n[0]; outward[1] += n[1];
    }
    const length = Math.hypot(...outward);
    outward = [outward[0] / length, outward[1] / length];
  }
  let eye = center;
  if (outside) {
    eye = [target[0] + outward[0] * 8, target[1] + outward[1] * 8];
  } else if (envelope) {
    const nearest = [...envelope.corners].sort((p, q) => Math.hypot(p[0] - target[0], p[1] - target[1]) - Math.hypot(q[0] - target[0], q[1] - target[1]))[0]!;
    eye = [center[0] + (nearest[0] - center[0]) * 0.78, center[1] + (nearest[1] - center[1]) * 0.78];
  }
  return { position: [eye[0], floor.elevation + 1.7, eye[1]],
    target: [target[0], floor.elevation + 1.9, target[1]] };
}

/** Low street viewpoint for comparing the authored facade against its source view. */
export function referenceCamera(bp: Blueprint): CameraPose {
  const close = interiorCamera(bp, true);
  const ground = bp.floors.find(f => f.index === 0)!;
  const length = Math.hypot(close.position[0] - close.target[0], close.position[2] - close.target[2]);
  const nx = (close.position[0] - close.target[0]) / length, nz = (close.position[2] - close.target[2]) / length;
  return { position: [close.target[0] + nx * 55, ground.elevation + 1.7, close.target[2] + nz * 55],
    target: [close.target[0], bp.bounds.height * 0.4, close.target[2]] };
}
