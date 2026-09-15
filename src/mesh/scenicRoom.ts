import type { PartSink, V3 } from './primitives.ts';
import { scenicFixtures, type RoomFrame, type ScenicEmitter } from './scenicFixtures.ts';
import { materialSlot } from '../materials/slot.ts';

export interface ScenicRoomInput {
  width: number; bottom: number; top: number; front: number; depth: number;
  lights: 'strips' | 'spots'; state: 'lit' | 'dim' | 'dark'; warm: boolean;
  leftInset?: number; rightInset?: number;
}

/** Five receiving faces retain the plate's physical aspect from oblique views. */
export function scenicRoom(sink: PartSink, frame: RoomFrame, room: ScenicRoomInput): ScenicEmitter[] {
  const { width, bottom, top, front, depth, state } = room;
  const back = front - depth;
  const left = Math.max(0, room.leftInset ?? 0), right = Math.max(0, room.rightInset ?? 0);
  const minimumBackWidth = Math.min(width, Math.max(0.3, width * 0.2));
  const scale = Math.min(1, (width - minimumBackWidth) / Math.max(0.001, left + right));
  const leftBack = left * scale, rightBack = width - right * scale;
  const backWidth = rightBack - leftBack;
  const point = (u: number, y: number, z: number) => frame.point(u, y, z);
  const key = (kind: string) => materialSlot(`cyberpunk/paired-${kind}${kind.startsWith('room-') && state !== 'lit' ? '-' + state : ''}/mid`, 'surface');
  const uv: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const normal: V3 = [frame.normal[0], 0, frame.normal[1]];
  const quad = (material: string, a: V3, b: V3, c: V3, d: V3, n: V3) => sink.quadFacing(material, a, b, c, d, n, uv);
  quad(key('room-floor'), point(leftBack, bottom, back), point(rightBack, bottom, back), point(width, bottom, front), point(0, bottom, front), [0, 1, 0]);
  quad(key('room-ceiling'), point(leftBack, top, back), point(rightBack, top, back), point(width, top, front), point(0, top, front), [0, -1, 0]);
  quad(key('room-wall'), point(0, bottom, front), point(leftBack, bottom, back), point(leftBack, top, back), point(0, top, front), [frame.dir[0], 0, frame.dir[1]]);
  quad(key('room-wall'), point(width, bottom, front), point(rightBack, bottom, back), point(rightBack, top, back), point(width, top, front), [-frame.dir[0], 0, -frame.dir[1]]);
  quad(key('room-wall'), point(leftBack, bottom, back), point(rightBack, bottom, back), point(rightBack, top, back), point(leftBack, top, back), normal);
  const plateWidth = Math.min(backWidth, (top - bottom) * 2);
  const plateHeight = plateWidth / 2;
  const plateLeft = leftBack + (backWidth - plateWidth) / 2;
  quad(materialSlot(`cyberpunk/paired-room-${state}/mid`, 'lounge'), point(plateLeft, bottom, back + 0.004),
    point(plateLeft + plateWidth, bottom, back + 0.004), point(plateLeft + plateWidth, bottom + plateHeight, back + 0.004),
    point(plateLeft, bottom + plateHeight, back + 0.004), normal);
  const fixtureFrame: RoomFrame = { ...frame, point: (u, y, z) => frame.point(u + leftBack, y, z) };
  return scenicFixtures(sink, fixtureFrame, backWidth, top, front, back, room.lights,
    key(state === 'dark' ? 'light-off' : room.warm ? 'light-warm' : 'light-cool'), 'cyberpunk/paired-frame-metal/mid#surface', state === 'dark' ? 0 : state === 'dim' ? 0.15 : 1, room.warm);
}
