import { FacadeField, type DecorationContext, type ModelInstance } from '../api.ts';
import { reservations, subtract } from './reservations.ts';

/** Existing vegetation assets occupy the reserved forecourt beside the entrance. */
export function landscape(context: DecorationContext): ModelInstance[] {
  const ground = context.layout.floors.find(f => f.index === 0);
  if (!ground?.assembly?.sections.some(s => s.technique === 'paired-solid' && s.border.depth > 0)) return [];
  const instances: ModelInstance[] = [];
  context.builder.floor = 0;
  for (const door of ground.openings.filter(o => o.kind === 'door' && o.doorRole === 'main')) {
    const field = new FacadeField(ground.outline, door.edge);
    const holes = context.layout.floors.flatMap(floor => reservations(context.layout, floor, door.edge));
    const rotation = Math.atan2(-field.dir[1], field.dir[0]);
    // Beside the whole entrance assembly, so a sliding leaf keeps its wall.
    const entrance = door.door?.cassette ?? door;
    for (const side of [-1, 1]) {
      const u = side < 0 ? entrance.offset - 1.4 : entrance.offset + entrance.width + 1.4;
      const place = (kind: ModelInstance['kind'], centre: number, y: number, depth: number, size: ModelInstance['size']) => {
        const area = { left: centre - size[0] / 2, right: centre + size[0] / 2, bottom: y, top: y + size[1] };
        if (area.left < 0.1 || area.right > field.length - 0.1) return false;
        const pieces = subtract(area, holes);
        if (pieces.length !== 1 || pieces[0]!.left !== area.left || pieces[0]!.right !== area.right
          || pieces[0]!.bottom !== area.bottom || pieces[0]!.top !== area.top) return false;
        instances.push({ kind, position: field.point(centre, y, depth), size, rotation });
        return true;
      };
      place('palm', u, ground.elevation, 1.22, [1.6, 8, 1.4]);
      const shrubU = u - side * 0.7;
      const planter = { left: shrubU - 0.55, right: shrubU + 0.55, bottom: ground.elevation + 0.03, top: ground.elevation + 0.43 };
      const pieces = subtract(planter, holes);
      const planterFits = pieces.length === 1 && pieces[0]!.left === planter.left && pieces[0]!.right === planter.right
        && pieces[0]!.bottom === planter.bottom && pieces[0]!.top === planter.top;
      if (planterFits && place('shrub', shrubU, ground.elevation + 0.43, 1.3, [0.9, 0.7, 0.58])) {
        const sink = context.builder.part(`portal-planter:${door.id}:${side}`);
        field.solid(sink, context.material('wall-trim'), shrubU - 0.55, shrubU + 0.55,
          ground.elevation + 0.03, ground.elevation + 0.43, 1.65, 0.95, [0, 1], undefined, true);
      }
    }
  }
  return instances;
}
