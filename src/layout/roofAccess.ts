import { ringInsidePolygon, quant, type P2 } from '../core/polygon.ts';
import { Rng } from '../core/rng.ts';
import { ROOF_ACCESS } from '../rules/tables.ts';
import type { Blueprint } from '../types.ts';
import type { CoreStairPlacement } from './corePreflight.ts';

/**
 * Complete stair footprint, enclosure walls and arrival space on the selected
 * frame: the housing takes the shaft on its own axes, so its deep side runs
 * along the flight and its door stands at the head. The placement it is given
 * is the one Interior confirms with the roof in hand, never the first guess.
 */
export function fitRoofAccess(seed: string, outline: P2[], stair: CoreStairPlacement): Blueprint['roof']['bulkhead'] {
  const width = stair.width + ROOF_ACCESS.enclosureAllowance;
  const depth = stair.depth + ROOF_ACCESS.enclosureAllowance;
  const { center, axis } = stair;
  const cross: P2 = [-axis[1], axis[0]];
  // The flight arrives at the end of its run, so the door stands on that face.
  const head: P2 = width >= depth ? [...axis] as P2 : cross;
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
    doorNormal: head,
    doorWidth: ROOF_ACCESS.doorWidth,
    doorHeight: ROOF_ACCESS.doorHeight,
  };
}
