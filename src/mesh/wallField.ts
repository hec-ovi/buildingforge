import type { P2 } from '../core/polygon.ts';
import { FacadeField } from './facadeField.ts';
import { cross, dot, sub, type PartSink, type V3 } from './primitives.ts';

interface Vertex { point: V3; uv: P2 }

/** Clip wall faces and returns to shared corner miters without moving opening cuts. */
export class WallField extends FacadeField {
  private readonly origin: P2;
  private readonly startSlope: number;
  private readonly endSlope: number;

  constructor(outline: P2[], edge: number) {
    super(outline, edge);
    this.origin = outline[edge]!;
    const along = (point: V3) => (point[0] - this.origin[0]) * this.dir[0] + (point[2] - this.origin[1]) * this.dir[1];
    this.startSlope = along(this.point(0, 0, 1));
    this.endSlope = along(this.point(this.length, 0, 1)) - this.length;
  }

  /** Points are facade-local [u, y, outward depth], with matching UVs. */
  face(sink: PartSink, material: string, points: V3[], outward: V3, uvs: P2[]): void {
    let polygon: Vertex[] = points.map(([u, y, depth], i) => ({
      point: [Math.abs(u) < 1e-8 ? Math.min(0, this.startSlope * depth)
        : Math.abs(u - this.length) < 1e-8 ? Math.max(this.length, this.length + this.endSlope * depth) : u, y, depth],
      uv: uvs[i]!,
    }));
    for (const distance of [
      ([u, , depth]: V3) => u - this.startSlope * depth,
      ([u, , depth]: V3) => this.length + this.endSlope * depth - u,
    ]) polygon = clip(polygon, distance);
    if (polygon.length < 3) return;
    const world = ({ point: [u, y, depth] }: Vertex): V3 => [this.origin[0] + this.dir[0] * u + this.normal[0] * depth,
      y, this.origin[1] + this.dir[1] * u + this.normal[1] * depth];
    const vertices = polygon.map(world);
    for (let i = 1; i + 1 < vertices.length; i++) {
      const a = vertices[0]!, b = vertices[i]!, c = vertices[i + 1]!;
      const normal = cross(sub(b, a), sub(c, a));
      if (dot(normal, normal) > 1e-16) sink.triFacing(material, a, b, c, outward, [polygon[0]!.uv, polygon[i]!.uv, polygon[i + 1]!.uv]);
    }
  }
}

function clip(polygon: Vertex[], distance: (point: V3) => number): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const da = distance(a.point), db = distance(b.point), insideA = da >= -1e-8, insideB = db >= -1e-8;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = da / (da - db);
      result.push({ point: a.point.map((value, axis) => value + (b.point[axis]! - value) * t) as V3,
        uv: a.uv.map((value, axis) => value + (b.uv[axis]! - value) * t) as P2 });
    }
  }
  return result;
}
