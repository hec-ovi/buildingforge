import { buildingFamily } from '../families/registry.ts';
import { curvedRoomFrame, meshScenicCurve, roomBasis } from './scenicCurve.ts';
import { scenicSlope } from './scenicSlope.ts';
import { Rng } from '../core/rng.ts';
import { scenicState } from '../layout/scenicState.ts';
import { isPaired } from '../sections/index.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder } from './primitives.ts';
import { FacadeField } from './facadeField.ts';
import { ProfiledBlind } from './profiledBlind.ts';
import { meshGroundPrivacy } from './windowTreatments.ts';
import { scenicRoom, SCENIC_DEPTH } from './scenicRoom.ts';

const frameMaterial = 'cyberpunk/paired-frame/mid#surface';

export function meshPairedWindows(mb: MeshBuilder, layout: Layout): void {
  const family = buildingFamily(layout.assembly?.architecture);
  if (!family && !isPaired(layout.assembly?.architecture)) return;
  const blind = new ProfiledBlind();
  for (const floor of layout.floors) {
    if (!floor.assembly) continue;
    mb.floor = floor.index;
    const nodeId = `scenery:${floor.index}`;
    const scenery = floor.index > 0 ? mb.part(nodeId, { keepNode: true, sloped: true }) : undefined;
    const ribs = mb.part(`paired-ribs:${floor.index}`);
    for (const section of floor.assembly.sections.filter(s => !family && s.technique === 'paired-pier')) {
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
      const curved = !!section.spans?.length;
      const field = new FacadeField(floor.outline, opening.edge);
      const g = opening.glazing;
      const bottom = floor.elevation + g.sill, top = bottom + g.height;
      const glass = -g.glassDepth;
      const trim = mb.part(`paired-trim:${opening.id}`);
      if (top - bottom > 1.2) field.solid(trim, family?.materials?.['window-frame'] ?? (floor.index === 0 ? frameMaterial : 'cyberpunk/paired-frame-metal/mid#surface'), g.offset, g.offset + g.width, bottom + 0.95, bottom + 0.988,
        glass + 0.045, glass - 0.01, [0, 1], { start: true, end: true }, floor.index > 0);
      const basis = { v: floor.outline[opening.edge]!, dir: field.dir, n: field.normal };
      const { state, lights, warm } = scenicState(layout.request.seed, floor.index, section.id, section.technique === 'rounded-glass');
      if (floor.index === 0) {
        if (curved && opening.windowTreatment) meshGroundPrivacy(mb.part(opening.windowTreatment.nodeId, { keepNode: true }),
          basis, { u0: g.offset, u1: g.offset + g.width, y0: bottom, y1: top }, glass,
          'cyberpunk/curtain/mid#blind', frameMaterial);
        continue;
      }
      if (state === 'dark') continue;
      opening.scenery = { nodeId, depth: SCENIC_DEPTH, lightLayout: lights, state };
      const fitScenery = scenicSlope(floor, field.point(g.offset, 0, glass), field.normal);
      const sink = scenery!.mapped(fitScenery);
      const panes = curved ? 1 : opening.panes?.cols ?? 4;
      for (let pane = 0; pane < panes && top - bottom > 0.5 && g.width > 0.2 && (!curved || opening.sectionSpan === 0); pane++) {
        const paneRng = new Rng(layout.request.seed, `paired-blind:${floor.index}:${section.id}:${pane}`);
        const closure = paneRng.chance(0.45) ? 0 : [25, 45, 75, 100][paneRng.int(0, 3)]!;
        const width = g.width / panes;
        if (curved) {
          const curve = curvedRoomFrame(floor, [section], glass - 0.12, 0.10);
          blind.build(sink, curve.frame, curve.width, bottom, top, 0, closure);
        } else {
          const origin = field.point(g.offset + width * pane + 0.025, 0, glass - 0.12);
          blind.build(sink, roomBasis(origin, field.dir, field.normal), width - 0.05, bottom, top, 0, closure);
        }
      }
      if (curved) {
        if (opening.sectionSpan !== 0) continue;
        meshScenicCurve(sink, floor, opening, [section], g.glassDepth, { lights, state, warm });
      } else {
        const origin = field.point(g.offset, 0, glass);
        const roomFrame = roomBasis(origin, field.dir, field.normal);
        opening.scenery.lights = scenicRoom(sink, roomFrame, { width: g.width, bottom, top, front: 0, depth: SCENIC_DEPTH, lights, state, warm });
      }
      for (const light of opening.scenery.lights ?? []) light.position = fitScenery(light.position);
    }
  }
  mb.floor = undefined;
}
