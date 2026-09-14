import { ARCHITECTURES, BAY_WIDTH, COMPOSITIONS, CONSTRUCTION_GRID, CORNER_EXTENT } from './catalog.ts';
import { sectionOutline } from './outline.ts';
import type { Assembly, AssemblyInput, Point } from './types.ts';

/** Fits whole corner and bay sections, then composes authored groups of floors. */
export class SectionAssembler {
  assemble(input: AssemblyInput): Assembly {
    const { rectangle, floorHeights, architecture } = input;
    if (!ARCHITECTURES.includes(architecture) || floorHeights.length === 0 || floorHeights.some(h => !Number.isFinite(h) || h <= 1.5)) {
      throw new RangeError('invalid architecture or floor heights');
    }
    const origin = rectangle[0]!;
    const dx = rectangle[1][0] - origin[0], dz = rectangle[1][1] - origin[1];
    const maxWidth = Math.hypot(dx, dz);
    const vx = rectangle[3][0] - origin[0], vz = rectangle[3][1] - origin[1];
    const maxDepth = Math.hypot(vx, vz);
    if (maxWidth <= 0 || maxDepth <= 0 || Math.abs(dx * vx + dz * vz) > 1e-6
      || dx * vz - dz * vx <= 0
      || Math.hypot(rectangle[2][0] - origin[0] - dx - vx, rectangle[2][1] - origin[1] - dz - vz) > 1e-6) {
      throw new RangeError('available plate must be a CCW rectangle');
    }
    const fitted = (length: number) => 2 * CORNER_EXTENT + BAY_WIDTH * Math.floor((length - 2 * CORNER_EXTENT + 1e-8) / BAY_WIDTH);
    const width = fitted(maxWidth), depth = fitted(maxDepth);
    if (width < 10 || depth < 10) throw new RangeError('available rectangle cannot fit complete corners and a bay');
    const u: Point = [dx / maxWidth, dz / maxWidth], v: Point = [vx / maxDepth, vz / maxDepth];
    const shiftU = Math.floor((maxWidth - width) / (2 * CONSTRUCTION_GRID) + 1e-8) * CONSTRUCTION_GRID;
    const shiftV = Math.floor((maxDepth - depth) / (2 * CONSTRUCTION_GRID) + 1e-8) * CONSTRUCTION_GRID;
    const composition = COMPOSITIONS[architecture];
    const groupCount = architecture === 'terrace-blocks' ? Math.min(3, Math.floor(floorHeights.length / 3)) : 1;
    if (groupCount < 1 || (architecture === 'terrace-blocks' && (width < 22 || depth < 18))) throw new RangeError('terrace blocks require three floors and a 22 by 18 m plate');
    const groups = Array.from({ length: groupCount }, (_, id) => ({
      id, fromFloor: Math.floor(id * floorHeights.length / groupCount),
      toFloor: Math.floor((id + 1) * floorHeights.length / groupCount) - 1,
      width: width - id * BAY_WIDTH, depth: depth - Math.min(id, 1) * BAY_WIDTH,
    }));
    const floors = floorHeights.map((_, floor) => {
      const group = groups.find(g => floor >= g.fromFloor && floor <= g.toFloor)!;
      const local = sectionOutline(group.width, group.depth, composition.corners, composition.bay);
      const insetU = (width - group.width) / 2, insetV = (depth - group.depth) / 2;
      const outline = local.outline.map(([x, z]): Point => [origin[0] + u[0] * (x + shiftU + insetU) + v[0] * (z + shiftV + insetV),
        origin[1] + u[1] * (x + shiftU + insetU) + v[1] * (z + shiftV + insetV)]);
      const balconySections = architecture === 'terrace-blocks' && floor === groups[0]!.toFloor
        ? local.sections.filter(s => s.edge === 1 && s.technique === 'deep-bay').map(s => s.id) : [];
      return { floor, group: group.id, outline, sections: local.sections, balconySections };
    });
    return { architecture, grid: 0.5, extent: { width, depth }, corners: [...composition.corners], groups, floors };
  }
}
