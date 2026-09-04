import type { FrameBasis, FrameRect } from './frameRing.ts';
import type { PartSink } from './primitives.ts';

/** Closed opaque infill sharing the surrounding frame's front and back planes. */
export function meshSpandrel(
  sink: PartSink, basis: FrameBasis, rect: FrameRect,
  front: number, back: number, material: string,
): void {
  const u = (rect.u0 + rect.u1) / 2;
  const depth = front - back;
  const centerDepth = (front + back) / 2;
  sink.box(material, [
    basis.v[0] + basis.dir[0] * u + basis.n[0] * centerDepth,
    (rect.y0 + rect.y1) / 2,
    basis.v[1] + basis.dir[1] * u + basis.n[1] * centerDepth,
  ], [basis.dir[0] * (rect.u1 - rect.u0) / 2, 0, basis.dir[1] * (rect.u1 - rect.u0) / 2],
  [0, (rect.y1 - rect.y0) / 2, 0], [basis.n[0] * depth / 2, 0, basis.n[1] * depth / 2]);
}
