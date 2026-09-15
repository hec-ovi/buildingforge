import { FacadeField } from '../api.ts';
import type { DecorationContext, FamilyDecoration, FloorLayout, ModelInstance, Point } from '../api.ts';
import { DIMENSIONS as D, entryRibOffsets } from './dimensions.ts';
import { entryRib } from './entryRib.ts';
import { podium } from './podium.ts';
import { treeInstances } from './planting.ts';
import { intersects, reservations, verticalRuns } from './reservations.ts';

export function decorate(context: DecorationContext): FamilyDecoration {
  const { builder, layout, material } = context;
  const previousFloor = builder.floor;
  const instances: ModelInstance[] = [];
  try {
    for (const floor of layout.floors.filter(f => f.index >= 0 && f.assembly)) {
      builder.floor = floor.index;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge);
        const reserved = reservations(layout, floor, edge);
        const clearance = outwardClearance(floor.outline, edge, layout.request.parcel.footprint);
        if (floor.index === 0) {
          podium(context, floor, edge);
          if (edge % 2 === 0 && clearance > 2.3) {
            entry(context, floor, field, reserved);
            instances.push(...treeInstances(floor, field, clearance, reserved));
          }
          continue;
        }
        const sink = builder.part(`mirror-shutters:${floor.index}:${edge}:mullions`);
        for (const section of floor.assembly!.sections.filter(s => s.edge === edge && s.id.includes(':bank:'))) {
          const count = Math.max(2, Math.round(section.width / D.mullionPitch));
          const front = Math.min(0.20, clearance), back = front - 0.16;
          for (let i = 0; i <= count; i++) {
            const u = section.offset + 0.12 + (section.width - 0.24) * i / count;
            for (const [y0, y1] of verticalRuns(u - 0.025, u + 0.025,
              floor.elevation + 0.12, floor.elevation + floor.height - 0.08, reserved)) {
              field.solid(sink, material('column'), u - 0.025, u + 0.025, y0, y1, front, back, [0, 1], undefined, true);
            }
          }
        }
        const group = layout.assembly!.groups.find(g => g.id === floor.assembly!.group)!;
        if (group.toFloor === floor.index) {
          const band = builder.part(`mirror-shutters:${floor.index}:${edge}:group-cornice`);
          const y0 = floor.elevation + floor.height - 0.30, y1 = floor.elevation + floor.height - 0.06;
          for (const section of floor.assembly!.sections.filter(s => s.edge === edge)) {
            const area = { u0: section.offset, u1: section.offset + section.width, y0, y1 };
            if (!intersects(area, reserved)) field.solid(band, material('wall-trim'), area.u0, area.u1, y0, y1,
              Math.min(clearance, 0.30), -0.03, [0, 1], undefined, true);
          }
        }
      }
    }
  } finally { builder.floor = previousFloor; }
  return { instances };
}

function entry(context: DecorationContext, floor: FloorLayout, field: FacadeField,
  reserved: ReturnType<typeof reservations>): void {
  const upper = context.layout.floors.find(f => f.index === 1);
  if (!upper) return;
  const rise = Math.min(floor.height + upper.height - 0.75, 8.25);
  for (const u of entryRibOffsets(field.length)) {
    if (intersects({ u0: u - 0.28, u1: u + 0.28, y0: 0, y1: rise + 0.7 }, reserved)) continue;
    const sink = context.builder.part(`mirror-shutters:0:${field.point(u, 0, 0).join(':')}:entry-rib`);
    entryRib(sink, field, u, rise, 2.1, context.material('column'), context.material('light-fixture'));
    field.solid(sink, context.material('ground'), u - 0.26, u + 0.26, 0, 0.52, 2.32, 1.88, [0, 1], undefined, true);
  }
}

/** The input is a rectangle; parcel distance bounds every attached projection. */
function outwardClearance(outline: Point[], edge: number, parcel: Point[]): number {
  const field = new FacadeField(outline, edge), a = outline[edge]!, b = outline[(edge + 1) % outline.length]!;
  let result = Infinity;
  for (let i = 0; i < parcel.length; i++) {
    const p = parcel[i]!, q = parcel[(i + 1) % parcel.length]!;
    const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    const normal: Point = [dz / length, -dx / length];
    const speed = normal[0] * field.normal[0] + normal[1] * field.normal[1];
    if (speed <= 1e-8) continue;
    for (const vertex of [a, b]) result = Math.min(result,
      ((p[0] - vertex[0]) * normal[0] + (p[1] - vertex[1]) * normal[1]) / speed);
  }
  return Math.max(0, Number.isFinite(result) ? result - 0.02 : 0);
}
