import { FacadeField, meshPanelField } from '../api.ts';
import type { DecorationContext, FloorLayout } from '../api.ts';
import { reservations, verticalRuns } from './reservations.ts';

/** Panel fields retain all stacked aperture reservations on the same facade. */
export function podium(context: DecorationContext, floor: FloorLayout, edge: number): void {
  const field = new FacadeField(floor.outline, edge);
  const reserved = reservations(context.layout, floor, edge);
  const breaks = [...new Set([0, field.length,
    ...reserved.flatMap(r => [Math.max(0, Math.min(field.length, r.u0)), Math.max(0, Math.min(field.length, r.u1))])])].sort((a, b) => a - b);
  const pieces: Parameters<typeof meshPanelField>[1]['pieces'] = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const u0 = breaks[i]!, u1 = breaks[i + 1]!;
    for (const [y0, y1] of verticalRuns(u0, u1, floor.elevation, floor.elevation + floor.height, reserved)) {
      pieces.push({ bl: [u0, y0], br: [u1, y0], tr: [u1, y1], tl: [u0, y1] });
    }
  }
  meshPanelField(context.builder.part(`mirror-shutters:0:${edge}:podium-panels`), {
    outline: floor.outline, edge, elevation: floor.elevation, height: floor.height,
    width: 2.5, panelHeight: 2, jointWidth: 0.025, pieces, material: context.material('ground'),
  });
}
