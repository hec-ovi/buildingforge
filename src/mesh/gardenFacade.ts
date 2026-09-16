import type { Layout } from '../layout/model.ts';
import { Rng } from '../core/rng.ts';
import { FacadeField } from './facadeField.ts';
import { gardenPlant } from './gardenPlants.ts';
import { gardenCassette } from './gardenCassette.ts';
import type { MeshBuilder, V3 } from './primitives.ts';

/** Fitted planter bands occupy the two declared garden faces. */
export function meshGardenFacade(builder: MeshBuilder, layout: Layout): void {
  if (layout.assembly?.architecture !== 'garden-taper') return;
  const panel = 'cyberpunk/paired-cladding-metal/mid#surface';
  const trim = 'cyberpunk/garden-concrete/mid#surface';
  for (const floor of layout.floors) {
    if (floor.index < 1 || !floor.assembly) continue;
    builder.floor = floor.index;
    for (const section of floor.assembly.sections.filter(s => s.technique === 'garden-bay')) {
      const frame = new FacadeField(floor.outline, section.edge);
      const sink = builder.part(`garden:${floor.index}:${section.edge}`);
      const a = section.offset, b = section.offset + section.width;
      const y = floor.elevation, front = 0.55, back = -1.30;
      // Two front courses, deep side closures and a canopy enclose every loggia.
      gardenCassette(sink, frame, trim, a, b, y + 0.12, y + 0.23, front + 0.025, back);
      gardenCassette(sink, frame, panel, a, b, y + 0.23, y + 0.89, front, back);
      gardenCassette(sink, frame, panel, a, b, y + 0.905, y + 1.56, front, back);
      gardenCassette(sink, frame, trim, a, b, y + floor.height - 0.33, y + floor.height - 0.25, front + 0.025, back);
      gardenCassette(sink, frame, panel, a, b, y + floor.height - 0.25, y + floor.height - 0.02, front, back);
      for (const u of [a, b - 0.18]) frame.solid(sink, panel, u, u + 0.18, y + 1.56,
        y + floor.height - 0.33, 0.27, back, [0, 1], { start: true, end: true }, true);
      for (const u of [a - 0.48, b]) frame.solid(sink, trim, u, u + 0.48, y,
        y + floor.height, 0.6, -1.52, [0, 1], { start: true, end: true }, true);
      const at = (u: number, z: number): V3 => frame.point(u, y + 1.57, z);
      sink.quadFacing('cyberpunk/garden-soil/mid#surface', at(a + 0.2, -1.25), at(b - 0.2, -1.25),
        at(b - 0.2, 0.20), at(a + 0.2, 0.20), [0, 1, 0], [[0,0],[1,0],[1,1],[0,1]]);
      const count = Math.max(2, Math.floor((b - a) / 1.45));
      const rng = new Rng(layout.request.seed, `garden:${floor.index}:${section.edge}`);
      for (let i = 0; i < count; i++) {
        const u = a + (b - a) * (i + 0.5) / count;
        gardenPlant(sink, at(u, -0.45), rng.range(1.45, 1.8), `${layout.request.seed}:${floor.index}:${section.edge}:${i}`);
      }
    }
    const accents = builder.part(`garden-edge-light:${floor.index}`);
    for (const edge of [0, 2]) {
      const frame = new FacadeField(floor.outline, edge);
      for (const u of [0.08, frame.length - 0.115]) frame.solid(accents, 'cyberpunk/paired-light-cool/mid#surface', u, u + 0.035,
        floor.elevation, floor.elevation + floor.height, 0.17, 0.14);
    }
  }
  builder.floor = undefined;
  const roof = builder.part('garden-roof-rim');
  for (let edge = 0; edge < layout.roof.outline.length; edge++) {
    const frame = new FacadeField(layout.roof.outline, edge);
    frame.solid(roof, trim, 0, frame.length, layout.roof.elevation - 0.1, layout.roof.elevation + 0.3, 0.16, -0.08,
      [0, 1], { start: true, end: true }, true);
  }
}
