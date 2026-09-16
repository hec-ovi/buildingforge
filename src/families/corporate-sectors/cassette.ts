import { ProfiledBlind, type FloorLayout, type FamilySection, type PartSink } from '../api.ts';
import type { Surface } from './surface.ts';
import { cassetteProfile } from './dimensions.ts';
import { fold } from './fold.ts';

export function cassette(surface: Surface, sink: PartSink, material: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, end = u + section.width;
  const profile = cassetteProfile(floor.height);
  const bottom = floor.elevation + profile.bottom, top = floor.elevation + profile.top;
  const { front, back } = profile;
  const apronTop = floor.elevation + profile.slotBottom - 0.06;
  const solidStart = u + section.width * 2 / 3;
  surface.solid(sink, material, u, end, bottom + 0.25, apronTop, front, back);
  fold(surface, sink, material, u, end, bottom, bottom + 0.25, front - 0.3, front, back);
  surface.solid(sink, material, solidStart, end, apronTop, top - 0.14, front, back);
  fold(surface, sink, material, solidStart, end, top - 0.14, top, front, front - 0.1, back);
  const blind = new ProfiledBlind();
  for (const window of section.windows ?? []) {
    const x0 = u + window.offset, x1 = x0 + window.width;
    const y0 = floor.elevation + window.sill, y1 = y0 + window.height;
    // Existing window reservations are expected here; reject a bridge or door replacing this window.
    const opening = floor.openings.find(o => o.kind === 'window' && o.edge === section.edge &&
      Math.abs(o.offset - x0) < 1e-6 && Math.abs(o.sill - window.sill) < 1e-6);
    if (!opening || !surface.clear([x0, x1, y0, y1], true)) continue;
    const panes = window.panes?.cols ?? 1, paneWidth = (x1 - x0) / panes;
    for (let pane = 0; pane < panes; pane++) blind.build(sink, {
      dir: surface.field.dir, normal: surface.field.normal,
      point: (at, y, depth) => surface.point(x0 + pane * paneWidth + 0.025 + at, y, depth),
    }, paneWidth - 0.05, y0, y1, front - 0.4, 100);
  }
}
