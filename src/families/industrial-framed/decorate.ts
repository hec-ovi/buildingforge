import { FacadeField, type DecorationContext, type Point } from '../api.ts';
import { intersect, panel, projection, rectangle, reservations } from './geometry.ts';

/** Deep exterior frames, three-storey X braces and recessed occupied window fields. */
export function decorate({ builder, layout, material }: DecorationContext): void {
  const previous = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (!floor.assembly || floor.index < 0) continue;
      builder.floor = floor.index;
      const front = projection(floor.outline, layout.request.parcel.footprint) - 0.02;
      const skin = Math.max(-0.12, front - 0.7), base = floor.elevation, top = base + floor.height;
      const group = layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
      const first = layout.floors.find(f => f.index === group?.fromFloor) ?? floor;
      const last = layout.floors.find(f => f.index === group?.toFloor) ?? floor;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge), holes = reservations(layout, floor, edge);
        const prefix = `industrial-framed:${floor.index}:${edge}`;
        const draw = (name: string, role: string, shape: Point[], face = skin, back = -0.2) =>
          panel(builder.part(`${prefix}:${name}`), field, material(role), shape, face, back, holes);
        const sections = floor.assembly.sections.filter(s => s.edge === edge);
        for (const section of sections) {
          const u0 = section.offset, u1 = u0 + section.width;
          draw(`skin:${section.id}`, floor.index ? 'wall' : 'ground', rectangle(u0, u1, base, top));
          if (section.id.endsWith(':pier')) {
            draw(`outer-frame:${section.id}`, 'column', rectangle(u0, u1, base, top), front, skin);
            // Fitted collars terminate at the same floor bands as the clear window fields.
            draw(`pier-collar:${section.id}`, 'wall-trim', rectangle(u0, u1, top - 0.18, top - 0.08), front + 0.015, front - 0.06);
          }
          if (floor.index === 0 || !section.id.endsWith(':brace')) continue;
          draw(`service-spine:${section.id}`, 'service', rectangle(u0 + 0.12, u1 - 0.12, base + 0.34, top - 0.34), skin + 0.045, skin + 0.018);
          const y0 = first.elevation + 0.38, y1 = last.elevation + last.height - 0.62;
          const low = u0 + 0.08, high = u1 - 0.08, thick = 0.32;
          const clip = { u0, u1, y0: base, y1: top };
          const braces: Point[][] = [
            [[low, y0], [low + thick, y0], [high, y1], [high - thick, y1]],
            [[high - thick, y0], [high, y0], [low + thick, y1], [low, y1]],
          ];
          braces.forEach((brace, index) => draw(`cross-brace:${section.id}:${index}`, 'column', intersect(brace, clip), front - 0.07, front - 0.23));
          const middle = (y0 + y1) / 2;
          draw(`brace-node:${section.id}`, 'wall-trim', intersect(rectangle((u0 + u1) / 2 - 0.28,
            (u0 + u1) / 2 + 0.28, middle - 0.32, middle + 0.32), clip), front - 0.04, front - 0.25);
        }
        const groupHead = floor.index === 0 || group?.toFloor === floor.index;
        draw(groupHead ? 'group-band' : 'floor-seam', groupHead ? 'column' : 'wall-trim',
          rectangle(0, field.length, top - (groupHead ? 0.46 : 0.13), top), groupHead ? front : skin + 0.07, skin);
        if (groupHead) draw('band-edge', 'wall-trim', rectangle(0, field.length, top - 0.13, top - 0.06), front + 0.015, front - 0.06);
      }
    }
  } finally { builder.floor = previous; }
}
