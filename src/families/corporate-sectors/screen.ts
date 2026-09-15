import type { DecorationContext } from '../api.ts';
import { Surface } from './surface.ts';

export function decorateScreen(context: DecorationContext): void {
  const { layout, builder, material } = context;
  const upper = layout.floors.filter(f => f.index >= 4);
  if (!upper.length) return;
  const first = upper[0]!, last = upper[upper.length - 1]!;
  const surface = new Surface(context, first, 2);
  const length = surface.field.length;
  const availableWidth = (length - 1) * 0.68 - 0.4;
  const availableHeight = last.elevation + last.height - first.elevation - 0.8;
  const height = Math.min(availableHeight, availableWidth * 2);
  const width = height / 2;
  const u0 = (length - width) / 2, u1 = u0 + width;
  const y0 = first.elevation + (availableHeight - height) / 2 + 0.4, y1 = y0 + height;
  for (const floor of upper) {
    const guard = new Surface(context, floor, 2);
    if (!guard.clear([u0 - 0.25, u1 + 0.25, y0 - 0.2, y1 + 0.2])) return;
  }
  builder.floor = first.index;
  const sink = builder.part('corporate:portrait-screen', { keepNode: true });
  const metal = material('window-frame'), front = Math.min(surface.margin, 1.04);
  const frame = (a: number, b: number, c: number, d: number) => surface.field.solid(sink, metal, a, b, c, d, front, front - 0.28, [0, 1], undefined, true);
  frame(u0 - 0.19, u0, y0 - 0.19, y1 + 0.19);
  frame(u1, u1 + 0.19, y0 - 0.19, y1 + 0.19);
  frame(u0, u1, y0 - 0.19, y0);
  frame(u0, u1, y1, y1 + 0.19);
  const field = surface.field;
  const point = (u: number, y: number) => field.point(u, y, front - 0.012);
  sink.quadFacing(material('screen'), point(u0, y0), point(u1, y0), point(u1, y1), point(u0, y1), [field.normal[0], 0, field.normal[1]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  for (const u of [u0 - 0.25, u1 + 0.25]) {
    surface.field.solid(sink, metal, u - 0.11, u + 0.11, y0, y1, front - 0.3, front - 0.6, [0, 1], undefined, true);
    for (let y = y0 + 0.6; y < y1; y += 3) surface.field.solid(sink, metal, u - 0.19, u + 0.19, y, y + 0.19, front - 0.1, front - 0.55, [0, 1], undefined, true);
  }
}
