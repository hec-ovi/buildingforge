import { pairedExtent } from './paired.ts';
import type { Assembly, Point, Section } from './types.ts';

export const GARDEN_WING = 11;
export const MIN_GARDEN = 3;

/** Fixed glazed wings flank a planted centre; the roof ends at its minimum width. */
export function gardenAssembly(rectangle: [Point, Point, Point, Point], heights: number[]): Assembly {
  const origin = rectangle[0];
  const maxWidth = Math.hypot(rectangle[1][0] - origin[0], rectangle[1][1] - origin[1]);
  const maxDepth = Math.hypot(rectangle[3][0] - origin[0], rectangle[3][1] - origin[1]);
  const width = pairedExtent(maxWidth), depth = pairedExtent(maxDepth);
  if (width < 35 || depth < 25 || heights.length < 3) throw new RangeError('garden tower requires a 35 by 25 m plate and three floors');
  const u: Point = [(rectangle[1][0] - origin[0]) / maxWidth, (rectangle[1][1] - origin[1]) / maxWidth];
  const v: Point = [(rectangle[3][0] - origin[0]) / maxDepth, (rectangle[3][1] - origin[1]) / maxDepth];
  const centre: Point = [origin[0] + u[0] * maxWidth / 2 + v[0] * maxDepth / 2, origin[1] + u[1] * maxWidth / 2 + v[1] * maxDepth / 2];
  const towerWidth = width - 2, towerDepth = depth - 2;
  const roofWidth = 2 * GARDEN_WING + MIN_GARDEN;
  const roofDepth = Math.max(23, Math.floor(towerDepth * 0.85 * 2) / 2);
  const height = heights.slice(1).reduce((a, b) => a + b, 0);
  const ring = (w: number, d: number): Point[] => [[-w/2, -d/2], [w/2, -d/2], [w/2, d/2], [-w/2, d/2]].map(([x, z]) =>
    [centre[0] + u[0] * x! + v[0] * z!, centre[1] + u[1] * x! + v[1] * z!]);
  const size = (t: number) => [towerWidth + (roofWidth - towerWidth) * t, towerDepth + (roofDepth - towerDepth) * t] as const;
  let elevation = 0;
  const floors = heights.map((floorHeight, floor) => {
    const t = Math.max(0, (elevation - heights[0]!) / height);
    const [w, d] = floor === 0 ? [width, depth] : size(t);
    const [tw, td] = size(Math.min(1, (elevation + floorHeight - heights[0]!) / height));
    const sections: Section[] = [];
    const add = (edge: number, offset: number, span: number, technique: Section['technique']) => sections.push({
      id: `s:${sections.length}`, edge, offset, width: span, technique,
      border: { side: technique === 'garden-bay' ? 0.15 : 0.04, bottom: 0.22, top: 0.28, depth: technique === 'garden-bay' ? 1.2 : 0.12 },
    });
    for (let edge = 0; edge < 4; edge++) {
      const length = edge % 2 ? d : w;
      if (floor === 0) {
        add(edge, 0, (length - 10) / 2, 'podium-panel');
        add(edge, (length - 10) / 2, 10, 'paired-glass');
        add(edge, (length + 10) / 2, (length - 10) / 2, 'podium-panel');
      } else if (edge % 2 === 0) {
        add(edge, 0, 0.5, 'paired-pier'); add(edge, 0.5, 10, 'paired-glass'); add(edge, 10.5, 0.5, 'paired-pier');
        add(edge, 11, length - 22, 'garden-bay');
        add(edge, length - 11, 0.5, 'paired-pier'); add(edge, length - 10.5, 10, 'paired-glass'); add(edge, length - 0.5, 0.5, 'paired-pier');
      } else {
        add(edge, 0, 0.5, 'paired-pier');
        const count = Math.max(2, Math.round((towerDepth - 1) / 10));
        for (let i = 0; i < count; i++) add(edge, 0.5 + i * (length - 1) / count, (length - 1) / count, 'paired-glass');
        add(edge, length - 0.5, 0.5, 'paired-pier');
      }
    }
    elevation += floorHeight;
    return { floor, group: floor, outline: ring(w, d), ...(floor > 0 ? { topOutline: ring(tw, td) } : {}), sections, balconySections: [] };
  });
  return { architecture: 'garden-taper', grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'],
    groups: floors.map(f => ({ id: f.floor, fromFloor: f.floor, toFloor: f.floor,
      width: Math.hypot(f.outline[1]![0] - f.outline[0]![0], f.outline[1]![1] - f.outline[0]![1]),
      depth: Math.hypot(f.outline[3]![0] - f.outline[0]![0], f.outline[3]![1] - f.outline[0]![1]) })), floors };
}
