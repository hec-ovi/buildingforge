import type { PartSink, V3 } from './primitives.ts';

export const BLIND_PITCH = 0.14;
export const BLIND_MATERIAL = 'cyberpunk/paired-blind/mid#blades';

export interface BlindFrame {
  point(u: number, y: number, depth: number): V3;
  dir: [number, number]; normal: [number, number];
}

/**
 * A covered window carries its blind as fitted panels: the head rail, the
 * raised stack, the covered field and the bottom rail, one quad each. The blade
 * pitch lives in the material map, so a covering costs sixteen vertices where a
 * slat stack charged several thousand.
 */
export class ProfiledBlind {
  build(sink: PartSink, frame: BlindFrame, width: number, bottom: number, top: number, front: number, closure: number): void {
    const railMaterial = 'cyberpunk/paired-frame-metal/mid#surface';
    // Blade travel stays on the same pitch the head rail was drawn for, so a
    // given seed covers exactly the height it covered as real slats.
    const available = top - bottom - 0.20;
    const count = Math.max(0, Math.floor(available * closure / 100 / BLIND_PITCH));
    const start = top - 0.14;
    const end = start - count * BLIND_PITCH;
    this.panel(sink, frame, railMaterial, width, top - 0.09, top, front - 0.035);
    // Raised blades rest in one compact stack under the head rail.
    const stacked = Math.min(5, Math.round((100 - closure) / 20));
    if (stacked > 0) this.panel(sink, frame, BLIND_MATERIAL, width, top - 0.135, top - 0.087, front - 0.025);
    if (count === 0) return;
    this.panel(sink, frame, BLIND_MATERIAL, width, end, start, front - 0.03);
    this.panel(sink, frame, railMaterial, width, end, end + 0.035, front - 0.025);
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
