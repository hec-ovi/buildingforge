import { edgeLength } from '../core/polygon.ts';
import { openingEnvelope } from '../layout/openingEnvelope.ts';
import type { FloorLayout } from '../layout/model.ts';
import type { Section } from '../sections/types.ts';

export interface SlabSpan { from: number; to: number; near: number; far: number }

function depth(field: Section | undefined, u: number): number {
  if (!field?.border.surfaceProfile) return field?.border.surfaceDepth ?? 0;
  const profile = field.border.surfaceProfile, offset = u - field.offset;
  if (offset <= profile[0]!.offset) return profile[0]!.depth;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1]!, b = profile[i]!;
    if (offset <= b.offset) return a.depth + (b.depth - a.depth) * (offset - a.offset) / (b.offset - a.offset);
  }
  return profile.at(-1)!.depth;
}

/** The slab closes both adjacent wall profiles and reaches each current walking opening. */
export function slabSpans(floor: FloorLayout, below: FloorLayout | undefined, edge: number): SlabSpan[] {
  const length = edgeLength(floor.outline, edge);
  const fields = (floor.assembly?.sections ?? []).filter(s => s.edge === edge && !s.spans);
  const previous = below && below.outline.length === floor.outline.length && below.outline.every((p, i) =>
    Math.hypot(p[0] - floor.outline[i]![0], p[1] - floor.outline[i]![1]) < 1e-8)
    ? (below.assembly?.sections ?? []).filter(s => s.edge === edge && !s.spans) : undefined;
  const passages = floor.openings.filter(o => o.edge === edge && o.kind !== 'window' && o.sill <= 0.05).map(openingEnvelope);
  const boundaries = (list: Section[]) => list.flatMap(s => [s.offset, s.offset + s.width, ...(s.border.surfaceProfile ?? []).map(p => s.offset + p.offset)]);
  const cuts = [...new Set([0, length, ...boundaries(fields), ...boundaries(previous ?? []),
    ...passages.flatMap(p => [Math.max(0, p.offset - 0.18), Math.min(length, p.offset + p.width + 0.18)])])].sort((a, b) => a - b);
  const result: SlabSpan[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = cuts[i]!, to = cuts[i + 1]!, middle = (from + to) / 2;
    if (to - from < 1e-8) continue;
    const current = fields.find(s => middle >= s.offset && middle <= s.offset + s.width);
    const lower = previous?.find(s => middle >= s.offset && middle <= s.offset + s.width);
    const walking = passages.some(p => middle >= p.offset - 0.18 && middle <= p.offset + p.width + 0.18);
    const at = (u: number) => walking ? 0 : Math.min(depth(current, u), previous ? depth(lower, u) : Infinity);
    const difference0 = depth(current, from) - depth(lower, from), difference1 = depth(current, to) - depth(lower, to);
    const points = previous && difference0 * difference1 < 0 ? [from, from + (to - from) * difference0 / (difference0 - difference1), to] : [from, to];
    for (let j = 0; j + 1 < points.length; j++) result.push({ from: points[j]!, to: points[j + 1]!, near: at(points[j]!), far: at(points[j + 1]!) });
  }
  return result;
}
