import type { P3, Placement } from './types.ts';

export type PieceFrame = Pick<Placement, 'position' | 'rotationY'>;

export function spin(p: P3, rotationY: number): P3 {
  const c = Math.cos(rotationY), s = Math.sin(rotationY);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

export function point(p: P3, at: PieceFrame): P3 {
  const [x, y, z] = spin(p, at.rotationY);
  return [x + at.position[0], y + at.position[1], z + at.position[2]];
}

export function world(record: { position: P3; facing: P3 }, at: PieceFrame): { position: P3; facing: P3 } {
  return { position: point(record.position, at), facing: spin(record.facing, at.rotationY) };
}
