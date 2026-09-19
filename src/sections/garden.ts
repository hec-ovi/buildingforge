import { pairedExtent } from './paired.ts';
import type { Assembly, Point, Section } from './types.ts';

export const GARDEN_PIER = 0.5;
export const MIN_GARDEN_WING = 1.5;
export const MIN_GARDEN_SLOPE = 0.3;

/** Straight planted spine between glazed wings, truncated at their minimum width. */
export function gardenAssembly(input: [Point, Point, Point, Point], heights: number[]): Assembly {
  let rectangle = input;
  const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (distance(input[0], input[3]) > distance(input[0], input[1])) rectangle = [input[1], input[2], input[3], input[0]];
  const origin = rectangle[0];
  const maxWidth = distance(origin, rectangle[1]), maxDepth = distance(origin, rectangle[3]);
  const width = pairedExtent(maxWidth), depth = pairedExtent(maxDepth);
  if (width < 35 || depth < 25 || heights.length < 3) throw new RangeError('garden tower requires a 35 by 25 m plate and three floors');
  const u: Point = [(rectangle[1][0] - origin[0]) / maxWidth, (rectangle[1][1] - origin[1]) / maxWidth];
  const v: Point = [(rectangle[3][0] - origin[0]) / maxDepth, (rectangle[3][1] - origin[1]) / maxDepth];
  const centre: Point = [origin[0] + u[0] * maxWidth / 2 + v[0] * maxDepth / 2, origin[1] + u[1] * maxWidth / 2 + v[1] * maxDepth / 2];
  const towerWidth = width - 2, towerDepth = depth - 2;
  const spine = Math.max(10, Math.round((towerWidth - 2) / 30) * 10);
  const roofWidth = spine + 4 * GARDEN_PIER + 2 * MIN_GARDEN_WING;
  const height = heights.slice(1).reduce((a, b) => a + b, 0);
  if ((towerWidth - roofWidth) / (2 * height) < MIN_GARDEN_SLOPE - 1e-8) {
    throw new RangeError('garden tower height exceeds its base-relative taper; use fewer floors or a wider base');
  }
  const ring = (w: number, d: number): Point[] => [[-w/2, -d/2], [w/2, -d/2], [w/2, d/2], [-w/2, d/2]].map(([x, z]) =>
    [centre[0] + u[0] * x! + v[0] * z!, centre[1] + u[1] * x! + v[1] * z!]);
  const atHeight = (y: number) => towerWidth + (roofWidth - towerWidth) * Math.max(0, Math.min(1, y / height));
  let elevation = 0;
  const floors = heights.map((floorHeight, floor) => {
    const w = floor === 0 ? width : atHeight(elevation - heights[0]!);
    const d = floor === 0 ? depth : towerDepth;
    const topWidth = atHeight(elevation + floorHeight - heights[0]!);
    const sections: Section[] = [];
    const add = (edge: number, offset: number, span: number, technique: Section['technique']) => sections.push({
      id: `s:${sections.length}`, edge, offset, width: span, technique,
      border: { side: technique === 'garden-bay' ? 0.15 : 0.04, bottom: 0.22, top: 0.28, depth: technique === 'garden-bay' ? 1.5 : 0.24 },
    });
    for (let edge = 0; edge < 4; edge++) {
      const length = edge % 2 ? d : w;
      if (floor === 0) {
        add(edge, 0, (length - 10) / 2, 'podium-panel');
        add(edge, (length - 10) / 2, 10, 'paired-glass');
        add(edge, (length + 10) / 2, (length - 10) / 2, 'podium-panel');
      } else if (edge % 2 === 0) {
        const wing = (length - spine - 4 * GARDEN_PIER) / 2;
        add(edge, 0, GARDEN_PIER, 'paired-pier');
        add(edge, GARDEN_PIER, wing, 'paired-glass');
        add(edge, GARDEN_PIER + wing, GARDEN_PIER, 'paired-pier');
        add(edge, 2 * GARDEN_PIER + wing, spine, 'garden-bay');
        add(edge, 2 * GARDEN_PIER + wing + spine, GARDEN_PIER, 'paired-pier');
        add(edge, 3 * GARDEN_PIER + wing + spine, wing, 'paired-glass');
        add(edge, length - GARDEN_PIER, GARDEN_PIER, 'paired-pier');
      } else {
        add(edge, 0, GARDEN_PIER, 'paired-pier');
        const count = Math.max(2, Math.round((towerDepth - 1) / 10));
        for (let i = 0; i < count; i++) add(edge, GARDEN_PIER + i * (length - 1) / count, (length - 1) / count, 'paired-glass');
        add(edge, length - GARDEN_PIER, GARDEN_PIER, 'paired-pier');
      }
    }
    elevation += floorHeight;
    return { floor, group: floor, outline: ring(w, d), ...(floor > 0 ? { topOutline: ring(topWidth, towerDepth) } : {}), sections, balconySections: [] };
  });
  return { architecture: 'garden-taper', grid: 0.5, extent: { width, depth }, corners: ['square', 'square', 'square', 'square'],
    groups: floors.map(f => ({ id: f.floor, fromFloor: f.floor, toFloor: f.floor,
      width: distance(f.outline[0]!, f.outline[1]!), depth: distance(f.outline[0]!, f.outline[3]!) })), floors };
}
