import type { FloorLayout, FamilySection, PartSink } from '../api.ts';
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
}
