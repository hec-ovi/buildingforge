import type { FloorLayout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import { FacadeField } from './facadeField.ts';
import type { PartSink } from './primitives.ts';
import { materialSlot, splitMaterialSlot, withDefaultVariant } from '../materials/slot.ts';

/** Baffle pitch across the head band; the comb itself is in the frame map. */
export const BAFFLE_PITCH = 0.16;

/**
 * Head baffles carry housed underside lamps above the clear horizontal glazing.
 * The band and its recessed comb face are fitted panels and the lamps one
 * continuous cove line, so a ribbon costs a handful of vertices at any length.
 */
export function meshRibbonLouvres(sink: PartSink, floor: FloorLayout, opening: Opening, mat: (kind: string) => string): void {
  const field = new FacadeField(floor.outline, opening.edge);
  const u0 = opening.offset + 0.06, u1 = opening.offset + opening.width - 0.06;
  if (u1 - u0 < BAFFLE_PITCH) return;
  const y1 = floor.elevation + opening.sill + opening.height - 0.06;
  field.solid(sink, mat('window-frame'), u0, u1, y1 - 0.04, y1 + 0.04, 0.15, -0.32);
  const [frameKey] = splitMaterialSlot(mat('window-frame'));
  field.plate(sink, materialSlot(frameKey, 'comb', 'catalog'), u0, u1, y1 - 0.10, y1 - 0.025, 0.12, true);
  field.plate(sink, withDefaultVariant(mat('light-fixture'), 'strip'), u0, u1, y1 - 0.108, y1 - 0.101, 0.08, true);
}
