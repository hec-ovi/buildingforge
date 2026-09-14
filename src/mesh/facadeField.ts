import { edgeDir, edgeLength, edgeNormal, type P2 } from '../core/polygon.ts';
import type { PartSink, V3 } from './primitives.ts';

/** A closed field follows shared offset miters at geometric curve segments. */
export class FacadeField {
  readonly dir: P2;
  readonly normal: P2;
  readonly length: number;
  private readonly outline: P2[];
  private readonly edge: number;

  constructor(outline: P2[], edge: number) {
    this.outline = outline;
    this.edge = edge;
    this.dir = edgeDir(outline, edge);
    this.normal = edgeNormal(outline, edge);
    this.length = edgeLength(outline, edge);
  }

  point(u: number, y: number, depth: number): V3 {
    const atEnd = Math.abs(u - this.length) < 1e-7, atStart = Math.abs(u) < 1e-7;
    if (atStart || atEnd) {
      const vertex = (this.edge + (atEnd ? 1 : 0)) % this.outline.length;
      const p = this.outline[vertex]!;
      const prev = edgeNormal(this.outline, (vertex + this.outline.length - 1) % this.outline.length);
      const next = edgeNormal(this.outline, vertex);
      const denominator = 1 + prev[0] * next[0] + prev[1] * next[1];
      return [p[0] + depth * (prev[0] + next[0]) / denominator, y, p[1] + depth * (prev[1] + next[1]) / denominator];
    }
    const p = this.outline[this.edge]!;
    return [p[0] + this.dir[0] * u + this.normal[0] * depth, y, p[1] + this.dir[1] * u + this.normal[1] * depth];
  }

  solid(sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front: number, back: number, mapU: [number, number] = [0, 1], ends = { start: true, end: true }, worldUv = false): void {
    if (u1 - u0 < 1e-8 || y1 - y0 < 1e-8) return;
    const point = (u: number, y: number, d: number) => this.point(u, y, d);
    const n: V3 = [this.normal[0], 0, this.normal[1]], d: V3 = [this.dir[0], 0, this.dir[1]];
    const uv: P2[] = worldUv ? [[u0, -y0], [u1, -y0], [u1, -y1], [u0, -y1]]
      : [[mapU[0], 1], [mapU[1], 1], [mapU[1], 0], [mapU[0], 0]];
    const sideUv: P2[] = worldUv ? [[front, -y0], [front, -y1], [back, -y1], [back, -y0]] : uv;
    const capUv: P2[] = worldUv ? [[u0, front], [u1, front], [u1, back], [u0, back]] : uv;
    sink.quadFacing(material, point(u0, y0, front), point(u1, y0, front), point(u1, y1, front), point(u0, y1, front), n, uv);
    sink.quadFacing(material, point(u0, y0, back), point(u1, y0, back), point(u1, y1, back), point(u0, y1, back), [-n[0], 0,-n[2]], uv);
    if (ends.start) sink.quadFacing(material, point(u0, y0, front), point(u0, y1, front), point(u0, y1, back), point(u0, y0, back), [-d[0], 0,-d[2]], sideUv);
    if (ends.end) sink.quadFacing(material, point(u1, y0, front), point(u1, y1, front), point(u1, y1, back), point(u1, y0, back), d, sideUv);
    sink.quadFacing(material, point(u0, y0, front), point(u1, y0, front), point(u1, y0, back), point(u0, y0, back), [0, -1, 0],capUv);
    sink.quadFacing(material, point(u0, y1, front), point(u1, y1, front), point(u1, y1, back), point(u0, y1, back), [0, 1, 0],capUv);
  }
}
