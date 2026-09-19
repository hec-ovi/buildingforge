import type { DecorationContext, FloorLayout } from '../api.ts';
import type { Surface } from './surface.ts';

/** Recessed portrait displays flank the entrance inside its opaque podium. */
export function podiumDisplays(context: DecorationContext, floor: FloorLayout, edge: number, surface: Surface): void {
  if (context.layout.request.options?.adScreens === 'off') return;
  const door = floor.openings.find(o => o.edge === edge && o.kind === 'door' && o.doorRole === 'main');
  if (!door) return;
  const y0 = floor.elevation + 0.75, y1 = Math.min(floor.elevation + floor.height - 0.75, y0 + 2);
  const width = (y1 - y0) / 2, rim = 0.08;
  for (const u of [door.offset - 2, door.offset + door.width + 2]) {
    const left = u - width / 2, right = u + width / 2;
    const area: [number, number, number, number] = [left - rim, right + rim, y0 - rim, y1 + rim];
    if (area[0] < surface.start + 0.5 || area[1] > surface.end - 0.5 || !surface.clear(area)) continue;
    const sink = context.builder.part(`corporate:podium-display:${edge}:${u}`);
    const metal = context.material('window-frame');
    surface.solid(sink, metal, left - rim, left, y0 - rim, y1 + rim, 0.23, 0.13);
    surface.solid(sink, metal, right, right + rim, y0 - rim, y1 + rim, 0.23, 0.13);
    surface.solid(sink, metal, left, right, y0 - rim, y0, 0.23, 0.13);
    surface.solid(sink, metal, left, right, y1, y1 + rim, 0.23, 0.13);
    const point = (x: number, y: number) => surface.point(x, y, 0.145);
    sink.quadFacing(context.material('screen'), point(left, y0), point(right, y0), point(right, y1), point(left, y1),
      [surface.field.normal[0], 0, surface.field.normal[1]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  }
}
