import type { FacadeField } from './facadeField.ts';
import type { PartSink, V3 } from './primitives.ts';

/** Closed balcony body with two bevelled end faces and a broad opaque front. */
export function gardenCassette(sink: PartSink, field: FacadeField, material: string,
  a: number, b: number, bottom: number, top: number, front: number, back: number): void {
  const bevel = Math.min(0.7, (b - a) / 8);
  const ring: [number, number][] = [[a, back], [b, back], [b, front - 0.28],
    [b - bevel, front], [a + bevel, front], [a, front - 0.28]];
  const at = (p: [number, number], y: number) => field.point(p[0], y, p[1]);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
    const du = q[0] - p[0], dd = q[1] - p[1];
    const normal: V3 = [field.dir[0] * dd - field.normal[0] * du, 0, field.dir[1] * dd - field.normal[1] * du];
    sink.quadFacing(material, at(p, bottom), at(q, bottom), at(q, top), at(p, top), normal,
      [[0, 0], [Math.hypot(du, dd), 0], [Math.hypot(du, dd), top - bottom], [0, top - bottom]]);
  }
  for (const [y, up] of [[bottom, -1], [top, 1]] as const) for (let i = 1; i < ring.length - 1; i++) {
    sink.triFacing(material, at(ring[0]!, y), at(ring[i]!, y), at(ring[i + 1]!, y), [0, up, 0],
      [ring[0]!, ring[i]!, ring[i + 1]!]);
  }
  if (top - bottom > 0.4) {
    for (let left = a + bevel; left < b - bevel - 1e-8; left += 2) {
      field.solid(sink, material, left + 0.012, Math.min(b - bevel, left + 2) - 0.012,
        bottom + 0.012, top - 0.012, front + 0.018, front, [0, 1],
        { start: true, end: true, back: false }, true);
    }
  }
}
