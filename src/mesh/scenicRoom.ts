import type { PartSink, V3 } from './primitives.ts';
import { scenicFixtures, type RoomFrame, type ScenicEmitter } from './scenicFixtures.ts';
import { materialSlot } from '../materials/slot.ts';

export const SCENIC_DEPTH = 1;
export interface ScenicRoomInput {
  width: number; bottom: number; top: number; front: number; depth: number;
  lights: 'strips' | 'spots'; state: 'lit' | 'dim' | 'dark'; warm: boolean;
  /** A simplified shell publishes the emitters without drawing the fixtures. */
  fixtures?: boolean;
}

/** A rectangular shallow box with one rear image and ceiling fixtures. */
export function scenicRoom(sink: PartSink, frame: RoomFrame, room: ScenicRoomInput): ScenicEmitter[] {
  const { width, bottom, top, front, depth, state } = room;
  const back = front - depth;
  const point = (u: number, y: number, z: number) => frame.point(u, y, z);
  const key = (kind: string) => materialSlot(`cyberpunk/paired-${kind}${kind.startsWith('room-') && state !== 'lit' ? '-' + state : ''}/mid`, 'surface');
  const uv: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const normal: V3 = [frame.normal[0], 0, frame.normal[1]];
  const quad = (material: string, a: V3, b: V3, c: V3, d: V3, n: V3) => sink.quadFacing(material, a, b, c, d, n, uv);
  quad(key('room-floor'), point(0, bottom, back), point(width, bottom, back), point(width, bottom, front), point(0, bottom, front), [0, 1, 0]);
  quad(key('room-ceiling'), point(0, top, back), point(width, top, back), point(width, top, front), point(0, top, front), [0, -1, 0]);
  quad(key('room-wall'), point(0, bottom, front), point(0, bottom, back), point(0, top, back), point(0, top, front), [frame.dir[0], 0, frame.dir[1]]);
  quad(key('room-wall'), point(width, bottom, front), point(width, bottom, back), point(width, top, back), point(width, top, front), [-frame.dir[0], 0, -frame.dir[1]]);
  const aspect = width / (top - bottom), cropU = Math.min(1, aspect / 2), cropV = Math.min(1, 2 / aspect);
  const imageUv: [number, number][] = [[(1 - cropU) / 2, (1 + cropV) / 2], [(1 + cropU) / 2, (1 + cropV) / 2],
    [(1 + cropU) / 2, (1 - cropV) / 2], [(1 - cropU) / 2, (1 - cropV) / 2]];
  sink.quadFacing(materialSlot(`cyberpunk/paired-room-${state}/mid`, 'lounge'),
    point(0, bottom, back), point(width, bottom, back), point(width, top, back), point(0, top, back), normal, imageUv);
  return scenicFixtures(room.fixtures === false ? undefined : sink, frame, width, top, front, back, room.lights,
    key(state === 'dark' ? 'light-off' : room.warm ? 'light-warm' : 'light-cool'), 'cyberpunk/paired-frame-metal/mid#surface',
    state === 'dark' ? 0 : state === 'dim' ? 0.15 : 1, room.warm);
}
