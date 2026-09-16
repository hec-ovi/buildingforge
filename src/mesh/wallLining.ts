import { wallBoundary } from './wallBoundary.ts';
import type { P2 } from '../core/polygon.ts';
import { WallField } from './wallField.ts';
import type { PartSink, V3 } from './primitives.ts';
import type { WallPiece } from './wallcut.ts';

/** Minimum finished wall body; opening housings can require a deeper lining. */
export const WALL_THICKNESS = 0.12;

/** Inward surfaces and returns share a miter at each footprint vertex. */
export function meshWallLining(
  sink: PartSink, outline: P2[], edge: number, pieces: WallPiece[],
  frontDepth: number, material: string, thickness = WALL_THICKNESS, returnMaterial = material,
  returnProfile: (a: P2, b: P2) => { front: number; depth: number } | undefined = () => undefined,
): void {
  const a = outline[edge]!, b = outline[(edge + 1) % outline.length]!;
  const field = new WallField(outline, edge);
  const dir = field.dir, n = field.normal;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const piece of pieces) {
    const points = [piece.bl, piece.br, piece.tr, piece.tl];
    const uv = points.map(([u, y]): P2 => [u, -y]);
    field.face(sink, material, points.map(([u, y]): V3 => [u, y, -thickness]), [-n[0], 0, -n[1]], uv);
  }
  for (const [p, q] of wallBoundary(pieces)) {
    // Neighbouring walls join at their shared miter; no internal corner cap.
    if (Math.abs(p[0] - q[0]) < 1e-8 && (Math.abs(p[0]) < 1e-8 || Math.abs(p[0] - length) < 1e-8)) continue;
    const du = q[0] - p[0], dy = q[1] - p[1];
    const profile = returnProfile(p, q);
    const depth = profile?.depth ?? thickness, front = profile?.front ?? frontDepth;
    if (depth + front <= 1e-8) continue;
    const outer = ([u, y]: P2): V3 => [u, y, front];
    const back = ([u, y]: P2): V3 => [u, y, -depth];
    const outward: V3 = [dir[0] * dy, -du, dir[1] * dy];
    field.face(sink, returnMaterial, [outer(p), outer(q), back(q), back(p)], outward,
      [[0, 0], [Math.hypot(du, dy), 0], [Math.hypot(du, dy), depth + front], [0, depth + front]]);
  }
}
