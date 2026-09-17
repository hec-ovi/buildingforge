import type { DecorationContext, FloorLayout, PartSink } from '../api.ts';
import { DIMENSIONS as D } from './dimensions.ts';
import { Surface } from './surface.ts';
import { screens } from './screens.ts';

export class FacetedBayDecoration {
  decorate(context: DecorationContext): void {
    const previous = context.builder.floor;
    try {
      for (const floor of context.layout.floors) {
        if (floor.index < 0 || !floor.assembly) continue;
        context.builder.floor = floor.index;
        const sink = context.builder.part(`faceted-bays:${floor.index}/skin`);
        const screen = context.builder.part(`faceted-bays:${floor.index}/screens`);
        for (let edge = 0; edge < floor.outline.length; edge++) {
          const surface = new Surface(context.layout, floor, edge);
          this.panels(context, floor, surface, sink);
          this.bands(context, floor, surface, sink);
          if (floor.index === 0) this.podium(context, floor, surface, sink);
          else screens(context, floor, surface, screen);
        }
      }
    } finally { context.builder.floor = previous; }
  }

  private panels(context: DecorationContext, floor: FloorLayout, surface: Surface, sink: PartSink): void {
    const { field } = surface;
    const floorBottom = floor.elevation, floorTop = floorBottom + floor.height;
    const columns = Math.max(1, Math.ceil(field.length / 1.5));
    const rows = Math.max(1, Math.ceil(floor.height / 1.5));
    const w = 1.5, h = 1.5;
    const skin = context.material(floor.index === 0 ? 'ground' : 'wall');
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const u0 = col * w + 0.016, u1 = Math.min(field.length, (col + 1) * w) - 0.016;
      const y0 = floorBottom + row * h + 0.016, y1 = Math.min(floorTop, floorBottom + (row + 1) * h) - 0.016;
      // The 22 mm fixing heads at each panel corner live in the panel map.
      surface.solid(sink, skin, u0, u1, y0, y1, surface.front - 0.05, 0.04, true);
    }
  }

  private bands(context: DecorationContext, floor: FloorLayout, surface: Surface, sink: PartSink): void {
    const group = context.layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
    const atCap = group?.toFloor === floor.index;
    const top = floor.elevation + floor.height;
    const height = floor.index === 0 ? 0.38 : atCap ? D.separator : 0.055;
    surface.solid(sink, context.material(atCap || floor.index === 0 ? 'wall-trim' : 'window-frame'),
      0, surface.field.length, top - height, top, surface.front, atCap ? 0.22 : 0.06, true);
    for (const section of floor.assembly!.sections.filter(s => s.edge === surface.edge && s.id.endsWith(':slit'))) {
      const left = section.offset, right = left + section.width;
      for (const u of [left + 0.075, right - 0.12]) surface.solid(sink, context.material('column'), u, u + 0.045,
        floor.elevation + 0.1, top - 0.1, surface.front, 0.15, true);
    }
  }

  private podium(context: DecorationContext, floor: FloorLayout, surface: Surface, sink: PartSink): void {
    const length = surface.field.length;
    const y = floor.elevation + floor.height - 0.7;
    for (const [u0, u1] of [[0.15, Math.min(2.4, length / 4)], [length - Math.min(2.4, length / 4), length - 0.15]]) {
      surface.solid(sink, context.material('wall-trim'), u0!, u1!, y - 0.16, y, surface.front, 0.32);
      surface.solid(sink, context.material('window-frame'), u0!, u1!, y + 0.27, y + 0.31, surface.front, 0.06);
      for (const u of [u0! + 0.05, u1! - 0.08]) surface.solid(sink, context.material('window-frame'), u, u + 0.03, y, y + 0.3, surface.front, 0.06);
    }
  }
}
