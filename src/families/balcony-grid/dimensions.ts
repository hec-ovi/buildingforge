import type { FamilyInput, Point } from '../api.ts';

export const BLOCK = 17;
export const PIER = 1;
export const ROOM_PAIR = 10;
export const GALLERY = 5;
export const GALLERY_DEPTH = 2;
export const RESERVE = 0.25;
export const END_ALLOWANCE = PIER + GALLERY_DEPTH;

export class BuildingFrame {
  readonly width: number;
  readonly depth: number;
  readonly axis: Point;
  readonly inward: Point;
  readonly origin: Point;

  constructor(input: FamilyInput) {
    const { rectangle, floorHeights } = input;
    if (rectangle.length !== 4 || rectangle.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) {
      throw new RangeError('balcony-grid requires four finite rectangle corners');
    }
    if (floorHeights.length < 2 || floorHeights.some(h => !Number.isFinite(h) || h < 3)) {
      throw new RangeError('balcony-grid requires a ground floor and upper floor, each at least 3 m tall');
    }
    const [a, b, c, d] = rectangle;
    const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const depth = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const cross = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const dot = (b[0] - a[0]) * (d[0] - a[0]) + (b[1] - a[1]) * (d[1] - a[1]);
    if (cross <= 0 || Math.abs(dot) > width * depth * 1e-8 ||
      Math.hypot(c[0] - b[0] - d[0] + a[0], c[1] - b[1] - d[1] + a[1]) > 1e-7) {
      throw new RangeError('balcony-grid requires a counterclockwise rectangle');
    }
    this.width = input.fixedFaces ? width : fitted(width);
    this.depth = input.fixedFaces ? depth : fitted(depth);
    if (Math.min(this.width, this.depth) < BLOCK + END_ALLOWANCE) {
      throw new RangeError('balcony-grid needs at least 20 m on both fitted sides');
    }
    this.axis = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
    this.inward = [(d[0] - a[0]) / depth, (d[1] - a[1]) / depth];
    this.origin = [a[0] + this.axis[0] * (width - this.width) / 2 + this.inward[0] * (depth - this.depth) / 2,
      a[1] + this.axis[1] * (width - this.width) / 2 + this.inward[1] * (depth - this.depth) / 2];
  }

  point(x: number, z: number): Point {
    return [this.origin[0] + x * this.axis[0] + z * this.inward[0],
      this.origin[1] + x * this.axis[1] + z * this.inward[1]];
  }

  rectangle(): [Point, Point, Point, Point] {
    return [this.point(0, 0), this.point(this.width, 0), this.point(this.width, this.depth), this.point(0, this.depth)];
  }
}

function fitted(maximum: number): number {
  return Math.floor((maximum - RESERVE * 2 - END_ALLOWANCE + 1e-8) / BLOCK) * BLOCK + END_ALLOWANCE;
}
