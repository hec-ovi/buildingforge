import { edgeNormal, type P2 } from '../core/polygon.ts';
import { capDown, capFrame, capUp } from './caps.ts';
import type { FrameBasis } from './frameRing.ts';
import type { PartSink } from './primitives.ts';

/** Closed concrete member with broad face and two bevelled front arrises. */
export function meshStructuralPier(
  sink: PartSink, frame: FrameBasis, center: number, width: number,
  base: number, top: number, depth: number, material: string,
): void {
  const half = width / 2;
  const bevel = Math.min(depth * 0.45, width * 0.08);
  const section: P2[] = [
    [-half, 0], [-half, depth - bevel], [-half + bevel, depth],
    [half - bevel, depth], [half, depth - bevel], [half, 0],
  ];
  const ring: P2[] = section.map(([u, d]) => [
    frame.v[0] + frame.dir[0] * (center + u) + frame.n[0] * d,
    frame.v[1] + frame.dir[1] * (center + u) + frame.n[1] * d,
  ]);
  const caps = capFrame(ring);
  capUp(sink, material, caps, ring, top);
  capDown(sink, material, caps, ring, base);
  for (let edge = 0; edge < ring.length; edge++) {
    const a = ring[edge]!, b = ring[(edge + 1) % ring.length]!;
    const normal = edgeNormal(ring, edge);
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    sink.quadFacing(material, [a[0], base, a[1]], [b[0], base, b[1]],
      [b[0], top, b[1]], [a[0], top, a[1]], [normal[0], 0, normal[1]],
      [[0, top - base], [span, top - base], [span, 0], [0, 0]]);
  }
}
