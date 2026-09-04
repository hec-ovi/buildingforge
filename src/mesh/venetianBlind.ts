import type { P2 } from '../core/polygon.ts';
import type { PartSink, V3 } from './primitives.ts';

interface Frame { v: P2; dir: P2; n: P2 }

/** One fitted slat profile, repeated at fixed pitch for every compatible window. */
export function meshVenetianBlind(
  sink: PartSink, frame: Frame, u0: number, u1: number, y0: number, y1: number,
  front: number, closurePercent: number, frameMaterial: string, curtainMaterial: string,
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
  const pitch = 0.065;
  const slatHeight = 0.057;
  // The lowest slat trims to the exact travel; no geometry extends below it.
  for (let top = y1; top > bottom + 1e-8; top -= pitch) {
    const h = Math.min(slatHeight, top - bottom);
    const halfThickness = Math.min(0.001, h / 4);
    const rise = h / 2 - halfThickness * 0.6;
    const reach = rise * 0.75;
    sink.box(curtainMaterial, point(center, top - h / 2, front - 0.025), along(width / 2),
      [frame.n[0] * reach, rise, frame.n[1] * reach],
      [-frame.n[0] * halfThickness * 0.8, halfThickness * 0.6, -frame.n[1] * halfThickness * 0.8]);
  }
  const rail = Math.min(0.024, y1 - bottom);
  box(center, bottom + rail / 2, width, rail, 0.032, front - 0.024);
  // Ladder tapes support the same slat assembly at each window's fitted width.
  const tapes = Math.max(2, Math.ceil(width / 1.2));
  for (let index = 0; index < tapes; index++) {
    const u = u0 + width * (index + 0.5) / tapes;
    box(u, (bottom + y1) / 2, 0.009, y1 - bottom, 0.004, front - 0.05);
  }
}
