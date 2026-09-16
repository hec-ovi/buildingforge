import { tubeSegment, type FloorLayout, type FamilySection, type PartSink } from '../api.ts';
import type { Surface } from './surface.ts';
import { SHIELD_PANEL_WIDTH, SHIELD_PANEL_HEIGHT } from './dimensions.ts';

export function mechanics(surface: Surface, sink: PartSink, metal: string, panel: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, width = section.width, y = floor.elevation, top = y + floor.height;
  const front = 0.34;
  for (let i = 0; i < 3; i++) {
    const at = u + 0.24 + i * width * 0.19;
    if (surface.clear([at - 0.05, at + 0.05, y + 0.2, top - 0.2])) tubeSegment(sink, metal, surface.point(at, y + 0.2, front), surface.point(at, top - 0.2, front), 0.04);
  }
  surface.solid(sink, metal, u + width * 0.32, u + width * 0.81, y + 0.5, y + 1.75, 0.5, 0.08);
  for (let v = y + 0.65; v < y + 1.6; v += 0.16) surface.solid(sink, panel, u + width * 0.4, u + width * 0.73, v, v + 0.06, 0.53, 0.49);
  surface.panels(sink, panel, u, u + width * 0.38, y, top, SHIELD_PANEL_WIDTH, SHIELD_PANEL_HEIGHT, 0, 0.75);
}
