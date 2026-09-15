import type { PartSink, V3 } from './primitives.ts';

export interface RoomFrame {
  point(u: number, y: number, depth: number): V3;
  dir: [number, number];
  normal: [number, number];
}

/** Housed ceiling fixtures, oriented across room width and into room depth. */
export function scenicFixtures(sink: PartSink, frame: RoomFrame, width: number, top: number, front: number, back: number,
  layout: 'strips' | 'spots', light: string, housing: string): void {
  const along = (half: number): V3 => [frame.dir[0] * half, 0, frame.dir[1] * half];
  const inward = (half: number): V3 => [frame.normal[0] * half, 0, frame.normal[1] * half];
  const fixture = (u: number, z: number, w: number, d: number) => {
    sink.box(housing, frame.point(u, top - 0.055, z), along(w / 2 + 0.018), [0, 0.055, 0], inward(d / 2 + 0.018));
    sink.box(light, frame.point(u, top - 0.113, z), along(w / 2), [0, 0.008, 0], inward(d / 2));
  };
  if (layout === 'strips') {
    const depth = Math.min(2.6, front - back - 0.6);
    for (const fraction of [0.2, 0.3, 0.7, 0.8]) fixture(width * fraction, (front + back) / 2, 0.095, depth);
  } else {
    for (let column = 0; column < 4; column++) for (let row = 0; row < 2; row++) {
      fixture(width * (column + 0.5) / 4, front + (back - front) * (row + 0.6) / 2.2, 0.12, 0.12);
    }
  }
}
