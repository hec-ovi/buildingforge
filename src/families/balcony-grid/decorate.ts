import type { DecorationContext, FamilySection, FloorLayout } from '../api.ts';
import { gallery } from './gallery.ts';
import { skin } from './skin.ts';

export function decorate(context: DecorationContext): void {
  const { builder, layout } = context;
  const previousFloor = builder.floor;
  const upper = layout.floors.filter(f => f.index > 0);
  const top = upper.at(-1)?.index;
  try {
    for (const floor of layout.floors.filter(f => f.index >= 0)) {
      builder.floor = floor.index;
      for (const section of floor.assembly?.sections ?? []) {
        skin(context, floor, section);
        if (floor.index === 0) continue;
        if (section.technique !== 'paired-glass' || !section.id.startsWith('bg:gallery:') || reserved(context, floor, section)) continue;
        gallery(context, floor, section, floor.index === top);
      }
    }
  } finally {
    builder.floor = previousFloor;
  }
}

function reserved({ layout }: DecorationContext, floor: FloorLayout, section: FamilySection): boolean {
  const overlaps = (edge: number, start: number, width: number) => edge === section.edge &&
    start < section.offset + section.width + 0.2 && start + width > section.offset - 0.2;
  return floor.openings.some(o => o.kind !== 'window' && overlaps(o.edge, o.offset, o.width)) ||
    layout.carved.some(({ aperture: a }) => a.floor === floor.index && overlaps(a.face, a.u, a.width));
}
