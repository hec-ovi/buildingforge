import type { P2 } from '../core/polygon.ts';
import type { DoorAssembly } from '../types.ts';
import type { PartSink, V3 } from './primitives.ts';

/**
 * Front-mounted hardware stays inside the recessed opening and moves with its
 * leaf. A backplate is 10 mm of steel lying flat on the leaf, so it is drawn as
 * its visible face; the rose and the grip keep their depth, which is what reads
 * from a balcony or a doorstep.
 */
export function meshDoorHardware(
  sink: PartSink, frame: { v: P2; dir: P2; n: P2 },
  a: number, b: number, bottom: number, top: number, hinge: number,
  assembly: DoorAssembly, material: string,
): void {
  if (assembly.motion.kind !== 'swing') return;
  const width = b - a;
  const height = top - bottom;
  const fromLeft = hinge === a;
  const u = fromLeft ? b - Math.min(0.075, width * 0.15) : a + Math.min(0.075, width * 0.15);
  const y = bottom + Math.min(1.05, height * 0.5);
  const front = -assembly.recessDepth;
  const at = (x: number, cy: number, z: number): V3 => [
    frame.v[0] + frame.dir[0] * x + frame.n[0] * z, cy,
    frame.v[1] + frame.dir[1] * x + frame.n[1] * z,
  ];
  const box = (x: number, cy: number, z: number, w: number, h: number, d: number) => {
    sink.box(material, at(x, cy, z),
      [frame.dir[0] * w / 2, 0, frame.dir[1] * w / 2], [0, h / 2, 0],
      [frame.n[0] * d / 2, 0, frame.n[1] * d / 2], 'along');
  };
  const plate = (x: number, cy: number, z: number, w: number, h: number) => {
    const outward: V3 = [frame.n[0], 0, frame.n[1]];
    sink.quadFacing(material, at(x - w / 2, cy - h / 2, z), at(x + w / 2, cy - h / 2, z),
      at(x + w / 2, cy + h / 2, z), at(x - w / 2, cy + h / 2, z), outward, [[0, 0], [w, 0], [w, h], [0, h]]);
  };
  if (assembly.set === 'plain' || assembly.set === 'industrial-ribbed') {
    plate(u, y, front + 0.01, 0.045, 0.16);
    box(u, y + 0.035, front + 0.025, 0.024, 0.024, 0.03);
    const length = Math.min(0.12, width * 0.3);
    box(u + (fromLeft ? -1 : 1) * (length - 0.024) / 2,
      y + 0.035, front + 0.045, length, 0.024, 0.02);
    return;
  }
  const length = Math.min(0.55, height * 0.25);
  for (const end of [-1, 1]) {
    const cy = y + end * (length / 2 - 0.025);
    plate(u, cy, front + 0.008, 0.045, 0.05);
    box(u, cy, front + 0.026, 0.025, 0.025, 0.036);
  }
  box(u, y, front + 0.055, 0.028, length, 0.022);
}
