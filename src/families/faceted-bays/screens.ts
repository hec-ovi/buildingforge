import type { DecorationContext, FloorLayout, PartSink } from '../api.ts';
import { Surface } from './surface.ts';

/** Each portrait keeps its full picture and occupies a solid service-panel field. */
export function screens(context: DecorationContext, floor: FloorLayout, surface: Surface, sink: PartSink): void {
  if (context.layout.request.options?.adScreens === 'off') return;
  const sections = floor.assembly?.sections.filter(s => s.edge === surface.edge && s.id.startsWith('fb:0:0:') && s.id.endsWith(':panel')) ?? [];
  for (const section of sections) {
    const group = context.layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
    if (!group || group.fromFloor !== floor.index) continue;
    const groupFloors = context.layout.floors.filter(f => f.index >= group.fromFloor && f.index <= group.toFloor);
    const height = groupFloors.reduce((sum, f) => sum + f.height, 0) - 0.9;
    const width = Math.min(2.6, section.width - 0.3), panelHeight = width * 2;
    const count = Math.floor(height / (panelHeight + 0.12));
    for (let panel = 0; panel < count; panel++) {
      const u0 = section.offset + (section.width - width) / 2, u1 = u0 + width;
      const y0 = floor.elevation + 0.45 + panel * (panelHeight + 0.12), y1 = y0 + panelHeight;
      const allClear = groupFloors.every(f => new Surface(context.layout, f, surface.edge).clear(u0 - 0.06, u1 + 0.06, y0 - 0.06, y1 + 0.06));
      if (!allClear) continue;
      const depth = surface.front;
      surface.field.solid(sink, context.material('window-frame'), u0 - 0.06, u1 + 0.06, y0 - 0.06, y1 + 0.06, depth - 0.012, depth - 0.11);
      const n: [number, number, number] = [surface.field.normal[0], 0, surface.field.normal[1]];
      sink.quadFacing(context.material('screen'), surface.field.point(u0, y0, depth), surface.field.point(u1, y0, depth),
        surface.field.point(u1, y1, depth), surface.field.point(u0, y1, depth), n, [[0, 1], [1, 1], [1, 0], [0, 0]]);
    }
  }
}
