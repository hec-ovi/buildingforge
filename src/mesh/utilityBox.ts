import type { FrameBasis } from './frameRing.ts';
import type { PartSink, V3 } from './primitives.ts';
import { tubeSegment } from './tube.ts';

/** A service enclosure with a gasketed lid, hinges, latch and bottom cable glands. */
export function meshUtilityBox(
  sink: PartSink, frame: FrameBasis, u: number, base: number, size: [number, number, number],
  back: number, casing: string, hardware: string,
): void {
  const [width, height, depth] = size;
  const unit = Math.min(width, height, depth);
  const seam = unit * 0.025;
  const lip = unit * 0.06;
  const front = back + depth;
  const center = u + width / 2;
  const at = (x: number, y: number, z: number): V3 => [
    frame.v[0] + frame.dir[0] * x + frame.n[0] * z, y,
    frame.v[1] + frame.dir[1] * x + frame.n[1] * z,
  ];
  const box = (material: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    sink.box(material, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
      [frame.dir[0] * (x1 - x0) / 2, 0, frame.dir[1] * (x1 - x0) / 2],
      [0, (y1 - y0) / 2, 0], [frame.n[0] * (z1 - z0) / 2, 0, frame.n[1] * (z1 - z0) / 2], 'along');

  box(casing, u, u + width, base + lip, base + height, back, front - 3 * seam);
  // The gasket and fitted lid occupy the reserved front depth, with a visible perimeter seam.
  box(hardware, u + lip / 2, u + width - lip / 2, base + 1.5 * lip, base + height - lip / 2,
    front - 3 * seam, front - 2 * seam);
  box(casing, u + lip, u + width - lip, base + 2 * lip, base + height - lip,
    front - 2 * seam, front - seam);
  for (const fraction of [0.28, 0.72]) {
    const y = base + height * fraction;
    box(hardware, u + lip / 2, u + 2 * lip, y - lip, y + lip, front - 2 * seam, front);
  }
  box(hardware, u + width - 2.5 * lip, u + width - 1.5 * lip,
    base + height * 0.45, base + height * 0.55, front - seam, front);
  // Protected pressure-equalization slots sit below the access latch.
  for (let index = 0; index < 3; index++) {
    const y = base + height * (0.24 + index * 0.08);
    box(hardware, center - width * 0.18, center + width * 0.18, y, y + seam,
      front - seam, front - seam / 2);
  }
  for (const fraction of [0.3, 0.7]) {
    const x = u + width * fraction;
    tubeSegment(sink, hardware, at(x, base + seam, back + depth * 0.4),
      at(x, base + lip + seam, back + depth * 0.4), lip * 0.6);
  }
}
