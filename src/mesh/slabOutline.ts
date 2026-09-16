import { edgeDir, edgeLength, edgeNormal, type P2 } from '../core/polygon.ts';
import { openingEnvelope } from '../layout/openingEnvelope.ts';
import type { FloorLayout } from '../layout/model.ts';

interface Span { from: number; to: number; depth: number }

/** Floor edges follow inset facade fields and keep the approaches to traversable openings. */
export function slabOutline(floor: FloorLayout): P2[] {
  const sections = floor.assembly?.sections ?? [];
  if (!sections.some(s => (s.border.surfaceDepth ?? 0) > 0)) return floor.outline;
  const edges = floor.outline.map((_, edge): Span[] => {
    const length = edgeLength(floor.outline, edge);
    const fields = sections.filter(s => s.edge === edge && !s.spans);
    const passages = floor.openings.filter(o => o.edge === edge && o.kind !== 'window' && o.sill <= 0.05).map(openingEnvelope);
    const cuts = [...new Set([0, length, ...fields.flatMap(s => [s.offset, s.offset + s.width]), ...passages.flatMap(p => [Math.max(0, p.offset - 0.18), Math.min(length, p.offset + p.width + 0.18)])])].sort((a, b) => a - b);
    const result: Span[] = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i]!, to = cuts[i + 1]!, middle = (from + to) / 2;
      if (to - from < 1e-8) continue;
      const field = fields.find(s => middle >= s.offset && middle <= s.offset + s.width);
      const depth = passages.some(p => middle >= p.offset - 0.18 && middle <= p.offset + p.width + 0.18) ? 0 : field?.border.surfaceDepth ?? 0;
      const previous = result.at(-1);
      if (previous && Math.abs(previous.depth - depth) < 1e-8) previous.to = to;
      else result.push({ from, to, depth });
    }
    return result;
  });
  const corner = (index: number): P2 => {
    const previous = (index + edges.length - 1) % edges.length;
    const a = edgeNormal(floor.outline, previous), b = edgeNormal(floor.outline, index);
    const da = edges[previous]!.at(-1)!.depth, db = edges[index]![0]!.depth;
    const determinant = a[0] * b[1] - a[1] * b[0], point = floor.outline[index]!;
    if (Math.abs(determinant) < 1e-8) return [point[0] - b[0] * db, point[1] - b[1] * db];
    return [point[0] + (-da * b[1] + a[1] * db) / determinant, point[1] + (-a[0] * db + da * b[0]) / determinant];
  };
  const ring: P2[] = [];
  for (let edge = 0; edge < edges.length; edge++) {
    const origin = floor.outline[edge]!, dir = edgeDir(floor.outline, edge), normal = edgeNormal(floor.outline, edge), length = edgeLength(floor.outline, edge);
    for (const span of edges[edge]!) for (const u of [span.from, span.to]) {
      const point: P2 = u < 1e-8 ? corner(edge) : length - u < 1e-8 ? corner((edge + 1) % edges.length)
        : [origin[0] + dir[0] * u - normal[0] * span.depth, origin[1] + dir[1] * u - normal[1] * span.depth];
      const previous = ring.at(-1);
      if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-8) ring.push(point);
    }
  }
  if (Math.hypot(ring[0]![0] - ring.at(-1)![0], ring[0]![1] - ring.at(-1)![1]) < 1e-8) ring.pop();
  return ring;
}
