import { FacadeField, cutWall, rectHole, type DecorationContext, type FloorLayout } from '../api.ts';
import { reservations } from './reservations.ts';

/** Metal ribbon fields and pale service panels retain the authored window holes. */
export function upperSkin(context: DecorationContext, floor: FloorLayout, edge: number, clearance: number): void {
  const field = new FacadeField(floor.outline, edge);
  const sink = context.builder.part(`mirror-shutters:${floor.index}:${edge}:skin`);
  const holes = reservations(context.layout, floor, edge).map(r => rectHole(r.u0, r.y0, r.u1 - r.u0, r.y1 - r.y0));
  for (const opening of floor.openings.filter(o => o.edge === edge && o.kind === 'window')) {
    holes.push(rectHole(opening.offset - 0.025, floor.elevation + opening.sill - 0.025,
      opening.width + 0.05, opening.height + 0.05));
  }
  for (const section of floor.assembly!.sections.filter(s => s.edge === edge)) {
    const spine = section.id.includes(':spine:');
    if (!spine && !section.id.includes(':ribbon:')) continue;
    const local = holes.map(h => ({ poly: h.poly.map(([u, y]): [number, number] => [u - section.offset, y]) }));
    for (const piece of cutWall(section.width, floor.elevation + 0.018, floor.elevation + floor.height - 0.018, local)) {
      field.solid(sink, context.material(spine ? 'ground' : 'wall-trim'),
        piece.bl[0] + section.offset, piece.br[0] + section.offset, piece.bl[1], piece.tl[1],
        Math.min(clearance, spine ? 0.12 : 0.06), -0.12, [0, 1], { start: true, end: true, back: false }, true);
    }
  }
}
