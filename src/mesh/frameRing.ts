// One fitted window-frame ring with front, back, outer and inner boundary faces.

import type { P2 } from '../core/polygon.ts';
import { scale, type PartSink, type V3 } from './primitives.ts';

export interface FrameBasis {
  v: P2;
  dir: P2;
  n: P2;
}

export interface FrameRect {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** Extrudes one rectangular ring without overlapping corner plates. */
export function meshFrameRing(
  sink: PartSink, basis: FrameBasis, outer: FrameRect, inner: FrameRect,
  front: number, depth: number, material: string,
): void {
  const back = front - depth;
  const members: FrameRect[] = [
    { u0: outer.u0, u1: inner.u0, y0: inner.y1, y1: outer.y1 },
    { u0: inner.u0, u1: inner.u1, y0: inner.y1, y1: outer.y1 },
    { u0: inner.u1, u1: outer.u1, y0: inner.y1, y1: outer.y1 },
    { u0: outer.u0, u1: inner.u0, y0: outer.y0, y1: inner.y0 },
    { u0: inner.u0, u1: inner.u1, y0: outer.y0, y1: inner.y0 },
    { u0: inner.u1, u1: outer.u1, y0: outer.y0, y1: inner.y0 },
    { u0: outer.u0, u1: inner.u0, y0: inner.y0, y1: inner.y1 },
    { u0: inner.u1, u1: outer.u1, y0: inner.y0, y1: inner.y1 },
  ];

  for (const member of members) {
    plate(sink, basis, member, front, basis.n, material);
    plate(sink, basis, member, back, scale(normal3(basis), -1), material);
  }

  const verticalSections: [number, number][] = [
    [outer.y0, inner.y0], [inner.y0, inner.y1], [inner.y1, outer.y1],
  ];
  for (const [y0, y1] of verticalSections) {
    sideU(sink, basis, outer.u0, y0, y1, front, back, -1, material);
    sideU(sink, basis, outer.u1, y0, y1, front, back, 1, material);
  }
  const horizontalSections: [number, number][] = [
    [outer.u0, inner.u0], [inner.u0, inner.u1], [inner.u1, outer.u1],
  ];
  for (const [u0, u1] of horizontalSections) {
    sideY(sink, basis, u0, u1, outer.y0, front, back, -1, material);
    sideY(sink, basis, u0, u1, outer.y1, front, back, 1, material);
  }

  sideU(sink, basis, inner.u0, inner.y0, inner.y1, front, back, 1, material);
  sideU(sink, basis, inner.u1, inner.y0, inner.y1, front, back, -1, material);
  sideY(sink, basis, inner.u0, inner.u1, inner.y0, front, back, 1, material);
  sideY(sink, basis, inner.u0, inner.u1, inner.y1, front, back, -1, material);
}

function plate(
  sink: PartSink, basis: FrameBasis, rect: FrameRect, d: number,
  outward: P2 | V3, material: string,
): void {
  if (rect.u1 - rect.u0 < 1e-6 || rect.y1 - rect.y0 < 1e-6) return;
  const normal: V3 = outward.length === 2
    ? [outward[0], 0, outward[1]]
    : outward as V3;
  sink.quadFacing(material,
    point(basis, rect.u0, rect.y0, d), point(basis, rect.u1, rect.y0, d),
    point(basis, rect.u1, rect.y1, d), point(basis, rect.u0, rect.y1, d),
    normal, faceUv(rect.u1 - rect.u0, rect.y1 - rect.y0, true));
}

function sideU(
  sink: PartSink, basis: FrameBasis, u: number, y0: number, y1: number,
  front: number, back: number, sign: number, material: string,
): void {
  const outward: V3 = [basis.dir[0] * sign, 0, basis.dir[1] * sign];
  sink.quadFacing(material,
    point(basis, u, y0, front), point(basis, u, y0, back),
    point(basis, u, y1, back), point(basis, u, y1, front),
    outward, faceUv(front - back, y1 - y0, true));
}

function sideY(
  sink: PartSink, basis: FrameBasis, u0: number, u1: number, y: number,
  front: number, back: number, sign: number, material: string,
): void {
  sink.quadFacing(material,
    point(basis, u0, y, front), point(basis, u1, y, front),
    point(basis, u1, y, back), point(basis, u0, y, back),
    [0, sign, 0], faceUv(u1 - u0, front - back, true));
}

function point(basis: FrameBasis, u: number, y: number, d: number): V3 {
  return [
    basis.v[0] + basis.dir[0] * u + basis.n[0] * d,
    y,
    basis.v[1] + basis.dir[1] * u + basis.n[1] * d,
  ];
}

function normal3(basis: FrameBasis): V3 {
  return [basis.n[0], 0, basis.n[1]];
}

function faceUv(width: number, height: number, along: boolean): [number, number][] {
  if (along && height > width) return [[0, 0], [0, width], [height, width], [height, 0]];
  return [[0, 0], [width, 0], [width, height], [0, height]];
}
