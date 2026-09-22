import { FacadeField, tubeSegment, type DecorationContext, type PartSink } from '../api.ts';
import { dimensions as d } from './dimensions.ts';
import { reservations, subtract, type Area } from './reservations.ts';

/** The building's scale comes from slab bands, grouped piers, and real punched windows. */
export function decorate({ builder, layout, material }: DecorationContext): void {
  const prior = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (!floor.assembly || floor.index < 0) continue;
      builder.floor = floor.index;
      const group = layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
      const head = group?.toFloor === floor.index;
      const shift = floor.assembly.sections.some(s => s.technique === 'paired-solid' && s.border.depth > 0) ? 0 : d.relief;
      const bottom = floor.elevation, top = bottom + floor.height;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge);
        const holes = reservations(layout, floor, edge);
        const skin = builder.part(`megablock:skin:${floor.index}:${edge}`);
        const slabs = builder.part(`megablock:slabs:${floor.index}:${edge}`);
        const piers = builder.part(`megablock:piers:${floor.index}:${edge}`);
        const solid = (sink: PartSink, role: string, area: Area, front: number, back = -shift) => {
          for (const r of subtract(area, holes)) field.solid(sink, material(role), r.left, r.right, r.bottom, r.top,
            front - shift, back, [0, 1], { start: r.left > 1e-7, end: r.right < field.length - 1e-7, back: false }, true);
        };
        // Each complete apartment is one large panel. Recessed graphite joints separate groups.
        for (const section of floor.assembly.sections.filter(s => s.edge === edge)) {
          const left = section.offset, right = left + section.width;
          const bay = section.technique === 'paired-glass';
          const service = section.id.endsWith(':service');
          // The host owns structural backing and full-depth opening returns. These coplanar
          // finish faces need no hidden end caps at every subtraction seam or panel boundary.
          for (const area of subtract({ left, right, bottom, top }, holes)) field.plate(skin,
            material(floor.index === 0 ? 'ground' : service ? 'wall-trim' : 'wall'),
            area.left, area.right, area.bottom, area.top, -shift, true);
          if (!bay && !service) {
            solid(piers, 'column', { left: left + d.joint / 2, right: right - d.joint / 2,
              bottom: bottom + 0.012, top: top - 0.012 }, 0.145);
          }
          if (service && floor.index > 0) {
            const area = { left: left + 0.12, right: right - 0.12,
              bottom: bottom + d.sill + 0.08, top: top - (head ? d.groupHead : d.head) - 0.08 };
            const clear = subtract(area, holes);
            if (clear.length === 1 && sameArea(area, clear[0]!)) {
              const sink = builder.part(`megablock:service:${floor.index}:${edge}:${section.id}`);
              services(field, sink, material('megablock-service'), material('window-frame'), area, shift,
                layout.detail?.has('fittings') ?? false);
            }
          }
        }
        // Continuous heavy floor spandrels wrap the whole slab; only real reservations cut them.
        const sill = floor.index === 0 ? 0.18 : d.sill - 0.06;
        solid(slabs, floor.index === 0 ? 'ground' : 'column', {
          left: 0, right: field.length, bottom: bottom + 0.015, top: bottom + sill,
        }, 0.185);
        const headHeight = floor.index === 0 ? 0.28 : head ? d.groupHead - 0.06 : d.head - 0.06;
        // A broad recessed strip makes four-storey group boundaries readable at distance.
        if (head && floor.index > 0) {
          solid(slabs, 'column', { left: 0, right: field.length, bottom: top - headHeight, top: top - 0.3 }, d.relief);
          solid(slabs, 'wall-trim', { left: 0, right: field.length, bottom: top - 0.3, top: top - 0.13 }, 0.155);
          solid(slabs, 'column', { left: 0, right: field.length, bottom: top - 0.13, top: top - 0.014 }, d.relief);
        } else solid(slabs, 'column', { left: 0, right: field.length, bottom: top - headHeight, top: top - 0.014 }, 0.185);
      }
    }
  } finally { builder.floor = prior; }
}

function sameArea(a: Area, b: Area): boolean {
  return a.left === b.left && a.right === b.right && a.bottom === b.bottom && a.top === b.top;
}

/** Supported risers enter solid wall at both ends. The fittings step retains one complete run. */
function services(field: FacadeField, sink: PartSink, steel: string, graphite: string, area: Area, shift: number, simple: boolean): void {
  if (area.top - area.bottom < 0.8) return;
  const centre = (area.left + area.right) / 2, front = 0.145 - shift;
  for (const u of simple ? [centre] : [centre - 0.08, centre + 0.08]) {
    const start = field.point(u, area.bottom + 0.04, front), end = field.point(u, area.top - 0.04, front);
    tubeSegment(sink, steel, field.point(u, start[1], -0.012 - shift), start, 0.022);
    tubeSegment(sink, steel, start, end, 0.022);
    tubeSegment(sink, steel, end, field.point(u, end[1], -0.012 - shift), 0.022);
  }
  for (const fraction of [0.2, 0.8]) {
    const y = area.bottom + (area.top - area.bottom) * fraction;
    const halfWidth = simple ? 0.06 : 0.14;
    field.solid(sink, graphite, centre - halfWidth, centre + halfWidth, y - 0.025, y + 0.025,
      front + 0.026, -shift - 0.012, [0, 1], undefined, true);
  }
}
