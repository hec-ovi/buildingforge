import type { DecorationContext, FloorLayout, ModelInstance } from '../api.ts';
import { Surface } from './surface.ts';
import { accent } from './lights.ts';

function entrance(context: DecorationContext, floor: FloorLayout, edge: number, surface: Surface, instances: ModelInstance[]): void {
  const { builder, material } = context;
  const doors = floor.openings.filter(o => o.edge === edge && o.kind === 'door');
  if (!doors.length) return;
  const sink = builder.part(`corporate:entry:${edge}`);
  const metal = material('window-frame');
  const low = Math.min(...doors.map(d => d.offset)), high = Math.max(...doors.map(d => d.offset + d.width));
  const head = Math.max(...doors.map(d => floor.elevation + d.sill + d.height));
  const canopyY = Math.max(head + 0.3, floor.elevation + floor.height - 0.55);
  const u0 = Math.max(0.55, low - 2.4), u1 = Math.min(surface.field.length - 0.55, high + 2.4);
  if (canopyY + 0.22 < floor.elevation + floor.height) {
    surface.solid(sink, material('wall-trim'), u0, u1, canopyY, canopyY + 0.22, 1.27, 0);
    surface.solid(sink, material('light'), u0 + 0.05, u1 - 0.05, canopyY + 0.09, canopyY + 0.145, 1.285, 1.275);
    for (let u = u0 + 0.45; u < u1 - 0.2; u += 1.5) {
      surface.solid(sink, metal, u - 0.12, u + 0.12, canopyY - 0.035, canopyY, 1.05, 0.82);
      surface.solid(sink, material('light'), u - 0.078, u + 0.078, canopyY - 0.042, canopyY - 0.035, 1.015, 0.86);
      accent(context, surface, edge, u, canopyY - 0.065, 1.07, 1800);
    }
    for (let u = u0 + 1.5; u < u1; u += 1.5) surface.solid(sink, metal, u - 0.025, u + 0.025, canopyY - 0.04, canopyY, 1.15, 0.08);
  }
  for (const door of doors) {
    const y = floor.elevation + door.sill;
    const thickness = 0.11;
    for (const u of [door.offset - 0.3, door.offset + door.width + 0.19]) {
      surface.solid(sink, metal, u, u + thickness, y, y + door.height + 0.21, 0.24, 0.02);
      for (let v = y + 0.35; v < y + door.height; v += 0.72) surface.solid(sink, material('wall-trim'), u - 0.015, u + thickness + 0.015, v, v + 0.075, 0.255, 0.24);
    }
    surface.solid(sink, metal, door.offset - 0.3, door.offset + door.width + 0.3, y + door.height + 0.18, y + door.height + 0.31, 0.24, 0.02);
    surface.solid(sink, material('light'), door.offset + door.width * 0.32, door.offset + door.width * 0.68, y + door.height + 0.225, y + door.height + 0.255, 0.255, 0.245);
  }
  if (surface.margin < 1.15) return;
  for (const [side, u] of [['left', u0 - 1.4], ['right', u1 + 1.4]] as const) {
    const rect: [number, number, number, number] = [u - 1.15, u + 1.15, floor.elevation, floor.elevation + 3.2];
    if (rect[0] < 0.5 || rect[1] > surface.field.length - 0.5 || !surface.clear(rect)) continue;
    const planter = builder.part(`corporate:planter:${edge}:${side}`);
    surface.solid(planter, metal, u - 1.15, u + 1.15, floor.elevation + 0.02, floor.elevation + 0.54, 1.15, 0.08);
    surface.solid(planter, material('roof'), u - 1.04, u + 1.04, floor.elevation + 0.54, floor.elevation + 0.565, 1.04, 0.18);
    instances.push({ kind: 'ornamental-tree', position: surface.field.point(u, floor.elevation + 0.56, 0.62), size: [2.1, 3, 1.05], rotation: -Math.atan2(surface.field.dir[1], surface.field.dir[0]) });
  }
}

export function decoratePodium(context: DecorationContext): ModelInstance[] {
  const instances: ModelInstance[] = [];
  const floor = context.layout.floors.find(f => f.index === 0);
  if (!floor) return instances;
  context.builder.floor = 0;
  for (let edge = 0; edge < 4; edge++) {
    const surface = new Surface(context, floor, edge);
    const sink = context.builder.part(`corporate:podium:${edge}`);
    surface.panels(sink, context.material('ground'), 0.03, surface.field.length - 0.03, floor.elevation + 0.15, floor.elevation + floor.height - 0.05, 3, 2.1, floor.elevation + 0.15, 0.13);
    surface.solid(sink, context.material('window-frame'), 0.03, surface.field.length - 0.03, floor.elevation + 0.05, floor.elevation + 0.15, 0.15, 0.02);
    surface.solid(sink, context.material('light'), 0.04, surface.field.length - 0.04, floor.elevation + 0.065, floor.elevation + 0.115, 0.16, 0.151);
    for (let u = 1.5; u < surface.field.length - 0.5; u += 3) accent(context, surface, edge, u, floor.elevation + 0.18, 0.19, 1200);
    entrance(context, floor, edge, surface, instances);
  }
  return instances;
}
