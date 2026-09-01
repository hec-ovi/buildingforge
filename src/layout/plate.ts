// Plate depth across the core's axis: the extent of a floor outline across the
// longest ground edge, which is where an interior runs its corridor.

import { edgeDir, edgeLength, type P2 } from '../core/polygon.ts';
import { CORE_PLATE } from '../rules/tables.ts';

/** Skin-to-skin depth a plate needs to hold a core behind the deepest wall a style builds. */
export const MIN_PLATE_DEPTH = CORE_PLATE.minDepth + 2 * (CORE_PLATE.maxWallDepth + CORE_PLATE.lining);

/** Unit direction of the ground outline's longest edge. */
export function coreAxis(ground: P2[]): P2 {
  let longest = 0;
  for (let i = 1; i < ground.length; i++) {
    if (edgeLength(ground, i) > edgeLength(ground, longest)) longest = i;
  }
  return edgeDir(ground, longest);
}

/** Extent of an outline across the axis, skin to skin. */
export function plateDepth(outline: P2[], axis: P2): number {
  let min = Infinity, max = -Infinity;
  for (const [x, z] of outline) {
    const v = z * axis[0] - x * axis[1];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}
