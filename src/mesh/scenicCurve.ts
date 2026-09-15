import { sectionSpans, type Section } from '../sections/index.ts';
import type { FloorLayout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import type { PartSink, V3 } from './primitives.ts';
import { FacadeField } from './facadeField.ts';
import { scenicRoom, type ScenicRoomInput } from './scenicRoom.ts';
import type { RoomFrame } from './scenicFixtures.ts';

export function roomBasis(origin: V3, dir: [number, number], normal: [number, number]): RoomFrame {
  return { dir, normal, point: (u, y, depth) => [origin[0] + dir[0] * u + normal[0] * depth, y,
    origin[2] + dir[1] * u + normal[1] * depth] };
}

/** The chord of the authored spans sets the room, independent of radius or slice count. */
export function curvedRoomFrame(floor: FloorLayout, sections: Section[], depth: number, inset = 0) {
  const spans = sections.flatMap(sectionSpans), first = spans[0]!, last = spans.at(-1)!;
  const a = new FacadeField(floor.outline, first.edge).point(first.offset + inset, 0, depth);
  const b = new FacadeField(floor.outline, last.edge).point(last.offset + last.width - inset, 0, depth);
  const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const dir: [number, number] = [(b[0] - a[0]) / width, (b[2] - a[2]) / width];
  const normal: [number, number] = [dir[1], -dir[0]];
  let rise = 0;
  for (const span of spans) {
    const p = new FacadeField(floor.outline, span.edge).point(span.offset, 0, depth);
    rise = Math.max(rise, (p[0] - a[0]) * normal[0] + (p[2] - a[2]) * normal[1]);
  }
  return { frame: roomBasis(a, dir, normal), origin: a, width, spans, rise };
}

export function meshScenicCurve(sink: PartSink, floor: FloorLayout, opening: Opening, sections: Section[],
  details: Pick<ScenicRoomInput, 'lights' | 'state' | 'warm'>): void {
  const g = opening.glazing!;
  const curve = curvedRoomFrame(floor, sections, -g.glassDepth - 0.14);
  const { frame, origin, width, spans } = curve;
  const bottom = floor.elevation + g.sill, top = bottom + g.height;
  opening.scenery!.lights = scenicRoom(sink, frame, { width, bottom, top, front: 0, depth: 2.8, ...details });
  for (const span of spans) {
    const field = new FacadeField(floor.outline, span.edge);
    const p = field.point(span.offset, 0, -g.glassDepth - 0.14), q = field.point(span.offset + span.width, 0, -g.glassDepth - 0.14);
    const pu = (p[0] - origin[0]) * frame.dir[0] + (p[2] - origin[2]) * frame.dir[1];
    const qu = (q[0] - origin[0]) * frame.dir[0] + (q[2] - origin[2]) * frame.dir[1];
    for (const [height, material, up] of [[bottom, 'floor', 1], [top, 'ceiling', -1]] as const) {
      sink.quadFacing(`cyberpunk/paired-room-${material}${details.state === 'lit' ? '' : '-' + details.state}/mid#surface`,
        [p[0], height, p[2]], [q[0], height, q[2]], frame.point(qu, height, 0), frame.point(pu, height, 0),
        [0, up, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
}
