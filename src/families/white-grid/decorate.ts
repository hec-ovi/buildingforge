import { FacadeField, type DecorationContext, type FloorLayout, type Point } from '../api.ts';
import { dimensions as d } from './dimensions.ts';
import { intersect, panel, rectangle, type Rectangle } from './panel.ts';
import { relief } from './relief.ts';

class WhiteGridFacade {
  private readonly context: DecorationContext;

  constructor(context: DecorationContext) { this.context = context; }

  build(): void {
    const { builder, layout } = this.context;
    const previousFloor = builder.floor;
    try {
      for (const floor of layout.floors) {
        if (floor.index < 0 || !floor.assembly) continue;
        builder.floor = floor.index;
        const front = relief(floor.outline, layout.request.parcel.footprint);
        for (let edge = 0; edge < floor.outline.length; edge++) this.face(floor, edge, front);
      }
    } finally { builder.floor = previousFloor; }
  }

  private reservations(floor: FloorLayout, edge: number): Rectangle[] {
    const holes = floor.openings.filter(o => o.edge === edge && o.kind !== 'window').map(o => {
      const envelope = o.door?.cassette;
      const u0 = envelope?.offset ?? o.offset;
      const y0 = floor.elevation + (envelope?.sill ?? o.sill);
      return { u0: u0 - 0.12, u1: u0 + (envelope?.width ?? o.width) + 0.12,
        y0: y0 - 0.12, y1: y0 + (envelope?.height ?? o.height) + 0.12 };
    });
    for (const carved of this.context.layout.carved) {
      if (carved.aperture.face !== edge) continue;
      holes.push({ u0: Math.min(...carved.facePoly.map(p => p[0])) - 0.12,
        u1: Math.max(...carved.facePoly.map(p => p[0])) + 0.12,
        y0: Math.min(...carved.facePoly.map(p => p[1])) - 0.12,
        y1: Math.max(...carved.facePoly.map(p => p[1])) + 0.12 });
    }
    return holes;
  }

  private face(floor: FloorLayout, edge: number, front: number): void {
    const { builder, layout, material } = this.context;
    const field = new FacadeField(floor.outline, edge);
    const reservations = this.reservations(floor, edge);
    const back = front - 0.14;
    const base = floor.elevation, top = base + floor.height;
    const prefix = `white-grid:${floor.index}:${edge}`;
    const draw = (name: string, role: string, polygon: Point[], face = front, rear = back) =>
      panel(builder.part(`${prefix}:${name}`), field, material(role), polygon, face, rear, reservations, role === 'column' ? 'world' : 'exact');

    if (floor.index === 0) {
      const lowerHeight = floor.height * 0.4;
      const count = Math.max(1, Math.round(field.length));
      const module = field.length / count;
      for (let i = 0; i < count; i++) {
        const u0 = i === 0 ? 0 : i * module + d.seam / 2;
        const u1 = i === count - 1 ? field.length : (i + 1) * module - d.seam / 2;
        draw(`base:${i}`, 'ground', rectangle(u0, u1, base + d.seam, base + lowerHeight - d.seam / 2), front - 0.04, back - 0.04);
        draw(`podium:${i}`, 'wall', rectangle(u0, u1, base + lowerHeight + d.seam / 2, top - 0.25), front - 0.1, back - 0.1);
        draw(`podium-head:${i}`, 'column', rectangle(u0, u1, top - 0.25, top - d.seam / 2));
      }
      return;
    }

    const sections = floor.assembly!.sections.filter(s => s.edge === edge);
    let bay = 0;
    for (const section of sections) {
      const u0 = section.offset, u1 = u0 + section.width;
      if (section.technique === 'paired-pier') {
        draw(`pier:${section.id}`, 'column', rectangle(u0 === 0 ? 0 : u0 + d.seam / 2,
          Math.abs(u1 - field.length) < 1e-8 ? field.length : u1 - d.seam / 2, base + d.seam / 2, top - d.seam / 2));
        continue;
      }
      const ribbonFront = Math.max(-0.1, front - 0.24);
      draw(`sill:${section.id}`, 'wall-trim', rectangle(u0, u1, base, base + d.sill), ribbonFront, ribbonFront - 0.14);
      draw(`head:${section.id}`, 'wall-trim', rectangle(u0, u1, top - d.head, top), ribbonFront, ribbonFront - 0.14);

      const group = layout.assembly!.groups.find(g => g.id === floor.assembly!.group)!;
      const start = layout.floors.find(f => f.index === group.fromFloor)!;
      const end = layout.floors.find(f => f.index === group.toFloor)!;
      const y0 = start.elevation, y1 = end.elevation + end.height;
      const height = y1 - y0;
      const thickness = height * d.braceHeightFraction;
      const ascending = (group.id + edge + bay++) % 2 === 1;
      const brace: Point[] = ascending
        ? [[u0, y0], [u1, y1 - thickness], [u1, y1], [u0, y0 + thickness]]
        : [[u0, y1 - thickness], [u1, y0], [u1, y0 + thickness], [u0, y1]];
      const clipped = intersect(brace, { u0, u1, y0: base, y1: top });
      draw(`brace:${section.id}`, 'column', clipped);
    }
  }
}

export function decorate(context: DecorationContext): void { new WhiteGridFacade(context).build(); }
