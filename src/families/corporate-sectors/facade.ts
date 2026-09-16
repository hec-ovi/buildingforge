import { tubeSegment, type DecorationContext, type FloorLayout, type FamilySection, type PartSink } from '../api.ts';
import { Surface } from './surface.ts';

function cassette(surface: Surface, sink: PartSink, material: string, section: FamilySection, floor: FloorLayout): void {
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
    const p = (a: number, h: number, depth: number) => surface.field.point(a, h, surface.depth(depth));
    sink.quadFacing(material, p(u, bottom + 0.12, 1.43), p(end, bottom + 0.12, 1.43), p(end - 0.1, bottom, 1.2), p(u + 0.1, bottom, 1.2), [surface.field.normal[0], -1, surface.field.normal[1]], [[0, 0], [section.width, 0], [section.width, 0.26], [0, 0.26]]);
  }
}

function mechanics(surface: Surface, sink: PartSink, metal: string, panel: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, width = section.width, y = floor.elevation, top = y + floor.height;
  const front = surface.depth(0.34);
  for (let i = 0; i < 3; i++) {
    const at = u + 0.24 + i * width * 0.19;
    if (surface.clear([at - 0.05, at + 0.05, y + 0.2, top - 0.2])) tubeSegment(sink, metal, surface.field.point(at, y + 0.2, front), surface.field.point(at, top - 0.2, front), 0.04);
  }
  surface.solid(sink, metal, u + width * 0.32, u + width * 0.81, y + 0.5, y + 1.75, 0.5, 0.08);
  for (let v = y + 0.65; v < y + 1.6; v += 0.16) surface.solid(sink, panel, u + width * 0.4, u + width * 0.73, v, v + 0.06, 0.53, 0.49);
  surface.panels(sink, panel, u + width * 0.62, u + width - 0.02, y + 0.12, top - 0.15, width, 1.5, y, 0.75);
}

export function decorateFloors(context: DecorationContext): void {
  const { builder, layout, material } = context;
  const panel = material('wall'), metal = material('window-frame'), trim = material('wall-trim');
  for (const floor of layout.floors.filter(f => f.index > 0 && f.assembly)) {
    builder.floor = floor.index;
    const group = layout.assembly!.groups.find(g => g.id === floor.assembly!.group)!;
    const groupFloors = layout.floors.filter(f => f.index >= group.fromFloor && f.index <= group.toFloor);
    const base = groupFloors[0]!.elevation;
    const groupHeight = groupFloors.reduce((sum, f) => sum + f.height, 0);
    const rows = Math.max(1, Math.round(groupFloors.length * 0.75));
    for (let edge = 0; edge < 4; edge++) {
      const surface = new Surface(context, floor, edge);
      const sink = builder.part(`corporate:${floor.index}:${edge}:cladding`);
      const y = floor.elevation, top = y + floor.height;
      for (const section of floor.assembly!.sections as FamilySection[]) {
        if (section.edge !== edge) continue;
        const u = section.offset, end = u + section.width;
        if (section.id.includes(':large-panel:')) {
          const wing = builder.part(`${section.id}:wing`, { keepNode: true });
          surface.solid(wing, panel, u + 0.015, end - 0.015, y, top, 1.08, 0.03);
          surface.panels(wing, panel, u, end, y, top, section.width / 2, groupHeight / rows, base, 1.2);
        } else if (section.id.includes(':cassette:')) {
          cassette(surface, builder.part(`${section.id}:box`, { keepNode: true }), metal, section, floor);
        } else if (section.id.includes(':mechanical:')) {
          mechanics(surface, sink, metal, panel, section, floor);
        } else if (section.id.includes(':mask-panel:')) {
          const mask = builder.part(`${section.id}:mask`, { keepNode: true });
          surface.solid(mask, panel, u + 0.014, end - 0.014, y, top, 1.04, 0.04);
          surface.panels(mask, panel, u, end, y, top, 1.8, 0.9, base, 1.16);
        } else {
          const front = group.id === 0 ? 0.15 : 0.06;
          surface.panels(sink, panel, u, end, y + 0.015, top - 0.015, group.id === 0 ? 1.5 : section.width, group.id === 0 ? 1.5 : floor.height, base, front);
          if (section.id.includes(':recessed-slit:')) {
            for (const at of [u + 0.02, end - 0.2]) for (let i = 0; i < 3; i++) surface.solid(sink, trim, at + i * 0.045, at + 0.025 + i * 0.045, y, top, 0.82 - i * 0.075, 0.04);
          } else if (section.id.includes(':side-pier:')) {
            surface.solid(sink, trim, u + 0.04, end - 0.04, y, top, 1.22, 0.03);
          }
        }
      }
      if (floor.index === group.fromFloor || floor.index === 1) surface.solid(sink, trim, 0.03, surface.field.length - 0.03, y + 0.01, y + 0.29, 1.45, 0.02);
      if (floor.index === group.toFloor) surface.solid(sink, trim, 0.03, surface.field.length - 0.03, top - 0.31, top - 0.01, 1.45, 0.02);
    }
  }
}
