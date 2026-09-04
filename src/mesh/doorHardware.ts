import type { P2 } from '../core/polygon.ts';
import type { DoorAssembly } from '../types.ts';
import type { PartSink } from './primitives.ts';

/** Front-mounted hardware stays inside the recessed opening and moves with its leaf. */
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
  const box = (x: number, cy: number, z: number, w: number, h: number, d: number) => {
    sink.box(material,
      [frame.v[0] + frame.dir[0] * x + frame.n[0] * z, cy,
        frame.v[1] + frame.dir[1] * x + frame.n[1] * z],
      [frame.dir[0] * w / 2, 0, frame.dir[1] * w / 2], [0, h / 2, 0],
      [frame.n[0] * d / 2, 0, frame.n[1] * d / 2], 'along');
  };
  if (assembly.set === 'plain' || assembly.set === 'industrial-ribbed') {
    box(u, y, front + 0.005, 0.045, 0.16, 0.01);
    box(u, y + 0.035, front + 0.025, 0.024, 0.024, 0.03);
    const length = Math.min(0.12, width * 0.3);
    box(u + (fromLeft ? -1 : 1) * (length - 0.024) / 2,
      y + 0.035, front + 0.045, length, 0.024, 0.02);
    return;
  }
  const length = Math.min(0.55, height * 0.25);
  for (const end of [-1, 1]) {
    const cy = y + end * (length / 2 - 0.025);
    box(u, cy, front + 0.004, 0.045, 0.05, 0.008);
    box(u, cy, front + 0.026, 0.025, 0.025, 0.036);
  }
  box(u, y, front + 0.055, 0.028, length, 0.022);
}
