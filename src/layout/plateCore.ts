import { ExteriorError } from '../core/errors.ts';
import { area } from '../core/polygon.ts';
import type { FloorLayout } from './model.ts';
import type { P2 } from '../types.ts';
import { bestCoreFit, coreRects, type CoreRect } from './core.ts';
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

/**
 * Every plate holds a core: the interior lays its stairs, lifts and risers in
 * one rectangle behind the facade, so every floor, ground and setbacks alike,
 * has to host the rectangle its type and floor count call for. A lot that
 * cannot is named here rather than at assembly.
 */
export function inspectCorePlate(
  floors: FloorLayout[], facadeInset: number, aboveGround: number, rectangular: boolean,
): { axis: P2; error: ExteriorError | null } {
  const ground = floors.find((f) => f.index === 0)!.outline;
  const rects = coreRects(floors.map((floor) => floor.height), aboveGround, area(ground));
  const outlines = floors.map((floor) => floor.outline);
  const { fits, reached, axis } = fitPlateCore(outlines, facadeInset, rects, rectangular);
  if (fits) return { axis, error: null };
  return {
    axis,
    error: new ExteriorError('E_CORE_PLATE',
      `the shared core reaches ${reached.band.toFixed(2)} m of plate, under the ${reached.rect.length} x ${reached.rect.depth} m a ${reached.rect.mode} needs`,
      { band: reached.band, needs: [reached.rect.length, reached.rect.depth], mode: reached.rect.mode }),
  };
}
