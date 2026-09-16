import { Rng, type DecorationContext, type FloorLayout } from '../api.ts';
import { SHIELD_PANEL_WIDTH, SHIELD_PANEL_HEIGHT } from './dimensions.ts';
import { Surface, type Rect } from './surface.ts';

const COMPOSITIONS = [
  { widths: [0.38, 0.70, 0.84, 0.70], service: [0.65, 0.20, 0.85, 0.40] },
  { widths: [0.65, 0.42, 0.78, 0.88], service: [0.35, 0.80, 0.25, 0.65] },
  { widths: [0.42, 0.78, 0.78, 0.58], service: [0.80, 0.45, 0.75, 0.15] },
] as const;

/** One connected stepped cover across a four-storey window grid. */
export function coverGrid(context: DecorationContext, floor: FloorLayout, edge: number): void {
  const sections = floor.assembly!.sections.filter(s => s.edge === edge);
  const windows = sections.filter(s => s.id.includes(':upper-window:'));
  const services = sections.find(s => s.id.includes(':mechanical:'));
  if (!windows.length || !services) return;
  const group = context.layout.assembly!.groups.find(g => g.id === floor.assembly!.group)!;
  const row = floor.index - group.fromFloor;
  const rng = new Rng(context.layout.request.seed, `corporate-cover:${edge}:${group.id}`);
  const composition = COMPOSITIONS[rng.int(0, COMPOSITIONS.length - 1)]!;
  const count = Math.max(5, Math.min(windows.length - 2, Math.round(windows.length * composition.widths[row]!)));
  const first = windows[0]!, last = windows[count - 1]!;
  const u0 = services.offset + services.width * (1 - composition.service[row]!);
  const u1 = last.offset + last.width;
  const cuts: Rect[] = [];
  // A deliberate slit in the broad upper sheet exposes part of its underlying grid.
  if (row === 2 && count >= 6) {
    const start = Math.max(1, Math.floor(count * 0.4));
    const a = windows[start]!, b = windows[Math.min(start + 2, count - 2)]!;
    const field = a.windows!.at(-1)!;
    cuts.push([a.offset + field.offset - 0.06, b.offset + field.offset + field.width + 0.06,
      floor.elevation + field.sill - 0.06, floor.elevation + field.sill + field.height + 0.06]);
  }
  const surface = new Surface(context, floor, edge, { coverWindows: true, cuts });
  const sink = context.builder.part(`corporate:${floor.index}:${edge}:cover`, { keepNode: true });
  const material = context.material('shield'), top = floor.elevation + floor.height;
  surface.solid(sink, material, u0, u1, floor.elevation, top, 1.04, 0.04);
  surface.panels(sink, material, u0, u1, floor.elevation, top, SHIELD_PANEL_WIDTH, SHIELD_PANEL_HEIGHT, 0, 1.16, first.offset);
}
