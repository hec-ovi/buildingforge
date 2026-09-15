import { FacadeField, type DecorationContext, type FamilySection, type FloorLayout, type PartSink } from '../api.ts';
import { GALLERY_DEPTH } from './dimensions.ts';
import { finishes } from './materials.ts';

/** The loggia deck and balustrade occupy the void outside its recessed shell. */
export function gallery(context: DecorationContext, floor: FloorLayout, section: FamilySection, isTop: boolean): void {
  const field = new FacadeField(floor.outline, section.edge);
  const sink = context.builder.part(`balcony-grid:${floor.index}:${section.id}`);
  const deep = floor.outline.length > 4;
  const front = deep ? GALLERY_DEPTH - 0.03 : -0.025;
  const back = deep ? -0.02 : -0.12;
  const u0 = section.offset + 0.08, u1 = section.offset + section.width - 0.08;
  const y = floor.elevation;
  const solid = (material: string, left: number, right: number, bottom: number, top: number, near = front, far = back) =>
    field.solid(sink, material, left, right, bottom, top, near, far, [0, 1], { start: true, end: true }, true);
  solid(finishes.slab, u0, u1, y - 0.3, y);
  solid(finishes.frame, u0, u1, y, y + 0.045, front, front - 0.09);
  rail(sink, field, u0, u1, y, front);
  if (!deep) return;
  for (const u of [u0 + 0.025, u1 - 0.025]) {
    solid(finishes.frame, u - 0.025, u + 0.025, y + 1.045, y + 1.105, front, 0.05);
    solid(finishes.frame, u - 0.025, u + 0.025, y + 0.17, y + 0.21, front, 0.05);
    solid(finishes.glass, u - 0.01, u + 0.01, y + 0.22, y + 1.035, front - 0.07, 0.09);
  }
  const ceiling = y + floor.height - 0.3;
  if (isTop) solid(finishes.slab, u0, u1, ceiling, y + floor.height);
  fixtures(floor, section, sink, field, u0, u1, ceiling);
}

function rail(sink: PartSink, field: FacadeField, u0: number, u1: number, y: number, front: number): void {
  const solid = (material: string, a: number, b: number, bottom: number, top: number, thickness: number) =>
    field.solid(sink, material, a, b, bottom, top, front, front - thickness, [0, 1], { start: true, end: true }, true);
  solid(finishes.frame, u0, u1, y + 1.045, y + 1.105, 0.07);
  solid(finishes.frame, u0, u1, y + 0.17, y + 0.21, 0.05);
  const panels = Math.max(1, Math.round((u1 - u0) / 1.25));
  const pitch = (u1 - u0 - 0.06) / panels;
  for (let i = 0; i <= panels; i++) {
    const at = u0 + i * pitch;
    solid(finishes.frame, at, at + 0.06, y + 0.045, y + 1.105, 0.07);
    if (i < panels) solid(finishes.glass, at + 0.06, at + pitch, y + 0.22, y + 1.035, 0.025);
  }
}

function fixtures(floor: FloorLayout, section: FamilySection, sink: PartSink,
  field: FacadeField, u0: number, u1: number, ceiling: number): void {
  const opening = floor.openings.find(o => o.sectionId === section.id && o.kind === 'window');
  const state = opening?.scenery?.state ?? (opening?.material?.includes('window-black') ? 'dark' : 'lit');
  const intensity = state === 'dark' ? 0 : state === 'dim' ? 0.15 : 1;
  const material = intensity ? finishes.light : finishes.lightOff;
  for (let i = 0; i < 4; i++) {
    const u = u0 + (u1 - u0) * (i + 0.5) / 4;
    field.solid(sink, finishes.frame, u - 0.08, u + 0.08, ceiling - 0.065, ceiling, 1.75, 0.25);
    field.solid(sink, material, u - 0.035, u + 0.035, ceiling - 0.076, ceiling - 0.065, 1.70, 0.30);
    if (opening?.scenery && intensity) {
      opening.scenery.lights ??= [];
      opening.scenery.lights.push({ position: field.point(u, ceiling - 0.12, 1), color: '#99fff0', lumens: 1200 * intensity, range: 12 });
    }
  }
}
