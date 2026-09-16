import { tubeSegment, type FloorLayout, type FamilySection, type PartSink } from '../api.ts';
import type { Surface } from './surface.ts';

type RoutePoint = [number, number, number];

export function mechanics(surface: Surface, sink: PartSink, metal: string, trim: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, w = section.width, y = floor.elevation, top = y + floor.height;
  const route = (points: RoutePoint[], radius: number, material = metal) => {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!, b = points[i + 1]!;
      if (!surface.clear([Math.min(a[0], b[0]) - radius, Math.max(a[0], b[0]) + radius, Math.min(a[1], b[1]) - radius, Math.max(a[1], b[1]) + radius])) continue;
      tubeSegment(sink, material, surface.point(...a), surface.point(...b), radius);
    }
  };
  // Continuous supply pipes and a ladder cable tray share their floor boundary coordinates.
  for (const [fraction, radius, depth] of [[0.12, 0.055, 0.25], [0.25, 0.075, 0.35], [0.83, 0.05, 0.28], [0.93, 0.025, 0.24]] as const) {
    const at = u + w * fraction;
    route([[at, y, depth], [at, top, depth]], radius);
  }
  const tray0 = u + w * 0.36, tray1 = u + w * 0.55;
  for (const at of [tray0, tray1]) surface.solid(sink, trim, at - 0.025, at + 0.025, y, top, 0.28, 0.12);
  for (let v = Math.ceil(y / 0.3) * 0.3; v < top - 0.03; v += 0.3) surface.solid(sink, metal, tray0, tray1, v, v + 0.025, 0.23, 0.19);
  for (let cable = 0; cable < 4; cable++) {
    const at = tray0 + 0.07 + cable * 0.11;
    route([[at, y, 0.30], [at, top, 0.30]], 0.016, trim);
  }
  for (const v of [y + 0.4, top - 0.4]) {
    surface.solid(sink, trim, u + 0.12, u + w - 0.12, v, v + 0.07, 0.16, 0.05);
    for (const fraction of [0.12, 0.25, 0.83]) surface.solid(sink, metal, u + w * fraction - 0.1, u + w * fraction + 0.1, v - 0.035, v + 0.105, 0.45, 0.34);
  }
  const box0 = u + w * 0.57, box1 = u + w * 0.79;
  const low = y + 0.7, high = Math.min(top - 0.6, low + (floor.index % 2 ? 1.7 : 1.2));
  surface.solid(sink, trim, box0 - 0.07, box1 + 0.07, low - 0.09, high + 0.09, 0.30, 0.09);
  surface.solid(sink, metal, box0, box1, low, high, 0.64, 0.29);
  for (let v = low + 0.16; v < high - 0.1; v += 0.14) surface.solid(sink, trim, box0 + 0.05, box1 - 0.05, v, v + 0.035, 0.68, 0.64);
  const branch = y + floor.height * 0.52;
  route([[u + w * 0.25, branch - 0.3, 0.35], [u + w * 0.25, branch, 0.47], [box0 - 0.14, branch, 0.47], [box0, branch + 0.14, 0.47]], 0.045);
  route([[box1, high - 0.2, 0.42], [u + w * 0.86, high - 0.2, 0.42], [u + w * 0.86, top - 0.3, 0.30], [u + w * 0.93, top - 0.3, 0.24]], 0.025, trim);
}
