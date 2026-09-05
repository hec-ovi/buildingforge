import type { BuildingGrid, P2 } from '../types.ts';
import { orientedBoundingBox, ringInsidePolygon } from '../core/polygon.ts';
import { MODULE } from '../rules/tables.ts';

interface Bounds { u0: number; v0: number; u1: number; v1: number }

/** Whole rectangular plates on one construction lattice, independent of facade panels. */
export class PlateGrid {
  readonly grid: BuildingGrid;
  private readonly cosine: number;
  private readonly sine: number;

  constructor(parcel: P2[], supplied?: BuildingGrid) {
    const obb = orientedBoundingBox(parcel);
    this.grid = supplied ?? {
      origin: [obb.center[0] - obb.axisU[0] * obb.halfU - obb.axisV[0] * obb.halfV,
        obb.center[1] - obb.axisU[1] * obb.halfU - obb.axisV[1] * obb.halfV],
      angle: Math.atan2(obb.axisU[1], obb.axisU[0]),
      spacing: MODULE,
    };
    this.cosine = Math.cos(this.grid.angle);
    this.sine = Math.sin(this.grid.angle);
  }

  /** Largest accepted grid rectangle, with a complete perimeter clearance. */
  fit(parcel: P2[], clearance: number, accept: (ring: P2[]) => boolean): P2[] | null {
    const local = parcel.map((p) => this.project(p));
    const bounds = this.bounds(local);
    const u0 = this.up(bounds.u0 + clearance), v0 = this.up(bounds.v0 + clearance);
    const u1 = this.down(bounds.u1 - clearance), v1 = this.down(bounds.v1 - clearance);
    const columns = u1 - u0, rows = v1 - v0;
    if (columns <= 0 || rows <= 0) return null;
    const full = { u0, v0, u1, v1 };
    const inside = (b: Bounds) => ringInsidePolygon(local, this.localRing(b, clearance));
    const world = (b: Bounds) => this.localRing(b).map((p) => this.unproject(p));
    if (inside(full)) {
      const ring = world(full);
      return accept(ring) ? ring : null;
    }

    // Each occupied cell is entirely in the parcel. A histogram scan enumerates
    // maximal rectangles, including off-centre seats in concave parcels.
    const heights = new Uint32Array(columns);
    const candidates: Bounds[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = { u0: u0 + column, v0: v0 + row, u1: u0 + column + 1, v1: v0 + row + 1 };
        heights[column] = inside(cell) ? heights[column]! + 1 : 0;
      }
      const stack: { start: number; height: number }[] = [];
      for (let column = 0; column <= columns; column++) {
        const height = column === columns ? 0 : heights[column]!;
        let start = column;
        while (stack.length && stack.at(-1)!.height > height) {
          const previous = stack.pop()!;
          start = previous.start;
          candidates.push({ u0: u0 + start, u1: u0 + column,
            v0: v0 + row + 1 - previous.height, v1: v0 + row + 1 });
        }
        if (height > 0 && (!stack.length || stack.at(-1)!.height < height)) stack.push({ start, height });
      }
    }
    const size = (b: Bounds) => (b.u1 - b.u0) * (b.v1 - b.v0);
    candidates.sort((a, b) => size(b) - size(a) || a.v0 - b.v0 || a.u0 - b.u0 || b.u1 - a.u1);
    for (const candidate of candidates) {
      const ring = world(candidate);
      if (accept(ring)) return ring;
    }
    return null;
  }

  /** Insets a rectangular plate by whole cells, preserving all four grid phases. */
  inset(ring: P2[], distance: number): P2[] | null {
    const bounds = this.bounds(ring.map((p) => this.project(p)));
    const next = {
      u0: this.up(bounds.u0 + distance), v0: this.up(bounds.v0 + distance),
      u1: this.down(bounds.u1 - distance), v1: this.down(bounds.v1 - distance),
    };
    if (next.u1 <= next.u0 || next.v1 <= next.v0) return null;
    return this.localRing(next).map((p) => this.unproject(p));
  }

  private up(value: number): number { return Math.ceil(value / this.grid.spacing - 1e-8); }
  private down(value: number): number { return Math.floor(value / this.grid.spacing + 1e-8); }

  private localRing(bounds: Bounds, margin = 0): P2[] {
    const s = this.grid.spacing;
    const left = bounds.u0 * s - margin, right = bounds.u1 * s + margin;
    const bottom = bounds.v0 * s - margin, top = bounds.v1 * s + margin;
    return [[left, bottom], [right, bottom], [right, top], [left, top]];
  }

  private project(point: P2): P2 {
    const x = point[0] - this.grid.origin[0], z = point[1] - this.grid.origin[1];
    return [x * this.cosine + z * this.sine, z * this.cosine - x * this.sine];
  }

  private unproject(point: P2): P2 {
    return [this.grid.origin[0] + point[0] * this.cosine - point[1] * this.sine,
      this.grid.origin[1] + point[0] * this.sine + point[1] * this.cosine];
  }

  private bounds(ring: P2[]): Bounds {
    return { u0: Math.min(...ring.map((p) => p[0])), v0: Math.min(...ring.map((p) => p[1])),
      u1: Math.max(...ring.map((p) => p[0])), v1: Math.max(...ring.map((p) => p[1])) };
  }
}
