import { FacadeField, type DecorationContext, type Point } from '../api.ts';
import { intersect, panel, projection, rectangle, reservations } from './geometry.ts';

/** Massive closed wall stacks, angular support folds and deeply projecting section belts. */
export function decorate({ builder, layout, material }: DecorationContext): void {
  const previous = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (!floor.assembly || floor.index < 0) continue;
      builder.floor = floor.index;
      const front = projection(floor.outline, layout.request.parcel.footprint) - 0.02;
      const skin = Math.max(-0.12, front - 0.62), base = floor.elevation, top = base + floor.height;
      const group = layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
      const first = layout.floors.find(f => f.index === group?.fromFloor) ?? floor;
      const last = layout.floors.find(f => f.index === group?.toFloor) ?? floor;
      const y0 = first.elevation, y1 = last.elevation + last.height;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge), holes = reservations(layout, floor, edge);
        const prefix = `industrial-solid:${floor.index}:${edge}`;
        const draw = (name: string, role: string, shape: Point[], face = skin, back = -0.2) =>
          panel(builder.part(`${prefix}:${name}`), field, material(role), shape, face, back, holes);
        for (const section of floor.assembly.sections.filter(s => s.edge === edge)) {
          const u0 = section.offset, u1 = u0 + section.width;
          const columns = Math.max(1, Math.round(section.width / 2.5));
          for (let column = 0; column < columns; column++) {
            const lo = u0 + section.width * column / columns, hi = u0 + section.width * (column + 1) / columns;
            draw(`concrete-panel:${section.id}:${column}`, 'wall', rectangle(lo + 0.012, hi - 0.012, base + 0.012, top - 0.012));
          }
          if (!section.id.endsWith(':support')) continue;
          draw(`support-core:${section.id}`, 'column', rectangle(u0 + 0.06, u1 - 0.06, base, top), skin + 0.1, skin);
          if (floor.index === 0) continue;
          const left = u0 + 0.18, right = u1 - 0.18, midY = y0 + (y1 - y0) * 0.48;
          const thick = 0.46, orientation = (group!.id + edge) % 2;
          // Split the bent support into convex strips for correct front triangulation.
          const lower: Point[] = orientation ? [[left, y0], [left + thick, y0], [right, midY], [right - thick, midY + 0.2]] :
            [[right - thick, y0], [right, y0], [left + thick, midY], [left, midY - 0.2]];
          const upper = orientation ? rectangle(right - thick, right, midY, y1) : rectangle(left, left + thick, midY - 0.2, y1);
          for (const [i, shape] of [lower, upper].entries()) draw(`angular-support:${section.id}:${i}`, 'column',
            intersect(shape, { u0, u1, y0: base, y1: top }), front - 0.035, skin);
        }
        const head = floor.index === 0 || group?.toFloor === floor.index;
        if (head) {
          draw('broad-group-band', 'column', rectangle(0, field.length, top - 0.54, top - 0.13), front - 0.08, skin);
          draw('stepped-band-cap', 'wall', rectangle(0, field.length, top - 0.13, top), front, skin);
          draw('metal-drip-edge', 'wall-trim', rectangle(0, field.length, top - 0.06, top - 0.025), front + 0.014, front - 0.05);
        } else draw('slab-joint', 'column', rectangle(0, field.length, top - 0.11, top), skin + 0.035, skin);
      }
    }
  } finally { builder.floor = previous; }
}
