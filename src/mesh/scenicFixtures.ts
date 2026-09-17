import type { PartSink, V3 } from './primitives.ts';

export interface RoomFrame {
  point(u: number, y: number, depth: number): V3;
  dir: [number, number];
  normal: [number, number];
}

export interface ScenicEmitter { position: V3; color: string; lumens: number; range: number }

/**
 * Ceiling fixtures, oriented across room width and into room depth. A fixture is
 * seen from the street through its glazing, so it is the lit face plus the
 * housing collar around it, one downward quad each.
 */
export function scenicFixtures(sink: PartSink, frame: RoomFrame, width: number, top: number, front: number, back: number,
  layout: 'strips' | 'spots', light: string, housing: string, level: number, warm: boolean): ScenicEmitter[] {
  const emitters: ScenicEmitter[] = [];
  const down: V3 = [0, -1, 0];
  const face = (material: string, u: number, z: number, w: number, d: number, y: number) => {
    const uv: [number, number][] = [[0, 0], [w, 0], [w, d], [0, d]];
    sink.quadFacing(material, frame.point(u - w / 2, y, z - d / 2), frame.point(u + w / 2, y, z - d / 2),
      frame.point(u + w / 2, y, z + d / 2), frame.point(u - w / 2, y, z + d / 2), down, uv);
  };
  const fixture = (u: number, z: number, w: number, d: number) => {
    face(housing, u, z, w + 0.036, d + 0.036, top - 0.11);
    face(light, u, z, w, d, top - 0.121);
    emitters.push({ position: frame.point(u, top - 0.13, z), color: warm ? '#f0ffc6' : '#99fff0',
      lumens: (layout === 'strips' ? 2400 : 1200) * level, range: 12 });
  };
  if (layout === 'strips') {
    const depth = Math.min(2.6, front - back - 0.6);
    for (const fraction of width < 1.2 ? [0.5] : width < 3 ? [0.25, 0.75] : [0.2, 0.3, 0.7, 0.8]) fixture(width * fraction, (front + back) / 2, 0.095, depth);
  } else {
    const columns = Math.max(1, Math.min(4, Math.floor(width / 0.6)));
    for (let column = 0; column < columns; column++) for (let row = 0; row < 2; row++) {
      fixture(width * (column + 0.5) / columns, front + (back - front) * (row + 0.6) / 2.2, 0.12, 0.12);
    }
  }
  return emitters;
}
