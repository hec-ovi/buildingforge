import { ringInsidePolygon, quant, type P2 } from '../core/polygon.ts';
import { Rng } from '../core/rng.ts';
import { ROOF_ACCESS } from '../rules/tables.ts';
import type { Blueprint } from '../types.ts';
import type { CoreStairPlacement } from './corePreflight.ts';

/**
 * Complete stair footprint, enclosure walls and arrival space on the selected
 * frame. The flight is long and narrow and Interior runs it along the frame's
 * v axis, so the housing's deep side always takes the long run and its door
 * stands at the head, whichever way round the published shaft reads.
 */
export function fitRoofAccess(seed: string, outline: P2[], stair: CoreStairPlacement): Blueprint['roof']['bulkhead'] {
  const width = Math.min(stair.width, stair.depth) + ROOF_ACCESS.enclosureAllowance;
  const depth = Math.max(stair.width, stair.depth) + ROOF_ACCESS.enclosureAllowance;
  const { center, axis } = stair;
  const cross: P2 = [-axis[1], axis[0]];
  const hw = width / 2 + ROOF_ACCESS.clearance;
  const hd = depth / 2 + ROOF_ACCESS.clearance;
  const corners: P2[] = ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as P2[]).map(([u, v]): P2 => [
    center[0] + axis[0] * u + cross[0] * v,
    center[1] + axis[1] * u + cross[1] * v,
  ]);
  if (!ringInsidePolygon(outline, corners)) return null;
  const rng = new Rng(seed, 'roof-access');
  return {
    center: [...center], axis: [...axis], width, depth,
    housingHeight: quant(rng.range(...ROOF_ACCESS.housingHeight)),
    doorNormal: cross,
    doorWidth: ROOF_ACCESS.doorWidth,
    doorHeight: ROOF_ACCESS.doorHeight,
  };
}
