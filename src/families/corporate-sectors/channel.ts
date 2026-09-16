import type { FamilySection, FloorLayout, PartSink } from '../api.ts';
import type { Surface } from './surface.ts';
import { CHANNEL_RECESS } from './dimensions.ts';

export function channelFloorProfile(width: number, left: boolean, inset: number): { offset: number; depth: number }[] {
  const inner = -CHANNEL_RECESS + 0.04, outer = left ? 1.08 : 0.12;
  const from = left ? inner : outer, to = left ? outer : inner;
  const crossing = 0.15 + (width - 0.3) * -from / (to - from);
  return [0, 0.15, crossing, width - 0.15, width].sort((a, b) => a - b).map(offset => {
    const t = Math.max(0, Math.min(1, (offset - 0.15) / (width - 0.3)));
    return { offset, depth: inset + Math.max(0, -(from + (to - from) * t)) };
  });
}

export function channelLimit(surface: Surface, sink: PartSink, material: string, section: FamilySection, floor: FloorLayout): void {
  const u = section.offset, end = u + section.width;
  const y = floor.elevation, top = y + floor.height, left = section.id.includes(':channel-left:');
  const inner = -CHANNEL_RECESS + 0.04, outer = left ? 1.08 : 0.12, back = -CHANNEL_RECESS - 0.12;
  const from = left ? inner : outer, to = left ? outer : inner;
  surface.solid(sink, material, u, u + 0.15, y, top, from, back);
  surface.ramp(sink, material, u + 0.15, end - 0.15, y, top, from, to, back);
  surface.solid(sink, material, end - 0.15, end, y, top, to, back);
}
