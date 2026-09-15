import { FacadeField, type PartSink, type Point, type V3 } from '../api.ts';

export interface Rectangle { u0: number; u1: number; y0: number; y1: number }

function clip(polygon: Point[], axis: 0 | 1, boundary: number, keepGreater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const da = (a[axis] - boundary) * (keepGreater ? 1 : -1);
    const db = (b[axis] - boundary) * (keepGreater ? 1 : -1);
    if (da >= -1e-9) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

export function intersect(polygon: Point[], box: Rectangle): Point[] {
  return clip(clip(clip(clip(polygon, 0, box.u0, true), 0, box.u1, false), 1, box.y0, true), 1, box.y1, false);
}

function subtract(polygon: Point[], box: Rectangle): Point[][] {
  const middle = clip(clip(polygon, 0, box.u0, true), 0, box.u1, false);
  return [clip(polygon, 0, box.u0, false), clip(polygon, 0, box.u1, true),
    clip(middle, 1, box.y0, false), clip(middle, 1, box.y1, true)].filter(p => p.length >= 3);
}

/** Closed panels retain real thickness where a door or infrastructure cut interrupts them. */
export function panel(sink: PartSink, field: FacadeField, material: string, polygon: Point[], front: number, back: number, reservations: Rectangle[], mapping: 'world' | 'exact' = 'world'): void {
  if (polygon.length < 3) return;
  const minU = Math.min(...polygon.map(p => p[0])), maxU = Math.max(...polygon.map(p => p[0]));
  const minY = Math.min(...polygon.map(p => p[1])), maxY = Math.max(...polygon.map(p => p[1]));
  if (maxU - minU < 1e-8 || maxY - minY < 1e-8) return;
  let pieces = [polygon];
  for (const hole of reservations) pieces = pieces.flatMap(p => subtract(p, hole));
  const normal: V3 = [field.normal[0], 0, field.normal[1]];
  for (const raw of pieces) {
    const piece = raw.filter((p, i) => {
      const previous = raw[(i + raw.length - 1) % raw.length]!;
      return Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 1e-8;
    });
    if (piece.length < 3) continue;
    const area = piece.reduce((sum, p, i) => { const q = piece[(i + 1) % piece.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (Math.abs(area) < 1e-8) continue;
    const point = (p: Point, depth: number) => field.point(p[0], p[1], depth);
    const uv = (p: Point): Point => mapping === 'exact'
      ? [(p[0] - minU) / (maxU - minU), (maxY - p[1]) / (maxY - minY)] : [p[0], -p[1]];
    for (let i = 1; i < piece.length - 1; i++) {
      const a = piece[0]!, b = piece[i]!, c = piece[i + 1]!;
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-8) continue;
      sink.triFacing(material, point(a, front), point(b, front), point(c, front), normal, [uv(a), uv(b), uv(c)]);
      sink.triFacing(material, point(a, back), point(b, back), point(c, back), [-normal[0], 0, -normal[2]], [uv(a), uv(b), uv(c)]);
    }
    for (let i = 0; i < piece.length; i++) {
      const a = piece[i]!, b = piece[(i + 1) % piece.length]!;
      const du = b[0] - a[0], dy = b[1] - a[1];
      if (Math.hypot(du, dy) < 1e-8) continue;
      const sign = Math.sign(area);
      const outward: V3 = [field.dir[0] * dy * sign, -du * sign, field.dir[1] * dy * sign];
      const sideUv: Point[] = mapping === 'exact' ? [[0, 0], [1, 0], [1, 1], [0, 1]] :
        [[0, front], [Math.hypot(du, dy), front], [Math.hypot(du, dy), back], [0, back]];
      sink.quadFacing(material, point(a, front), point(b, front), point(b, back), point(a, back), outward, sideUv);
    }
  }
}

export const rectangle = (u0: number, u1: number, y0: number, y1: number): Point[] => [[u0, y0], [u1, y0], [u1, y1], [u0, y1]];
