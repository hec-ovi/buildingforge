import type { Cell } from './cell.ts';
import type { PieceContext } from './recipe.ts';
import type { PieceOpening } from './types.ts';
import { glazing, wall, type Opening } from './skin.ts';

export function openingOn(cell: Cell, opening: PieceOpening): Opening | undefined {
  if (opening.facing[0] * cell.normal[0] + opening.facing[2] * cell.normal[2] < 0.99) return;
  const u = (opening.position[0] - cell.origin[0]) * cell.run[0]
    + (opening.position[2] - cell.origin[1]) * cell.run[1];
  return { u0: u - opening.width / 2, u1: u + opening.width / 2,
    y0: opening.position[1], y1: opening.position[1] + opening.height };
}

/** A continuous inward surface, with through openings and mitered corner arms. */
export function backing(context: PieceContext, openings: PieceOpening[]): void {
  const sink = context.part('backing');
  for (const cell of context.runs) {
    const holes = openings.map(o => openingOn(cell, o)).filter((o): o is Opening => !!o);
    wall(sink, cell, context.material('inner-wall'), {
      u0: context.piece === 'corner' ? context.backing : 0, u1: cell.length,
      y0: 0, y1: context.height, depth: -context.backing, facing: -1, openings: holes,
    });
    for (const record of openings.filter(o => o.kind === 'door')) {
      const hole = openingOn(cell, record);
      if (!hole) continue;
      const face = (record.position[0] - cell.origin[0]) * cell.outward[0]
        + (record.position[2] - cell.origin[1]) * cell.outward[1];
      glazing(context, sink, cell, hole, { glass: null, frame: context.material('window-frame'),
        face, recess: context.backing + face, ends: { bottom: false } });
    }
  }
}
