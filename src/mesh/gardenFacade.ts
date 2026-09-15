import type { Layout } from '../layout/model.ts';
import { Rng } from '../core/rng.ts';
import { FacadeField } from './facadeField.ts';
import { gardenPlant } from './gardenPlants.ts';
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
      const a = section.offset + 0.10, b = section.offset + section.width - 0.10;
      const y = floor.elevation + 0.22, height = 0.92;
      frame.solid(sink, panel, a, b, y, y + height, 0.32, 0.12, [0, 1], { start: true, end: true }, true);
      frame.solid(sink, trim, a, b, y + height - 0.025, y + height + 0.025, 0.34, 0.10, [0, 1], { start: true, end: true }, true);
      frame.solid(sink, panel, a, b, y, y + 0.13, 0.12, -0.92);
      for (const u of [a, b - 0.12]) frame.solid(sink, panel, u, u + 0.12, y, y + height, 0.12, -0.92);
      const at = (u: number, z: number): V3 => frame.point(u, y + height - 0.18, z);
      sink.quadFacing('cyberpunk/garden-soil/mid#surface', at(a + 0.12, -0.90), at(b - 0.12, -0.90), at(b - 0.12, 0.11), at(a + 0.12, 0.11), [0, 1, 0], [[0,0],[1,0],[1,1],[0,1]]);
      const count = Math.max(1, Math.floor((b - a) / 1.65));
      const rng = new Rng(layout.request.seed, `garden:${floor.index}:${section.edge}`);
      for (let i = 0; i < count; i++) {
        const u = a + (b - a) * (i + 0.5) / count;
        gardenPlant(sink, at(u, -0.55), Math.min(1.0, (b - a) / 2) * rng.range(0.72, 1.02), `${layout.request.seed}:${floor.index}:${section.edge}:${i}`);
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
