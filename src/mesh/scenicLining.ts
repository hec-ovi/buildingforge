import type { FloorLayout } from '../layout/model.ts';
import type { P2 } from '../types.ts';

/** Window returns belong to the permanent shell, including behind removable scenery. */
export function windowReturnProfile(floor: FloorLayout, edge: number, wallDepth: number): (a: P2, b: P2) => { front: number; depth: number } | undefined {
  const windows = floor.openings.filter(opening => opening.edge === edge && opening.kind === 'window' && opening.glazing);
  return (a, b) => {
    const u = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
    for (const opening of windows) {
      const left = opening.offset, right = left + opening.width;
      const bottom = floor.elevation + opening.sill, top = bottom + opening.height;
      const horizontal = Math.abs(a[1] - b[1]) < 1e-7 && (Math.abs(y - bottom) < 1e-7 || Math.abs(y - top) < 1e-7)
        && u > left - 1e-7 && u < right + 1e-7;
      const vertical = Math.abs(a[0] - b[0]) < 1e-7 && (Math.abs(u - left) < 1e-7 || Math.abs(u - right) < 1e-7)
        && y > bottom - 1e-7 && y < top + 1e-7;
      if (horizontal || vertical) {
        const section = floor.assembly?.sections.find(s => s.id === opening.sectionId);
        return { front: -(section?.border.surfaceDepth ?? 0), depth: wallDepth };
      }
    }
    return undefined;
  };
}
