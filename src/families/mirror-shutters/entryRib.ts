import type { PartSink, V3 } from '../api.ts';
import { FacadeField } from '../api.ts';

/** A closed, swept quarter-ellipse with an inset luminous edge. */
export function entryRib(sink: PartSink, field: FacadeField, u: number, rise: number,
  projection: number, metal: string, light: string): void {
  const width = 0.32, thickness = 0.22, segments = 20;
  const uv: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const station = (i: number, side: number, skin: number): V3 => {
    const t = i / segments * Math.PI / 2;
    const y = 0.45 + rise * Math.sin(t), depth = projection * Math.cos(t);
    const dy = rise * Math.cos(t), dd = -projection * Math.sin(t), length = Math.hypot(dy, dd);
    return field.point(u + side * width / 2, y - skin * dd / length * thickness / 2,
      depth + skin * dy / length * thickness / 2);
  };
  const direction: V3 = [field.dir[0], 0, field.dir[1]];
  for (let i = 0; i < segments; i++) {
    const a = station(i, -1, -1), b = station(i, 1, -1), c = station(i + 1, 1, -1), d = station(i + 1, -1, -1);
    const e = station(i, -1, 1), f = station(i, 1, 1), g = station(i + 1, 1, 1), h = station(i + 1, -1, 1);
    sink.quadFacing(metal, a, b, c, d, [-field.normal[0], -1, -field.normal[1]], uv);
    sink.quadFacing(metal, e, f, g, h, [field.normal[0], 1, field.normal[1]], uv);
    sink.quadFacing(metal, a, d, h, e, direction.map(v => -v) as V3, uv);
    sink.quadFacing(metal, b, c, g, f, direction, uv);
    // The narrow strip has its own geometry, following the formed outer skin.
    sink.quadFacing(light, station(i, -0.68, 1.02), station(i, -0.52, 1.02),
      station(i + 1, -0.52, 1.02), station(i + 1, -0.68, 1.02), [field.normal[0], 1, field.normal[1]], uv);
    if (i === 0) sink.quadFacing(metal, a, b, f, e, [0, -1, 0], uv);
    if (i === segments - 1) sink.quadFacing(metal, d, c, g, h, [-field.normal[0], 0, -field.normal[1]], uv);
  }
}
