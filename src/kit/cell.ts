// One straight facade run inside a piece's own frame.
//
// Piece frame: +X is the run of the first arm, +Y is up, +Z is inward. A cell
// carries its own run and outward directions so a corner's two arms share one
// set of helpers, and `depth` is outward everywhere, as it is on the host's
// FacadeField.

import type { PartSink, V3 } from '../mesh/primitives.ts';

export type Dir = [number, number];

export interface Ends { front?: boolean; start?: boolean; end?: boolean; back?: boolean; bottom?: boolean; top?: boolean }

export class Cell {
  readonly origin: Dir;
  readonly run: Dir;
  readonly outward: Dir;
  readonly length: number;

  constructor(origin: Dir, run: Dir, outward: Dir, length: number) {
    this.origin = origin;
    this.run = run;
    this.outward = outward;
    this.length = length;
  }

  point(u: number, y: number, depth = 0): V3 {
    return [
      this.origin[0] + this.run[0] * u + this.outward[0] * depth,
      y,
      this.origin[1] + this.run[1] * u + this.outward[1] * depth,
    ];
  }

  get normal(): V3 { return [this.outward[0], 0, this.outward[1]]; }
  get axis(): V3 { return [this.run[0], 0, this.run[1]]; }

  /** One outward-facing plate on a plane parallel to the face. UVs are world metres. */
  plate(sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, depth: number, facing = 1): void {
    if (u1 - u0 < 1e-9 || y1 - y0 < 1e-9) return;
    const n: V3 = [this.outward[0] * facing, 0, this.outward[1] * facing];
    sink.quadFacing(material, this.point(u0, y0, depth), this.point(u1, y0, depth),
      this.point(u1, y1, depth), this.point(u0, y1, depth), n,
      [[u0, -y0], [u1, -y0], [u1, -y1], [u0, -y1]]);
  }

  /** A horizontal plate: a soffit when `facing` is -1, a top cap when +1. */
  cap(sink: PartSink, material: string, u0: number, u1: number, y: number, front: number, back: number, facing: number): void {
    if (u1 - u0 < 1e-9 || Math.abs(front - back) < 1e-9) return;
    sink.quadFacing(material, this.point(u0, y, front), this.point(u1, y, front),
      this.point(u1, y, back), this.point(u0, y, back), [0, facing, 0],
      [[u0, front], [u1, front], [u1, back], [u0, back]]);
  }

  /**
   * A closed block on the face: front, back, two u-ends and two caps. Every
   * face is optional, so a half pier at a run boundary drops the end the
   * neighbour supplies and a half ribbon drops the cap the band above supplies.
   */
  solid(sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front: number, back: number, ends: Ends = {}): void {
    if (u1 - u0 < 1e-9 || y1 - y0 < 1e-9) return;
    const d: V3 = this.axis;
    if (ends.front !== false) this.plate(sink, material, u0, u1, y0, y1, front);
    if (ends.back !== false) this.plate(sink, material, u0, u1, y0, y1, back, -1);
    if (ends.start !== false) {
      sink.quadFacing(material, this.point(u0, y0, front), this.point(u0, y1, front),
        this.point(u0, y1, back), this.point(u0, y0, back), [-d[0], 0, -d[2]],
        [[front, -y0], [front, -y1], [back, -y1], [back, -y0]]);
    }
    if (ends.end !== false) {
      sink.quadFacing(material, this.point(u1, y0, front), this.point(u1, y1, front),
        this.point(u1, y1, back), this.point(u1, y0, back), d,
        [[front, -y0], [front, -y1], [back, -y1], [back, -y0]]);
    }
    if (ends.bottom !== false) this.cap(sink, material, u0, u1, y0, front, back, -1);
    if (ends.top !== false) this.cap(sink, material, u0, u1, y1, front, back, 1);
  }
}

/** A straight bay run: the piece frame's +X axis, outward -Z. */
export function bayCell(length: number): Cell {
  return new Cell([0, 0], [1, 0], [0, -1], length);
}

/**
 * A corner piece's two arms, both measured outward from the corner at the piece
 * origin: arm A along +X, arm B along +Z. Each arm ends at a run boundary, so a
 * bay's own boundary section mates with either. Every face is wound from an
 * explicit outward direction, so arm B needs no separate mirrored path.
 */
export function cornerCells(arm: number): [Cell, Cell] {
  return [new Cell([0, 0], [1, 0], [0, -1], arm), new Cell([0, 0], [0, 1], [-1, 0], arm)];
}

/** The outside square column a projecting corner leaves between its two arms. */
export function cornerFillet(sink: PartSink, material: string, depth: number, y0: number, y1: number, ends: Ends = {}): void {
  if (depth < 1e-9 || y1 - y0 < 1e-9) return;
  const p = (x: number, y: number, z: number): V3 => [x, y, z];
  const faces: [V3, V3, V3, V3, V3][] = [
    [p(-depth, y0, 0), p(-depth, y0, -depth), p(-depth, y1, -depth), p(-depth, y1, 0), [-1, 0, 0]],
    [p(-depth, y0, -depth), p(0, y0, -depth), p(0, y1, -depth), p(-depth, y1, -depth), [0, 0, -1]],
  ];
  for (const [a, b, c, d, n] of faces) {
    sink.quadFacing(material, a, b, c, d, n, [[0, -y0], [depth, -y0], [depth, -y1], [0, -y1]]);
  }
  for (const [y, n] of [[y0, -1], [y1, 1]] as [number, number][]) {
    if (n < 0 ? ends.bottom === false : ends.top === false) continue;
    sink.quadFacing(material, p(-depth, y, -depth), p(0, y, -depth), p(0, y, 0), p(-depth, y, 0), [0, n, 0],
      [[0, 0], [depth, 0], [depth, depth], [0, depth]]);
  }
}
