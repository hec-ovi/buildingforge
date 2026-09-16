import type { P2 } from '../core/polygon.ts';
import type { WallPiece } from './wallcut.ts';

interface EdgeRun { from: number; to: number; direction: number }
interface EdgeLine { axis: P2; normal: P2; distance: number; runs: EdgeRun[] }

/** Cancel shared strip edges, retaining only the outer contour and opening contours. */
export function wallBoundary(pieces: WallPiece[]): [P2, P2][] {
  const lines = new Map<string, EdgeLine>();
  const epsilon = 1e-8;
  for (const piece of pieces) {
    const points = [piece.bl, piece.br, piece.tr, piece.tl];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (length < epsilon) continue;
      const direction = dx < -epsilon || Math.abs(dx) < epsilon && dy < 0 ? -1 : 1;
      const axis: P2 = [direction * dx / length, direction * dy / length];
      const normal: P2 = [-axis[1], axis[0]];
      const distance = a[0] * normal[0] + a[1] * normal[1];
      const key = [axis[0], axis[1], distance].map(value => Math.round(value / epsilon)).join(':');
      const line = lines.get(key) ?? { axis, normal, distance, runs: [] };
      const at = (p: P2) => p[0] * line.axis[0] + p[1] * line.axis[1];
      line.runs.push({ from: Math.min(at(a), at(b)), to: Math.max(at(a), at(b)), direction });
      lines.set(key, line);
    }
  }
  const result: [P2, P2][] = [];
  for (const line of lines.values()) {
    const points = [...new Set(line.runs.flatMap(run => [run.from, run.to]))].sort((a, b) => a - b);
    const point = (at: number): P2 => [line.axis[0] * at + line.normal[0] * line.distance,
      line.axis[1] * at + line.normal[1] * line.distance];
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]!, to = points[i]!;
      if (to - from < epsilon) continue;
      const middle = (from + to) / 2;
      const direction = line.runs.reduce((sum, run) => sum + (middle > run.from && middle < run.to ? run.direction : 0), 0);
      if (direction !== 0) result.push(direction > 0 ? [point(from), point(to)] : [point(to), point(from)]);
    }
  }
  return result;
}
