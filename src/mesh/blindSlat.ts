import type { PartSink, V3 } from './primitives.ts';
import { cutWall, rectHole } from './wallcut.ts';

export interface BlindFrame {
  point(u: number, y: number, depth: number): V3;
  dir: [number, number]; normal: [number, number];
}

/** A folded metal blade has a perforated inclined web and closed edge returns. */
export function blindSlat(sink: PartSink, frame: BlindFrame, width: number, top: number, front: number,
  supports: number[], material: string): void {
  const height = 0.095, thickness = 0.004;
  const holes = supports.map(u => rectHole(u - 0.038, 0.033, 0.076, 0.026));
  const outward: V3 = [frame.normal[0], -0.5, frame.normal[1]];
  const point = (u: number, v: number, inset: number): V3 =>
    frame.point(u, top - height + v, front + (v - height) * 0.5 + inset);
  const uv: [number, number][] = [[0, 0], [width, 0], [width, height], [0, height]];
  for (const piece of cutWall(width, 0, height, holes)) {
    const ring = [piece.bl, piece.br, piece.tr, piece.tl];
    const near = ring.map(([u, v]) => point(u, v, 0));
    const far = ring.map(([u, v]) => point(u, v, -thickness));
    sink.quadFacing(material, near[0]!, near[1]!, near[2]!, near[3]!, outward, uv);
    sink.quadFacing(material, far[0]!, far[1]!, far[2]!, far[3]!, outward.map(n => -n) as V3, uv);
  }
  // Close only the outside perimeter and actual hole walls, without internal partitions.
  const boundaries: [number, number][][] = [[[0, 0], [width, 0], [width, height], [0, height]],
    ...supports.map(u => [[u - 0.038, 0.033], [u - 0.038, 0.059], [u + 0.038, 0.059], [u + 0.038, 0.033]] as [number, number][])];
  for (const ring of boundaries) for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const du = b[0] - a[0], dv = b[1] - a[1];
    const normal: V3 = [frame.dir[0] * dv, -du, frame.dir[1] * dv];
    sink.quadFacing(material, point(a[0], a[1], 0), point(a[0], a[1], -thickness),
      point(b[0], b[1], -thickness), point(b[0], b[1], 0), normal, uv);
  }
  const along: V3 = [frame.dir[0] * width / 2, 0, frame.dir[1] * width / 2];
  const depth = (v: number): V3 => [frame.normal[0] * v, 0, frame.normal[1] * v];
  // Two folded lips produce a stepped silhouette at every blade edge.
  sink.box(material, frame.point(width / 2, top + 0.008, front - 0.011), along, [0, 0.01, 0], depth(0.015), 'along');
  sink.box(material, frame.point(width / 2, top - height - 0.007, front - height * 0.5 + 0.009), along,
    [0, 0.008, 0], depth(0.013), 'along');
}
