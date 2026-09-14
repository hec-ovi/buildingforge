import { exactMaterialSlot } from '../materials/slot.ts';
import { sectionRoles, sectionSpans, spanField } from '../sections/index.ts';
import { FacadeField } from './facadeField.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder } from './primitives.ts';

/** Full-map solid section fields, with closed front, back and return faces. */
export function meshSectionFinish(mb: MeshBuilder, layout: Layout, mat: (kind: string) => string): void {
  for (const floor of layout.floors) {
    const plan = floor.assembly;
    if (!plan || floor.index < 0) continue;
    const group = layout.assembly!.groups.find(g => g.id === plan.group)!;
    for (const section of plan.sections) {
      const opening = floor.openings.find(o => o.sectionId === section.id);
      const sink = mb.part(`section:${floor.index}/${section.id}/${section.technique}`);
      for (const span of sectionSpans(section)) {
        const frame = new FacadeField(floor.outline, span.edge);
        for (const role of sectionRoles(section, floor.height)) {
          const field = spanField(role, span);
          if (!field) continue;
          if (field.role === 'middle' && section.technique !== 'frame-pier') continue;
          if ((opening?.kind === 'door' || opening?.kind === 'balconyDoor') && field.role === 'bottom-middle') continue;
          // An entrance's head uses its real public passage height.
          let sill = field.sill, height = field.height;
          if (opening?.kind === 'door' && field.role === 'top-middle') {
            sill = opening.height;
            height = floor.height - sill;
          }
          if (height <= 0) continue;
          const curved = section.technique === 'rounded-glass';
          const groupBand = group.toFloor === floor.index && field.role.startsWith('top');
          const ribbon = layout.assembly!.architecture === 'chamfered-corners';
          const pier = section.technique === 'frame-pier';
          const proud = pier ? 0.85 : ribbon ? (groupBand || floor.index === 0 && field.role.startsWith('bottom') ? 0.85 : 0.5) : curved ? 0.04 : groupBand ? 0.42 : section.border.depth;
          const material = ribbon ? mat(pier || groupBand ? 'column' : 'wall-trim')
            : mat(curved ? 'window-frame' : field.role.includes('left') || field.role.includes('right') ? 'column' : 'wall-trim');
          frame.solid(sink, ribbon ? material : exactMaterialSlot(material),
            field.offset, field.offset + field.width, floor.elevation + sill, floor.elevation + sill + height, proud, 0,
            [(field.offset - span.offset + span.sectionOffset - role.offset) / role.width,
              (field.offset + field.width - span.offset + span.sectionOffset - role.offset) / role.width],
            { start: role.offset >= span.sectionOffset - 1e-7, end: role.offset + role.width <= span.sectionOffset + span.width + 1e-7 }, ribbon);
        }
      }
    }
  }
}
