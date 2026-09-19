import type { P2 } from '../core/polygon.ts';
import { BLIND_MATERIAL } from './profiledBlind.ts';
import type { PartSink, V3 } from './primitives.ts';

interface Frame { v: P2; dir: P2; n: P2 }

/**
 * A venetian covering: head cassette, one fitted panel over the closed travel
 * and the bottom rail that ends it. The slat pitch is in the blind map, so the
 * covering costs four vertices instead of one box per blade.
 */
export function meshVenetianBlind(
  sink: PartSink, frame: Frame, u0: number, u1: number, y0: number, y1: number,
  front: number, closurePercent: number, frameMaterial: string,
): void {
  const width = u1 - u0, height = y1 - y0;
  if (width < 0.08 || height < 0.08) return;
  const point = (u: number, y: number, z: number): V3 => [
    frame.v[0] + frame.dir[0] * u + frame.n[0] * z, y,
    frame.v[1] + frame.dir[1] * u + frame.n[1] * z,
  ];
  const along = (length: number): V3 => [frame.dir[0] * length, 0, frame.dir[1] * length];
  const depth = (length: number): V3 => [frame.n[0] * length, 0, frame.n[1] * length];
  const box = (u: number, y: number, w: number, h: number, d: number, z: number) =>
    sink.box(frameMaterial, point(u, y, z), along(w / 2), [0, h / 2, 0], depth(d / 2), 'along');
  const center = (u0 + u1) / 2;
  const cassette = Math.min(0.06, height * 0.08);
  box(center, y1 - cassette / 2, width, cassette, 0.032, front - 0.016);
  if (closurePercent <= 0) return;

  const bottom = y1 - height * closurePercent / 100;
  const covered = y1 - bottom;
  const z = front - 0.025;
  sink.quadFacing(BLIND_MATERIAL, point(u0, bottom, z), point(u1, bottom, z), point(u1, y1, z), point(u0, y1, z),
    [frame.n[0], 0, frame.n[1]], [[0, 0], [width, 0], [width, covered], [0, covered]]);
  const rail = Math.min(0.024, covered);
  box(center, bottom + rail / 2, width, rail, 0.032, front - 0.024);
}
