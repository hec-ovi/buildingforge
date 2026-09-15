import { tubeSegment, type DecorationContext, type FloorLayout, type FamilySection, type PartSink } from '../api.ts';
import { Surface } from './surface.ts';

function cassette(surface: Surface, sink: PartSink, material: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, end = u + section.width, y = floor.elevation, top = y + floor.height;
  const front = 1.15;
  surface.solid(sink, material, u, end, y + 0.38, top - 1.57, front, 0.05);
  surface.solid(sink, material, u, end, top - 0.39, top - 0.15, front, 0.05);
  surface.solid(sink, material, u, u + 0.11, top - 1.57, top - 0.39, front, 0.05);
  surface.solid(sink, material, end - 0.11, end, top - 1.57, top - 0.39, front, 0.05);
  surface.solid(sink, material, u + 0.1, end - 0.1, y + 0.25, y + 0.38, 0.92, 0.08);
}

function mechanics(surface: Surface, sink: PartSink, metal: string, panel: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, width = section.width, y = floor.elevation, top = y + floor.height;
  const front = Math.min(0.34, surface.margin - 0.04);
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
          surface.panels(sink, panel, u, end, y, top, section.width / 2, groupHeight / rows, base, 0.94);
        } else if (section.id.includes(':cassette-')) {
          cassette(surface, sink, metal, section, floor);
          if (section.id.includes(':cassette-solid:')) surface.panels(sink, panel, u, end, y + 0.38, top - 0.15, section.width, floor.height, y, 1.16);
        } else if (section.id.includes(':mechanical:')) {
          mechanics(surface, sink, metal, panel, section, floor);
        } else if (section.id.includes(':mask-panel:')) {
          surface.panels(sink, panel, u, end, y + 0.02, top - 0.02, 1.5, 1.5, base, 0.95);
        } else {
          surface.panels(sink, panel, u, end, y + 0.015, top - 0.015, group.id === 0 ? 1.5 : section.width, group.id === 0 ? 1.5 : floor.height, base, 0.15);
          if (section.id.includes(':recessed-slit:')) {
            for (const at of [u + 0.02, end - 0.2]) for (let i = 0; i < 3; i++) surface.solid(sink, trim, at + i * 0.045, at + 0.025 + i * 0.045, y + 0.02, top - 0.02, 0.76, 0.1);
          }
        }
      }
      if (floor.index === group.fromFloor || floor.index === 1) surface.solid(sink, trim, 0.03, surface.field.length - 0.03, y + 0.01, y + 0.29, 1.27, 0.02);
      if (floor.index === group.toFloor) surface.solid(sink, trim, 0.03, surface.field.length - 0.03, top - 0.31, top - 0.01, 1.27, 0.02);
    }
  }
}
