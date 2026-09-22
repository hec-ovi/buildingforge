import { FacadeField, type DecorationContext, type FamilySection, type PartSink } from '../api.ts';
import { dimensions as d } from './dimensions.ts';
import { intersects, reservations, subtract, type Rectangle } from './reservations.ts';

/** The host owns the permanent wall, real entrance, openings and room envelope. */
export function decorate({ builder, layout, material }: DecorationContext): void {
  const previous = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (floor.index < 0 || !floor.assembly) continue;
      builder.floor = floor.index;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge);
        const holes = reservations(layout, floor, edge);
        const sections = floor.assembly.sections.filter(s => s.edge === edge);
        // Zero on fixed faces: all relief then stays inside the exact footprint.
        const projection = Math.min(d.projection, sections[0]?.border.depth ?? 0);
        const skinFront = projection - 0.1;
        const bottom = floor.elevation, top = bottom + floor.height;
        const skin = builder.part(`service-storage:${floor.index}:${edge}:concrete`);
        const trim = builder.part(`service-storage:${floor.index}:${edge}:piers-and-bands`);
        const solid = (sink: PartSink, role: string, area: Rectangle, front: number, back: number) => {
          for (const r of subtract(area, holes)) field.solid(sink, material(role), r.left, r.right, r.bottom, r.top,
            front, back, [0, 1], { start: true, end: true, back: false }, true);
        };
        for (const section of sections) {
          const left = section.offset, right = left + section.width;
          // Deliberate joints stop on the shared bay/solid boundaries.
          solid(skin, floor.index === 0 ? 'ground' : 'wall',
            { left: left + 0.008, right: right - 0.008, bottom, top }, skinFront, -0.12);
          if (section.id.endsWith(':pier')) {
            solid(trim, 'column', { left, right, bottom, top }, projection - 0.035, skinFront);
            if (floor.index === 0) {
              const u = (left + right) / 2;
              solid(trim, 'service-metal', { left: u - 0.027, right: u + 0.027, bottom: bottom + 0.4, top: top - 0.28 },
                projection - 0.008, projection - 0.035);
              const fixture = { left: u - 0.16, right: u + 0.16, bottom: top - 0.64, top: top - 0.43 };
              // A complete fixture is omitted if access or an existing fixture needs its seat.
              if (!holes.some(h => intersects(fixture, h))) {
                solid(trim, 'service-metal', fixture, projection - 0.008, projection - 0.055);
                solid(trim, 'service-light', { left: u - 0.11, right: u + 0.11, bottom: top - 0.595, top: top - 0.485 },
                  projection - 0.001, projection - 0.004);
              }
            }
          }
          if (floor.index === 0 && section.id.endsWith(':sealed-shutter')) {
            shutters(builder.part(`service-storage:${floor.index}:${edge}:${section.id}:nonfunctional-panel`),
              section, bottom, floor.height, projection, solid);
          }
        }
        solid(trim, 'wall-trim', { left: 0, right: field.length, bottom: top - 0.2, top }, projection, skinFront);
        solid(trim, 'wall-trim', { left: 0, right: field.length, bottom: bottom + 0.015, top: bottom + 0.105 },
          projection - 0.015, skinFront);
      }
    }
  } finally { builder.floor = previous; }
}

type Solid = (sink: PartSink, role: string, area: Rectangle, front: number, back: number) => void;

function shutters(sink: PartSink, section: FamilySection, elevation: number, height: number, projection: number, solid: Solid): void {
  const left = section.offset + 0.08, right = section.offset + section.width - 0.08;
  const bottom = elevation + d.shutterSill;
  const top = elevation + Math.min(height - d.shutterHead, d.shutterMaximumHeight);
  solid(sink, 'shutter', { left, right, bottom, top }, projection - 0.055, projection - 0.095);
  // Horizontal roll seams, guides, sill and a closed head housing share one fitted field.
  const rows = Math.max(1, Math.round((top - bottom) / d.shutterPitch));
  for (let row = 1; row < rows; row++) {
    const y = bottom + (top - bottom) * row / rows;
    solid(sink, 'service-metal', { left, right, bottom: y - 0.009, top: y + 0.009 }, projection - 0.041, projection - 0.055);
  }
  for (const u of [left, right - 0.07]) solid(sink, 'service-metal',
    { left: u, right: u + 0.07, bottom, top: top + 0.1 }, projection - 0.015, projection - 0.095);
  solid(sink, 'service-metal', { left, right, bottom, top: bottom + 0.065 }, projection - 0.015, projection - 0.095);
  solid(sink, 'service-metal', { left: left - 0.035, right: right + 0.035, bottom: top, top: top + 0.25 },
    projection, projection - 0.095);
  // Locked covers are attached facade hardware, with no pivot, motion or access claim.
  const u = right - 0.22;
  solid(sink, 'service-metal', { left: u - 0.035, right: u + 0.035, bottom: bottom + 0.22, top: bottom + 0.42 },
    projection - 0.022, projection - 0.055);
}
