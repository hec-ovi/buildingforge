import { tubeSegment, type DecorationContext, type FloorLayout, type Point, type V3 } from '../api.ts';
import type { Opening } from '../../types.ts';
import type { Surface } from './surface.ts';

/** One restrained clothes rack occupies the opaque sill field, away from windows and circulation. */
export function clothesline(context: DecorationContext, floor: FloorLayout, surface: Surface, window: Opening): void {
  const left = window.offset + .1, right = window.offset + window.width - .1, base = floor.elevation;
  if (right - left < 1.7 || !surface.clear({ left: left - .04, right: right + .04, bottom: base + .15, top: base + .84 })
    || surface.depth(left - .04, right + .04, .37) < .36) return;
  const { field } = surface, sink = context.builder.part(`courtyard:clothesline:${floor.index}:${window.id}`);
  const metal = context.material('courtyard-metal'), fabric = context.material('courtyard-cloth');
  const sample = (t: number) => base + .79 - .11 * 4 * t * (1 - t);
  // Fabric attachment heights interpolate the same five segments, so no clip floats off its line.
  const height = (u: number) => {
    const t = (u - left) / (right - left) * 5, start = Math.min(4, Math.floor(t)), f = t - start;
    return sample(start / 5) * (1 - f) + sample((start + 1) / 5) * f;
  };
  for (const u of [left, right]) tubeSegment(sink, metal, field.point(u, height(u), .035), field.point(u, height(u), .32), .014);
  for (let i = 0; i < 5; i++) {
    const u0 = left + (right - left) * i / 5, u1 = left + (right - left) * (i + 1) / 5;
    tubeSegment(sink, metal, field.point(u0, height(u0), .32), field.point(u1, height(u1), .32), .008);
  }
  for (const [index, fraction] of [.32, .7].entries()) {
    const centre = left + (right - left) * fraction, width = index === 0 ? .58 : .48, drop = index === 0 ? .4 : .32;
    for (const u of [centre - width / 2, centre + width / 2]) field.solid(sink, metal,
      u - .012, u + .012, height(u) - .04, height(u) + .018, .339, .309);
    for (let pleat = 0; pleat < 2; pleat++) {
      const u0 = centre - width / 2 + pleat * width / 2, u1 = u0 + width / 2;
      const a = field.point(u0, height(u0) - .018, .32), b = field.point(u1, height(u1) - .018, .32);
      const c = field.point(u1, height(u1) - drop, pleat === 0 ? .35 : .325);
      const d = field.point(u0, height(u0) - drop + .02, pleat === 0 ? .325 : .35);
      const n: V3 = [field.normal[0], 0, field.normal[1]];
      const uv: Point[] = [[0, 0], [width / 2, 0], [width / 2, drop], [0, drop]];
      sink.quadFacing(fabric, a, b, c, d, n, uv);
      sink.quadFacing(fabric, d, c, b, a, [-n[0], 0, -n[2]], [uv[3]!, uv[2]!, uv[1]!, uv[0]!]);
    }
  }
}
