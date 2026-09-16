import type { PartSink, V3 } from '../api.ts';
import type { Surface } from './surface.ts';

/** A closed bevel strip, including its triangular end returns. */
export function fold(surface: Surface, sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, lower: number, upper: number, back: number): void {
  if (!surface.clear([u0, u1, y0, y1])) return;
  const p = (u: number, y: number, depth: number) => surface.point(u, y, depth);
  const n = surface.field.normal, d = surface.field.dir;
  const rise = y1 - y0, slope = lower - upper, length = Math.hypot(rise, slope);
  const normal: V3 = [n[0] * rise / length, slope / length, n[1] * rise / length];
  const front = [p(u0, y0, lower), p(u1, y0, lower), p(u1, y1, upper), p(u0, y1, upper)] as const;
  const uv: [number, number][] = [[u0, -y0], [u1, -y0], [u1, -y1], [u0, -y1]];
  sink.quadFacing(material, ...front, normal, uv);
  sink.quadFacing(material, p(u0, y0, back), p(u1, y0, back), p(u1, y1, back), p(u0, y1, back), [-n[0], 0, -n[1]], uv);
  sink.quadFacing(material, p(u0, y0, back), p(u1, y0, back), front[1], front[0], [0, -1, 0], [[u0, back], [u1, back], [u1, lower], [u0, lower]]);
  sink.quadFacing(material, p(u0, y1, back), p(u1, y1, back), front[2], front[3], [0, 1, 0], [[u0, back], [u1, back], [u1, upper], [u0, upper]]);
  for (const [u, sign] of [[u0, -1], [u1, 1]] as const) sink.quadFacing(material, p(u, y0, back), p(u, y0, lower), p(u, y1, upper), p(u, y1, back), [d[0] * sign, 0, d[1] * sign], [[back, -y0], [lower, -y0], [upper, -y1], [back, -y1]]);
}
