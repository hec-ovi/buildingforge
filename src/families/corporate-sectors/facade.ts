import type { DecorationContext, FamilySection } from '../api.ts';
import { Surface } from './surface.ts';
import { RIM_DEPTH, CHANNEL_RECESS } from './dimensions.ts';
import { cassette } from './cassette.ts';
import { mechanics } from './mechanics.ts';
import { channelLimit } from './channel.ts';
import { specialFace } from './faces.ts';
import { coverGrid } from './coverage.ts';

export function decorateFloors(context: DecorationContext): void {
  const { builder, layout, material } = context;
  const panel = material('wall'), metal = material('window-frame'), trim = material('wall-trim');
  for (const floor of layout.floors.filter(f => f.index > 0 && f.assembly)) {
    builder.floor = floor.index;
    const group = layout.assembly!.groups.find(g => g.id === floor.assembly!.group)!;
    const groupFloors = layout.floors.filter(f => f.index >= group.fromFloor && f.index <= group.toFloor);
    const base = groupFloors[0]!.elevation;
    for (let edge = 0; edge < 4; edge++) {
      const surface = new Surface(context, floor, edge);
      const sink = builder.part(`corporate:${floor.index}:${edge}:cladding`);
      const y = floor.elevation, top = y + floor.height;
      if (group.id === 0) {
        surface.solid(sink, panel, surface.start, surface.end, y, top, 0.02, -0.1);
        surface.panels(sink, panel, surface.start, surface.end, y, top, 1, 1.5, 0, 0.15);
        if (floor.index === group.toFloor) {
          const rim = builder.part(`corporate:podium-rim:${edge}`, { keepNode: true });
          surface.solid(rim, trim, surface.start, surface.end, top - 0.35, top, RIM_DEPTH, -CHANNEL_RECESS);
        }
        continue;
      }
      for (const section of floor.assembly!.sections as FamilySection[]) {
        if (section.edge !== edge) continue;
        const u = section.offset, end = u + section.width;
        if (section.id.includes(':recessed-slit:')) {
          surface.solid(sink, panel, u, end, y, top, -CHANNEL_RECESS, -CHANNEL_RECESS - 0.12);
          continue;
        }
        if (section.id.includes(':channel-left:') || section.id.includes(':channel-right:')) {
          channelLimit(surface, sink, trim, section, floor);
          continue;
        }
        surface.solid(sink, panel, u, end, y, top, 0.02, -0.1);
        if (section.id.includes(':large-panel:')) {
          const wing = builder.part(`${section.id}:wing`, { keepNode: true });
          surface.solid(wing, panel, u + 0.015, end - 0.015, y, top, 1.08, 0.03);
          surface.panels(wing, panel, u, end, y, top, 2, 3, base, 1.2, u);
        } else if (section.id.includes(':cassette:')) {
          cassette(surface, builder.part(`${section.id}:box`, { keepNode: true }), metal, section, floor);
        } else if (section.id.includes(':mechanical:')) {
          mechanics(surface, builder.part(`corporate:${floor.index}:${edge}:services`, { keepNode: true }), metal, trim, section, floor);
        } else if (section.id.includes(':upper-window:') || section.id.includes(':upper-border:')) {
          surface.solid(sink, panel, u, end, y, top, 0.06, -0.06);
        } else {
          surface.panels(sink, panel, u, end, y, top, 1, 1.5, 0, 0.06);
        }
      }
      if (specialFace(edge) && group.id >= 2) coverGrid(context, floor, edge);
    }
  }
}
