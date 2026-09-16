import type { FloorLayout, FamilySection, PartSink } from '../api.ts';
import type { Surface } from './surface.ts';

export function cassette(surface: Surface, sink: PartSink, material: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, end = u + section.width, y = floor.elevation, top = y + floor.height;
  const bottom = y + 0.6, head = top - 0.6;
  surface.solid(sink, material, u, end, bottom + 0.12, head - 0.09, 1.43, 0.03);
  surface.solid(sink, material, u + 0.12, end - 0.12, head - 0.09, head, 1.28, 0.03);
  surface.solid(sink, material, u + 0.1, end - 0.1, bottom, bottom + 0.12, 1.2, 0.03);
  for (let i = 1; i < 3; i++) {
    const at = u + section.width * i / 3;
    surface.solid(sink, material, at - 0.018, at + 0.018, bottom + 0.16, top - 1.79, 1.446, 1.43);
  }
  if (surface.clear([u, end, bottom, bottom + 0.12])) {
    const p = (a: number, h: number, depth: number) => surface.point(a, h, depth);
    sink.quadFacing(material, p(u, bottom + 0.12, 1.43), p(end, bottom + 0.12, 1.43), p(end - 0.1, bottom, 1.2), p(u + 0.1, bottom, 1.2), [surface.field.normal[0], -1, surface.field.normal[1]], [[0, 0], [section.width, 0], [section.width, 0.26], [0, 0.26]]);
  }
}
