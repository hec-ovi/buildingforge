import { FacadeField, type DecorationContext, type FloorLayout } from '../api.ts';
import { overlaps, panel, reservations, type Box } from './geometry.ts';
import { condenser, riser } from './services.ts';
import { serviceCable } from './cable.ts';

function facade(context: DecorationContext, floor: FloorLayout, edge: number, cable: { placed: boolean }): void {
  const { builder, material } = context, field = new FacadeField(floor.outline, edge), base = floor.elevation, top = base + floor.height;
  const sections = floor.assembly!.sections.filter(s => s.edge === edge), skin = -(sections[0]?.border.surfaceDepth ?? 0.12);
  const front = skin < -0.3 ? -0.2 : 0.16, prefix = `serviced:${floor.index}:${edge}`, holes = reservations(context.layout, floor, edge);
  const draw = (name: string, role: string, box: Box, face = skin, back = skin - 0.16) =>
    panel(builder.part(`${prefix}:${name}`), field, material(role), box, face, back, holes);
  draw('skin', floor.index ? 'wall' : 'ground', { u0: 0, u1: field.length, y0: base, y1: top });
  draw('spandrel:head', 'wall', { u0: 0, u1: field.length, y0: top - 0.42, y1: top }, front, skin);
  draw('spandrel:sill', 'wall', { u0: 0, u1: field.length, y0: base + 0.99, y1: base + 1.12 }, front, skin);
  draw('floor-seam', 'wall-trim', { u0: 0, u1: field.length, y0: base, y1: base + 0.11 }, front - 0.03, skin);
  for (const section of sections) if (section.id.endsWith(':pier')) draw(`pier:${section.id}`, 'column',
    { u0: section.offset, u1: section.offset + section.width, y0: base, y1: top }, front - 0.055, skin);
  if (floor.index > 0) services(context, floor, field, edge, skin, front, holes, cable);
}

function services(context: DecorationContext, floor: FloorLayout, field: FacadeField, edge: number, skin: number, front: number, holes: Box[], cable: { placed: boolean }): void {
  const { builder, material } = context, sections = floor.assembly!.sections.filter(s => s.edge === edge);
  const installed: number[] = [];
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]!;
    if (!section.id.endsWith(':bay') || index % 4 !== 1) continue;
    if (context.layout.detail?.has('coverings') && (floor.index % 3 !== 1 || index % 8 !== 1)) continue;
    const pier = sections[index - 1]!, u = section.offset + section.width * 0.54, pipe = pier.offset + pier.width * 0.5;
    const name = `serviced:${floor.index}:${edge}`, fixture = { builder, field, material, skin, reduced: context.layout.detail?.has('fittings') };
    const attached = riser({ ...fixture, skin: front - 0.055, name: `${name}:riser:${section.id}` }, pipe,
      floor.elevation, floor.elevation + floor.height, holes, interrupted(context, floor.index - 1, edge, pipe), interrupted(context, floor.index + 1, edge, pipe));
    if (attached && condenser({ ...fixture, name: `${name}:condenser:${section.id}` }, u, floor.elevation, pipe, front + 0.065, holes)) installed.push(u);
  }
  if (!cable.placed) cable.placed = serviceCable({ builder, field, material, skin, name: `serviced:${floor.index}:${edge}:service-cable` }, installed, floor.elevation, holes);
}

function interrupted(context: DecorationContext, index: number, edge: number, u: number): boolean {
  const floor = context.layout.floors.find(f => f.index === index);
  return !floor || index < 1 || (context.layout.detail?.has('coverings') === true && index % 3 !== 1) || reservations(context.layout, floor, edge).some(h =>
    overlaps({ u0: u - 0.12, u1: u + 0.12, y0: floor.elevation, y1: floor.elevation + floor.height }, h));
}

/** Fully fitted exterior skin; deep continuous spandrels wrap the four-facet corner. */
export function decorate(context: DecorationContext): void {
  const previous = context.builder.floor, cable = { placed: false };
  try {
    for (const floor of context.layout.floors) {
      if (!floor.assembly || floor.index < 0) continue;
      context.builder.floor = floor.index;
      for (let edge = 0; edge < floor.outline.length; edge++) facade(context, floor, edge, cable);
    }
  } finally { context.builder.floor = previous; }
}
