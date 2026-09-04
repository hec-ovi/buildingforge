import { meshFrameRing, type FrameBasis, type FrameRect } from './frameRing.ts';
import type { PartSink } from './primitives.ts';

/** Closed returns outside the clear field enclose the covering's recessed edges. */
export function meshCoveringHousing(
  sink: PartSink, basis: FrameBasis, field: FrameRect, front: number, back: number, material: string,
): void {
  const thickness = 0.008;
  meshFrameRing(sink, basis, {
    u0: field.u0 - thickness, u1: field.u1 + thickness,
    y0: field.y0 - thickness, y1: field.y1 + thickness,
  }, field, front, front - back, material);
}
