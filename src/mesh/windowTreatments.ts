import type { Opening } from '../types.ts';
import type { P2 } from '../core/polygon.ts';
import type { PartSink, V3 } from './primitives.ts';
import { materialSlot } from '../materials/slot.ts';
import { meshCoveringHousing } from './coveringHousing.ts';

interface Frame { v: P2; dir: P2; n: P2 }
interface Field { u0: number; u1: number; y0: number; y1: number }

export function meshGroundPrivacy(sink: PartSink, frame: Frame, field: Field, glass: number, material: string, frameMaterial: string): void {
  const back = glass - 0.23;
  meshCoveringHousing(sink, frame, field, glass - 0.09, back, frameMaterial);
  // A matte closed backing excludes views into the unoccupied shell through slat gaps.
  const at = (u: number, y: number): V3 => [frame.v[0] + frame.dir[0] * u + frame.n[0] * back, y,
    frame.v[1] + frame.dir[1] * u + frame.n[1] * back];
  sink.quadFacing(material, at(field.u0, field.y0), at(field.u1, field.y0), at(field.u1, field.y1), at(field.u0, field.y1),
    [frame.n[0], 0, frame.n[1]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
}

export function meshExteriorLouvre(sink: PartSink, frame: Frame, field: Field, covering: NonNullable<Opening['exteriorCovering']>): void {
  const material = materialSlot(covering.material, 'blades', 'catalog');
  const height = field.y1 - field.y0;
  const at = (u: number, y: number, depth: number): V3 => [
    frame.v[0] + frame.dir[0] * u + frame.n[0] * depth, y,
    frame.v[1] + frame.dir[1] * u + frame.n[1] * depth,
  ];
  const along = (value: number): V3 => [frame.dir[0] * value, 0, frame.dir[1] * value];
  const outward = (value: number): V3 => [frame.n[0] * value, 0, frame.n[1] * value];
  const center = covering.standoff + covering.depth / 2;
  for (const u of [field.u0 + 0.025, field.u1 - 0.025]) {
    sink.box(material, at(u, (field.y0 + field.y1) / 2, center), along(0.025), [0, height / 2, 0], outward(covering.depth / 2), 'along');
  }
  // The blade field is one panel between the side rails; the 0.13 m pitch is in
  // the louvre map, so a screen costs a quad instead of a box per blade.
  const face = covering.standoff + covering.depth - 0.008;
  const u0 = field.u0 + 0.05, u1 = field.u1 - 0.05;
  if (u1 - u0 < 0.02) return;
  sink.quadFacing(material, at(u0, field.y0, face), at(u1, field.y0, face), at(u1, field.y1, face), at(u0, field.y1, face),
    [frame.n[0], 0, frame.n[1]], [[0, 0], [u1 - u0, 0], [u1 - u0, height], [0, height]]);
}
