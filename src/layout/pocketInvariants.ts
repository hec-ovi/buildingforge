import { ExteriorError } from '../core/errors.ts';
import { edgeLength } from '../core/polygon.ts';
import type { Floor, Opening } from '../types.ts';
import { POCKET, pocketLeafBounds } from './pocketDoor.ts';

/** Verify the motion contract before the same dimensions reach the output writers. */
export function checkPocketDoor(floor: Floor, opening: Opening): void {
  const door = opening.door;
  if (!door || door.motion.kind !== 'pocket') return;
  const fail = (): never => {
    throw new ExteriorError('E_INVARIANT', `door ${opening.id} has an invalid pocket assembly`);
  };
  const { motion, clearance: clear, cassette } = door;
  if (!clear || !cassette || floor.index !== 0 || opening.kind !== 'door' || opening.transom
    || motion.leaves.length !== opening.leaves || ![1, 2].includes(motion.leaves.length)
    || clear.offset !== opening.offset || clear.sill !== opening.sill || clear.width !== opening.width
    || clear.height !== opening.height || clear.backDepth !== cassette.backDepth
    || cassette.offset < 0 || cassette.offset + cassette.width > edgeLength(floor.outline, opening.edge) + 1e-6
    || cassette.sill !== 0 || cassette.height > floor.height + 1e-6
    || motion.maxTravel !== Math.max(...motion.leaves.map((leaf) => Math.abs(leaf.travelU)))) fail();
  for (const [index, leaf] of motion.leaves.entries()) {
    const p = leaf.pocket;
    const [a, b] = pocketLeafBounds(opening.offset, opening.width, motion.leaves.length, index);
    if (leaf.leaf !== index || !Number.isFinite(leaf.travelU) || leaf.travelU === 0
      || p.frontDepth >= door.recessDepth - POCKET.finishDepth
      || p.backDepth <= door.recessDepth + POCKET.leafThickness
      || p.backDepth >= cassette!.backDepth || p.offset <= cassette!.offset
      || p.offset + p.width >= cassette!.offset + cassette!.width
      || a + leaf.travelU < p.offset - 1e-6 || b + leaf.travelU > p.offset + p.width + 1e-6
      || p.sill >= opening.sill + POCKET.bottom
      || p.sill + p.height <= opening.sill + opening.height + POCKET.overlap
      || (leaf.travelU < 0
        ? Math.abs(p.offset + p.width - opening.offset) > 1e-6 || b + leaf.travelU >= opening.offset
        : p.offset !== opening.offset + opening.width || a + leaf.travelU <= opening.offset + opening.width)) fail();
  }
}
