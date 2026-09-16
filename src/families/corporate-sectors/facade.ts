import type { DecorationContext, FamilySection } from '../api.ts';
import { Surface } from './surface.ts';
import { RIM_DEPTH } from './dimensions.ts';
import { cassette } from './cassette.ts';
import { mechanics } from './mechanics.ts';

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
      const pale = group.id > 0 && (edge === 1 || (edge === 0 && group.id >= 2));
      const skin = pale ? material('shield') : panel;
      surface.solid(sink, skin, surface.start, surface.end, y, top, 0.02, -0.1);
      if (group.id === 0) {
        surface.panels(sink, panel, surface.start, surface.end, y, top, 1, 1.5, 0, 0.15);
        if (floor.index === group.toFloor) {
          const rim = builder.part(`corporate:podium-rim:${edge}`, { keepNode: true });
          surface.solid(rim, trim, surface.start, surface.end, top - 0.35, top, RIM_DEPTH, 0.02);
        }
        continue;
      }
      for (const section of floor.assembly!.sections as FamilySection[]) {
        if (section.edge !== edge) continue;
        const u = section.offset, end = u + section.width;
        if (section.id.includes(':large-panel:')) {
          const wing = builder.part(`${section.id}:wing`, { keepNode: true });
          surface.solid(wing, panel, u + 0.015, end - 0.015, y, top, 1.08, 0.03);
          surface.panels(wing, panel, u, end, y, top, 2, 3, base, 1.2, u);
        } else if (section.id.includes(':cassette:')) {
          cassette(surface, builder.part(`${section.id}:box`, { keepNode: true }), metal, section, floor);
        } else if (section.id.includes(':mechanical:')) {
          mechanics(surface, sink, metal, skin, section, floor);
        } else if (section.id.includes(':mask-panel:')) {
          const mask = builder.part(`${section.id}:mask`, { keepNode: true });
          surface.solid(mask, skin, u, end, y, top, 1.04, 0.04);
          surface.panels(mask, skin, u, end, y, top, 1, 0.75, 0, 1.16);
        } else {
          surface.panels(sink, skin, u, end, y, top, 1, pale ? 0.75 : 1.5, 0, 0.06);
          if (section.id.includes(':channel-left:') || section.id.includes(':channel-right:')) {
            const left = section.id.includes(':channel-left:');
            for (let i = 0; i < 3; i++) {
              const at = left ? u + i * 0.14 : end - (i + 1) * 0.14;
              surface.solid(sink, trim, at, at + 0.1, y, top, 0.22 + i * 0.22, 0.03);
            }
          }
        }
      }
    }
  }
}
