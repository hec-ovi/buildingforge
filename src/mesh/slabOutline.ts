import { edgeDir, edgeLength, edgeNormal, type P2 } from '../core/polygon.ts';
import type { FloorLayout } from '../layout/model.ts';
import { slabSpans } from './slabSpans.ts';

/** Floor edges follow inset facade fields and keep the approaches to traversable openings. */
export function slabOutline(floor: FloorLayout, below?: FloorLayout): P2[] {
  const sections = floor.assembly?.sections ?? [];
  if (!sections.some(s => (s.border.surfaceDepth ?? 0) > 0 || s.border.surfaceProfile?.some(p => p.depth > 0))) return floor.outline;
  const edges = floor.outline.map((_, edge) => slabSpans(floor, below, edge));
  const corner = (index: number): P2 => {
    const previous = (index + edges.length - 1) % edges.length;
    const a = edgeNormal(floor.outline, previous), b = edgeNormal(floor.outline, index);
    const da = edges[previous]!.at(-1)!.far, db = edges[index]![0]!.near;
    const determinant = a[0] * b[1] - a[1] * b[0], point = floor.outline[index]!;
    if (Math.abs(determinant) < 1e-8) return [point[0] - b[0] * db, point[1] - b[1] * db];
    return [point[0] + (-da * b[1] + a[1] * db) / determinant, point[1] + (-a[0] * db + da * b[0]) / determinant];
  };
  const ring: P2[] = [];
  for (let edge = 0; edge < edges.length; edge++) {
    const origin = floor.outline[edge]!, dir = edgeDir(floor.outline, edge), normal = edgeNormal(floor.outline, edge), length = edgeLength(floor.outline, edge);
    for (const span of edges[edge]!) for (const [u, depth] of [[span.from, span.near], [span.to, span.far]] as const) {
      const point: P2 = u < 1e-8 ? corner(edge) : length - u < 1e-8 ? corner((edge + 1) % edges.length)
        : [origin[0] + dir[0] * u - normal[0] * depth, origin[1] + dir[1] * u - normal[1] * depth];
      const previous = ring.at(-1);
      if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-8) ring.push(point);
    }
  }
  if (Math.hypot(ring[0]![0] - ring.at(-1)![0], ring[0]![1] - ring.at(-1)![1]) < 1e-8) ring.pop();
  return ring;
}
