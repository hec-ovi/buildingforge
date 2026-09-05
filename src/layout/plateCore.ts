import type { P2 } from '../types.ts';
import { bestCoreFit, type CoreRect } from './core.ts';
import { coreAxis, plateDepth } from './plate.ts';

/** Rectangular plates fit the shared core on their two construction axes. */
export function fitPlateCore(
  outlines: readonly P2[][], inset: number, rects: readonly CoreRect[], rectangular: boolean, lockedAxis?: P2,
): ReturnType<typeof bestCoreFit> {
  const principal = lockedAxis ?? coreAxis(outlines[0]!);
  if (!rectangular) return bestCoreFit(outlines, principal, inset, rects, lockedAxis === undefined);
  const axes = lockedAxis ? [principal] : [principal, [-principal[1], principal[0]] as P2];
  const results = axes.map((axis) => {
    const depth = Math.min(...outlines.map((outline) => plateDepth(outline, axis))) - 2 * inset;
    const permitted = rects.filter((rect) => rect.depth <= depth + 1e-9);
    const result = bestCoreFit(outlines, axis, inset, permitted.length ? permitted : rects, false);
    return permitted.length ? result : { ...result, fits: null };
  });
  return results.find((result) => result.fits) ?? results[0]!;
}
