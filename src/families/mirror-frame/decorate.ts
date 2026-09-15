import { FacadeField, type DecorationContext, type FamilyDecoration, type FloorLayout } from '../api.ts';
import { dimensions as d } from './dimensions.ts';
import { reservations, subtract, type Rectangle } from './reservations.ts';
import { landscape } from './landscape.ts';

/** Broad panel piers and stepped heads frame quieter, recessed vertical slots. */
export function decorate(context: DecorationContext): FamilyDecoration {
  const { builder, layout, material } = context;
  const prior = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (!floor.assembly || floor.index < 0) continue;
      builder.floor = floor.index;
      const sections = floor.assembly.sections;
      const projection = sections.find(s => s.technique === 'paired-solid')?.border.depth ?? 0;
      const group = layout.assembly?.groups.find(g => g.id === floor.assembly!.group);
      const head = group?.toFloor === floor.index;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const field = new FacadeField(floor.outline, edge);
        const holes = reservations(layout, floor, edge);
        const sink = builder.part(`portal-pier:${floor.index}:${edge}`);
        const solid = (slot: string, area: Rectangle, front: number, back: number) => {
          for (const r of subtract(area, holes)) field.solid(sink, slot, r.left, r.right, r.bottom, r.top, front, back, [0, 1], undefined, slot !== material('portal-trim'));
        };
        for (const section of sections.filter(s => s.edge === edge)) {
          const left = section.offset, right = left + section.width;
          const bottom = floor.elevation, top = bottom + floor.height;
          if (projection > 0) {
            const pier = section.technique === 'paired-solid';
            const columns = Math.max(1, Math.round(section.width / 3));
            const rows = Math.max(1, Math.round(floor.height / d.panelHeight));
            for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
              solid(material(pier ? 'column' : 'wall'), {
                left: left + section.width * col / columns + d.joint / 2,
                right: left + section.width * (col + 1) / columns - d.joint / 2,
                bottom: bottom + floor.height * row / rows + d.joint / 2,
                top: bottom + floor.height * (row + 1) / rows - d.joint / 2,
              }, pier ? projection : 0.045, 0.018);
            }
            if (pier && head && floor.index > 0) {
              for (let step = 0; step < 3; step++) solid(material('column'), {
                left: Math.max(0, left - (step + 1) * 0.16), right: Math.min(field.length, right + (step + 1) * 0.16),
                bottom: top - 0.75 + step * 0.25, top: top - 0.5 + step * 0.25 - d.joint,
              }, projection + (step + 1) * 0.09, 0.015);
            }
            if (pier && floor.index === 0) {
              solid(material('wall-trim'), { left, right, bottom: bottom + 0.03, top: bottom + 0.18 }, projection + 0.12, 0.015);
              fixture(context, floor, edge, field, (left + right) / 2, bottom + 0.24, section.width - 0.24, projection + 0.1);
            }
          }
          const opaqueSlot = section.technique === 'paired-glass'
            && !floor.openings.some(o => o.edge === edge && o.offset < right && o.offset + o.width > left);
          const entrySlot = floor.index === 1 && layout.floors.find(f => f.index === 0)?.openings
            .some(o => o.kind === 'door' && o.doorRole === 'main' && o.edge === edge && o.offset < right && o.offset + o.width > left);
          if (projection > 0 && opaqueSlot && !entrySlot && floor.index > 0 && group?.fromFloor === floor.index) {
            const width = section.width - 0.64;
            const y = bottom + 0.34;
            fixture(context, floor, edge, field, left + section.width / 2, y, width, 0.068);
          }
        }
        if (floor.index <= 1 && projection > 0) portal(context, floor, edge, field, solid, projection);
      }
    }
    return { instances: landscape(context) };
  } finally { builder.floor = prior; }
}

type Solid = (material: string, area: Rectangle, front: number, back: number) => void;

function portal(context: DecorationContext, floor: FloorLayout, edge: number, field: FacadeField, solid: Solid, projection: number): void {
  const ground = context.layout.floors.find(f => f.index === 0)!;
  for (const door of ground.openings.filter(o => o.edge === edge && o.kind === 'door' && o.doorRole === 'main')) {
    const margin = 0.18, rim = 0.24;
    const left = Math.max(0.08, door.offset - margin - rim), right = Math.min(field.length - 0.08, door.offset + door.width + margin + rim);
    const upper = context.layout.floors.find(f => f.index === 1);
    const tall = upper && !upper.openings.some(o => o.edge === edge && o.offset < right && o.offset + o.width > left);
    const portalTop = tall ? upper.elevation + upper.height - 0.18
      : Math.min(ground.elevation + ground.height - 0.16, ground.elevation + door.sill + door.height + 0.48);
    if (floor.elevation >= portalTop) continue;
    const bottom = floor.elevation + 0.03;
    const top = Math.min(floor.elevation + floor.height, portalTop);
    const trim = context.material('portal-trim');
    solid(trim, { left, right: left + rim, bottom, top }, projection + 0.08, 0.012);
    solid(trim, { left: right - rim, right, bottom, top }, projection + 0.08, 0.012);
    const width = right - left - 2 * rim;
    const panelBottom = Math.max(bottom, ground.elevation + door.sill + door.height + 0.24);
    const panelTop = Math.min(top, portalTop - rim);
    if (panelTop > panelBottom) for (const fraction of [0.22, 0.5, 0.78]) {
      const centre = left + rim + width * fraction;
      solid(trim, { left: centre - 0.14, right: centre + 0.14, bottom: panelBottom, top: panelTop }, 0.075, 0.014);
    }
    if (top === portalTop) {
      solid(trim, { left, right, bottom: top - rim, top }, projection + 0.08, 0.012);
      if (width > 0) fixture(context, floor, edge, field, (left + right) / 2, top - rim / 2, width, projection + 0.085);
    }
  }
}

function fixture(context: DecorationContext, floor: FloorLayout, edge: number, field: FacadeField, u: number, y: number, width: number, front: number): void {
  const area = { left: u - width / 2 - 0.04, right: u + width / 2 + 0.04, bottom: y - 0.08, top: y + 0.08 };
  const pieces = subtract(area, reservations(context.layout, floor, edge));
  if (pieces.length !== 1 || Object.keys(area).some(key => pieces[0]![key as keyof Rectangle] !== area[key as keyof Rectangle])) return;
  const lamp = context.material('portal-light');
  const position = field.point(u, y, front + 0.046);
  if (!context.layout.lights.some(l => l.material === lamp && l.position.every((v, i) => Math.abs(v - position[i]!) < 1e-7))) {
    context.layout.lights.push({ kind: floor.index === 0 ? 'entrance' : 'accent', edge, position,
      normal: [...field.normal], size: [width, 0.06, 0.025], standoff: 0, material: lamp,
      color: '#c8f6f3', lumens: width * 700, range: 14 });
  }
}
