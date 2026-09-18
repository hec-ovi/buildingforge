import { MeshBuilder } from '../mesh/primitives.ts';
import { ExteriorError } from '../core/errors.ts';
import { bayCell, cornerCells, type Cell } from './cell.ts';
import { KIT } from './module.ts';
import { recipeFor } from './recipes/index.ts';
import { backing, openingOn } from './backing.ts';
import type { PieceContext } from './recipe.ts';
import type { PieceOpening, PieceRequest, SignAnchor } from './types.ts';

/** Author surfaces and opening records before shared seam tessellation. */
export function authorPiece(request: PieceRequest) {
  const recipe = recipeFor(request.family);
  const band = request.band, kind = request.piece;
  const seed = request.seed ?? 'kit';
  const height = request.height ?? recipe.heights[band];
  if (!(height > 0)) throw new ExteriorError('E_SCHEMA', `piece height must be positive: ${height}`);
  const runs: Cell[] = kind === 'corner' ? cornerCells(KIT.cornerArm) : [bayCell(KIT.bay)];
  const mb = new MeshBuilder();
  const anchors: SignAnchor[] = [];
  const openings: PieceOpening[] = [];
  const context: PieceContext = {
    family: recipe.family, band, piece: kind, runs, height, backing: recipe.backing,
    material: (role) => {
      const slot = recipe.materials[role];
      if (!slot) throw new ExteriorError('E_MATERIAL_UNRESOLVED', `${recipe.family} has no material role "${role}"`, { role });
      return slot;
    },
    part: (name, options) => mb.part(name, options ?? {}),
    anchor: (anchor) => anchors.push(anchor),
    opening: (opening) => {
      if (opening.width <= 0 || opening.height <= 0 || opening.position[1] < 0
        || opening.position[1] + opening.height > height) {
        throw new ExteriorError('E_SCHEMA', 'piece height cannot contain its openings');
      }
      openings.push({ ...opening, id: opening.id ?? `window:${openings.length}` });
    },
  };
  recipe.build(context);
  const doors = openings.filter(o => o.kind === 'door');
  if (doors.length) {
    for (const cell of runs) for (const door of doors) {
      const hole = openingOn(cell, door);
      if (hole) cell.openings.push(hole);
    }
    mb.parts.length = 0; anchors.length = 0; openings.length = 0;
    recipe.build(context);
  }
  for (const cell of runs) cell.openings.length = 0;
  backing(context, openings);
  return { recipe, band, kind, seed, height, runs, mb, anchors, openings };
}
