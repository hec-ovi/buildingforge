import type { FloorLayout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import { FacadeField } from './facadeField.ts';
import type { PartSink } from './primitives.ts';
import { withDefaultVariant } from '../materials/slot.ts';

/** Head baffles carry housed underside lamps above the clear horizontal glazing. */
export function meshRibbonLouvres(sink: PartSink, floor: FloorLayout, opening: Opening, mat: (kind: string) => string): void {
  const field = new FacadeField(floor.outline, opening.edge);
  const u0 = opening.offset + 0.06, u1 = opening.offset + opening.width - 0.06;
  const y1 = floor.elevation + opening.sill + opening.height - 0.06;
  const count = Math.floor((u1 - u0) / 0.16);
  const margin = ((u1 - u0) - count * 0.16) / 2;
  field.solid(sink, mat('window-frame'), u0, u1, y1 - 0.04, y1 + 0.04, 0.15, -0.32);
  for (let i = 0; i < count; i++) {
    const u = u0 + margin + (i + 0.5) * 0.16;
    field.solid(sink, mat('window-frame'), u - 0.045, u + 0.045, y1 - 0.10, y1 - 0.025, 0.12, -0.32);
    field.solid(sink, withDefaultVariant(mat('light-fixture'), 'strip'), u - 0.028, u + 0.028,
      y1 - 0.108, y1 - 0.101, 0.08, -0.29);
  }
}
