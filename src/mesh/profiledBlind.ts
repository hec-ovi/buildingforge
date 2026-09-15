import type { PartSink, V3 } from './primitives.ts';
import { blindSlat, type BlindFrame } from './blindSlat.ts';

export const BLIND_PITCH = 0.14;

/** Formed louvers with actual apertures, guide links and a compact raised stack. */
export class ProfiledBlind {
  build(sink: PartSink, frame: BlindFrame, width: number, bottom: number, top: number, front: number, closure: number): void {
    const material = 'cyberpunk/paired-blind/mid#surface';
    const railMaterial = 'cyberpunk/paired-frame-metal/mid#surface';
    const along = (v: number): V3 => [frame.dir[0] * v, 0, frame.dir[1] * v];
    const depth = (v: number): V3 => [frame.normal[0] * v, 0, frame.normal[1] * v];
    const box = (u: number, y: number, w: number, h: number, d: number, z: number, key = material) =>
      sink.box(key, frame.point(u, y, z), along(w / 2), [0, h / 2, 0], depth(d / 2), 'along');
    const supports = width > 1.5 ? [width * 0.18, width * 0.5, width * 0.82] : [width * 0.22, width * 0.78];
    const available = top - bottom - 0.20;
    const count = Math.max(0, Math.floor(available * closure / 100 / BLIND_PITCH));
    const start = top - 0.14;
    const end = start - count * BLIND_PITCH;
    box(width / 2, top - 0.045, width, 0.09, 0.13, front - 0.035, railMaterial);
    // Raised slats remain visible as a closely spaced stack below the head rail.
    const stacked = Math.min(5, Math.round((100 - closure) / 20));
    for (let i = 0; i < stacked; i++) box(width / 2, top - 0.095 - i * 0.008, width, 0.006, 0.085, front - 0.025);
    for (let row = 0; row < count; row++) {
      const y = start - row * BLIND_PITCH;
      blindSlat(sink, frame, width, y, front, supports, material);
      for (const u of supports) {
        // Narrow C-shaped clips leave the punched opening visible on both sides.
        box(u, y - 0.048, 0.016, 0.070, 0.012, front - 0.067, railMaterial);
        box(u, y - 0.080, 0.025, 0.009, 0.055, front - 0.040);
        box(u, y - 0.017, 0.025, 0.009, 0.055, front - 0.040);
      }
    }
    if (count) {
      for (const u of supports) box(u, (start + end) / 2, 0.01, start - end, 0.008, front - 0.078, railMaterial);
      box(width / 2, end + 0.015, width, 0.035, 0.10, front - 0.025, railMaterial);
    }
  }
}
