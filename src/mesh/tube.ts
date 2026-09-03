import { add, cross, dot, norm, scale, sub, type PartSink, type V3 } from './primitives.ts';

const OCTAGON: [number, number][] = [
  [1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2],
];

/** Eight-sided tube with U around its real circumference and V along its real length. */
export function tubeSegment(
  sink: PartSink, material: string, start: V3, end: V3, radius: number,
): void {
  const axisVector = sub(end, start);
  const length = Math.sqrt(dot(axisVector, axisVector));
  if (length < 1e-6) return;
  const axis = norm(axisVector);
  const reference: V3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const side = norm(cross(axis, reference));
  const up = norm(cross(side, axis));
  const ring = (center: V3, point: [number, number]): V3 => add(center,
    add(scale(side, radius * point[0]), scale(up, radius * point[1])));
  const circumference = 2 * Math.PI * radius;
  for (let i = 0; i < OCTAGON.length; i++) {
    const j = (i + 1) % OCTAGON.length;
    const a = ring(start, OCTAGON[i]!);
    const b = ring(start, OCTAGON[j]!);
    const c = ring(end, OCTAGON[j]!);
    const d = ring(end, OCTAGON[i]!);
    const outward = norm(add(sub(a, start), sub(b, start)));
    sink.quadFacing(material, a, b, c, d, outward, [
      [circumference * i / 8, length], [circumference * (i + 1) / 8, length],
      [circumference * (i + 1) / 8, 0], [circumference * i / 8, 0],
    ]);
  }
}
