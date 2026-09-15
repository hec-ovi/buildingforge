import { Rng } from '../core/rng.ts';
import { isPaired, sectionSpans } from '../sections/index.ts';
import type { Layout, FloorLayout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';
import { FacadeField } from './facadeField.ts';
import { ProfiledBlind } from './profiledBlind.ts';
import { meshGroundPrivacy } from './windowTreatments.ts';
import { scenicRoom, type ScenicRoomInput } from './scenicRoom.ts';
import type { RoomFrame } from './scenicFixtures.ts';

const frameMaterial = 'cyberpunk/paired-frame/mid#surface';

export function meshPairedWindows(mb: MeshBuilder, layout: Layout): void {
  if (!isPaired(layout.assembly?.architecture)) return;
  const blind = new ProfiledBlind();
  for (const floor of layout.floors) {
    if (!floor.assembly) continue;
    const nodeId = `scenery:${floor.index}`;
    const scenery = floor.index > 0 ? mb.part(nodeId, { keepNode: true }) : undefined;
    const ribs = mb.part(`paired-ribs:${floor.index}`);
    for (const section of floor.assembly.sections.filter(s => s.technique === 'paired-pier')) {
      const frame = new FacadeField(floor.outline, section.edge);
      for (let rib = 0; rib < 6; rib++) {
        const u = section.offset + 0.045 + rib * 0.076;
        frame.solid(ribs, 'cyberpunk/paired-rib/mid#surface', u, u + 0.024,
          floor.elevation + 0.22, floor.elevation + floor.height - 0.28, 0.135, 0.081, [0, 1], { start: true, end: true }, true);
      }
    }
    for (const opening of floor.openings) {
      if (opening.kind !== 'window' || !opening.glazing) continue;
      const section = floor.assembly.sections.find(s => s.id === opening.sectionId)!;
      const curved = section.technique === 'rounded-glass';
      const field = new FacadeField(floor.outline, opening.edge);
      const g = opening.glazing;
      const bottom = floor.elevation + g.sill, top = bottom + g.height;
      const glass = -g.glassDepth;
      const trim = mb.part(`paired-trim:${opening.id}`);
      field.solid(trim, floor.index === 0 ? frameMaterial : 'cyberpunk/paired-frame-metal/mid#surface', g.offset, g.offset + g.width, bottom + 0.95, bottom + 0.988,
        glass + 0.045, glass - 0.01, [0, 1], { start: true, end: true }, floor.index > 0);
      const basis = { v: floor.outline[opening.edge]!, dir: field.dir, n: field.normal };
      const rng = new Rng(layout.request.seed, `paired-window:${floor.index}:${curved ? 'curve' : section.id}`);
      const state = rng.chance(0.22) ? 'dark' : rng.chance(0.22) ? 'dim' : 'lit';
      const lights = rng.chance(0.55) ? 'strips' : 'spots';
      if (floor.index === 0) {
        if (curved && opening.windowTreatment) meshGroundPrivacy(mb.part(opening.windowTreatment.nodeId, { keepNode: true }),
          basis, { u0: g.offset, u1: g.offset + g.width, y0: bottom, y1: top }, glass,
          'cyberpunk/curtain/mid#blind', frameMaterial);
        continue;
      }
      opening.scenery = { nodeId, depth: curved ? 2.8 + 10 * (1 - Math.SQRT1_2) : 2.8, lightLayout: lights, state };
      const sink = scenery!;
      const panes = curved ? 1 : opening.panes?.cols ?? 4;
      for (let pane = 0; pane < panes && (!curved || opening.sectionSpan === 0); pane++) {
        const paneRng = new Rng(layout.request.seed, `paired-blind:${floor.index}:${section.id}:${pane}`);
        const closure = paneRng.chance(0.45) ? 0 : [25, 45, 75, 100][paneRng.int(0, 3)]!;
        const width = g.width / panes;
        if (curved) {
          const spans = sectionSpans(section), first = spans[0]!, last = spans.at(-1)!;
          const a = new FacadeField(floor.outline, first.edge).point(first.offset + 0.10, 0, glass - 0.12);
          const b = new FacadeField(floor.outline, last.edge).point(last.offset + last.width - 0.10, 0, glass - 0.12);
          const spanWidth = Math.hypot(b[0] - a[0], b[2] - a[2]);
          const axis: [number, number] = [(b[0] - a[0]) / spanWidth, (b[2] - a[2]) / spanWidth];
          blind.build(sink, roomBasis(a, axis, [axis[1], -axis[0]]), spanWidth, bottom, top, 0, closure);
        } else {
          const origin = field.point(g.offset + width * pane + 0.025, 0, glass - 0.12);
          blind.build(sink, roomBasis(origin, field.dir, field.normal), width - 0.05, bottom, top, 0, closure);
        }
      }
      if (curved) {
        const all = floor.assembly.sections.filter(s => s.technique === 'rounded-glass');
        if (section.id !== all[0]!.id || opening.sectionSpan !== 0) continue;
        curvedRoom(sink, floor, opening, { lights, state, warm: rng.chance(0.18) });
      } else {
        const origin = field.point(g.offset, 0, glass - 0.14);
        const roomFrame = roomBasis(origin, field.dir, field.normal);
        const reach = 2.8 + g.glassDepth + 0.14;
        const leftInset = Math.max(0, reach - g.offset);
        const rightInset = Math.max(0, reach - (field.length - g.offset - g.width));
        opening.scenery.lights = scenicRoom(sink, roomFrame, { width: g.width, bottom, top, front: 0, depth: 2.8,
          leftInset, rightInset, lights, state, warm: rng.chance(0.18) });
      }
    }
  }
}

function roomBasis(origin: V3, dir: [number, number], normal: [number, number]): RoomFrame {
  return { dir, normal, point: (u, y, depth) => [origin[0] + dir[0] * u + normal[0] * depth, y,
    origin[2] + dir[1] * u + normal[1] * depth] };
}

function curvedRoom(sink: PartSink, floor: FloorLayout, opening: Opening,
  details: Pick<ScenicRoomInput, 'lights' | 'state' | 'warm'>): void {
  const sections = floor.assembly!.sections.filter(s => s.technique === 'rounded-glass');
  const spans = sections.flatMap(sectionSpans);
  const first = spans[0]!, last = spans.at(-1)!;
  const a = new FacadeField(floor.outline, first.edge).point(first.offset, 0, -0.28);
  const b = new FacadeField(floor.outline, last.edge).point(last.offset + last.width, 0, -0.28);
  const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const dir: [number, number] = [(b[0] - a[0]) / width, (b[2] - a[2]) / width];
  const normal: [number, number] = [dir[1], -dir[0]];
  const room = roomBasis(a, dir, normal);
  const g = opening.glazing!, bottom = floor.elevation + g.sill, top = bottom + g.height;
  opening.scenery!.lights = scenicRoom(sink, room, { width, bottom, top, front: 0, depth: 2.8, ...details });
  for (const span of spans) {
    const field = new FacadeField(floor.outline, span.edge);
    const p = field.point(span.offset, 0, -0.28), q = field.point(span.offset + span.width, 0, -0.28);
    const pu = (p[0] - a[0]) * dir[0] + (p[2] - a[2]) * dir[1];
    const qu = (q[0] - a[0]) * dir[0] + (q[2] - a[2]) * dir[1];
    for (const [height, material, up] of [[bottom, 'floor', 1], [top, 'ceiling', -1]] as const) {
      sink.quadFacing(`cyberpunk/paired-room-${material}${details.state === 'lit' ? '' : '-' + details.state}/mid#surface`, [p[0], height, p[2]], [q[0], height, q[2]],
        room.point(qu, height, 0), room.point(pu, height, 0), [0, up, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
}
