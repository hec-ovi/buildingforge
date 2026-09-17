import type { PartSink, V3 } from './primitives.ts';

export const BLIND_PITCH = 0.14;

export interface BlindFrame {
  point(u: number, y: number, depth: number): V3;
  dir: [number, number]; normal: [number, number];
}

/**
 * A covered window carries its blind as one fitted panel between head and
 * bottom rail. The blade pitch lives in the material map, so a shell pays four
 * vertices for a covering the old slat stack charged several thousand for.
 */
export class ProfiledBlind {
  build(sink: PartSink, frame: BlindFrame, width: number, bottom: number, top: number, front: number, closure: number): void {
    const material = 'cyberpunk/paired-blind/mid#surface';
    const railMaterial = 'cyberpunk/paired-frame-metal/mid#surface';
    const along = (v: number): V3 => [frame.dir[0] * v, 0, frame.dir[1] * v];
    const depth = (v: number): V3 => [frame.normal[0] * v, 0, frame.normal[1] * v];
    const box = (u: number, y: number, w: number, h: number, d: number, z: number, key: string) =>
      sink.box(key, frame.point(u, y, z), along(w / 2), [0, h / 2, 0], depth(d / 2), 'along');
    // Blade travel stays on the same pitch the head rail was drawn for, so a
    // given seed covers exactly the height it covered as real slats.
    const available = top - bottom - 0.20;
    const count = Math.max(0, Math.floor(available * closure / 100 / BLIND_PITCH));
    const start = top - 0.14;
    const end = start - count * BLIND_PITCH;
    box(width / 2, top - 0.045, width, 0.09, 0.13, front - 0.035, railMaterial);
    // Raised blades rest in one compact stack under the head rail.
    const stacked = Math.min(5, Math.round((100 - closure) / 20));
    if (stacked > 0) box(width / 2, top - 0.111, width, 0.048, 0.085, front - 0.025, material);
    if (count === 0) return;
    this.panel(sink, frame, material, width, end, start, front - 0.03);
    box(width / 2, end + 0.015, width, 0.035, 0.10, front - 0.025, railMaterial);
  }

  /** The covered field: one outward quad, UVs in metres so the map keeps its pitch. */
  private panel(sink: PartSink, frame: BlindFrame, material: string, width: number, y0: number, y1: number, z: number): void {
    const height = y1 - y0;
    const outward: V3 = [frame.normal[0], 0, frame.normal[1]];
    sink.quadFacing(material, frame.point(0, y0, z), frame.point(width, y0, z),
      frame.point(width, y1, z), frame.point(0, y1, z), outward,
      [[0, 0], [width, 0], [width, height], [0, height]]);
  }
}
