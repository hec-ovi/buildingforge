import type { PartSink, V3 } from './primitives.ts';
import { scenicFixtures, type RoomFrame } from './scenicFixtures.ts';
import { scenicCurtain } from './scenicCurtain.ts';
import { materialSlot } from '../materials/slot.ts';

export interface ScenicRoomInput {
  width: number; bottom: number; top: number; front: number; depth: number;
  lights: 'strips' | 'spots'; state: 'lit' | 'dim' | 'dark'; warm: boolean; curtain: number;
  leftInset?: number; rightInset?: number;
}

/** Five receiving faces retain the plate's physical aspect from oblique views. */
export function scenicRoom(sink: PartSink, frame: RoomFrame, room: ScenicRoomInput): void {
  const { width, bottom, top, front, depth, state } = room;
  const back = front - depth;
  const leftBack = room.leftInset ?? 0, rightBack = width - (room.rightInset ?? 0);
  const backWidth = rightBack - leftBack;
  const point = (u: number, y: number, z: number) => frame.point(u, y, z);
  const key = (kind: string) => materialSlot(`cyberpunk/paired-${kind}/mid`, 'surface');
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
  const left = leftBack + (backWidth - plateWidth) / 2;
  quad(materialSlot(`cyberpunk/paired-room-${state}/mid`, 'lounge'), point(left, bottom, back + 0.004),
    point(left + plateWidth, bottom, back + 0.004), point(left + plateWidth, bottom + plateHeight, back + 0.004),
    point(left, bottom + plateHeight, back + 0.004), normal);
  const fixtureFrame: RoomFrame = { ...frame, point: (u, y, z) => frame.point(u + leftBack, y, z) };
  scenicFixtures(sink, fixtureFrame, backWidth, top, front, back, room.lights,
    key(state === 'dark' ? 'light-off' : room.warm ? 'light-warm' : 'light-cool'), key('frame'));
  if (room.curtain > 0) scenicCurtain(sink, frame, width, bottom, top, front - 0.48, room.curtain, 'cyberpunk/curtain/mid#shade');
}
