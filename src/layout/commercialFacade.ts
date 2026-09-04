import { Rng } from '../core/rng.ts';
import { edgeLength } from '../core/polygon.ts';
import type { BuildingRequest, Opening } from '../types.ts';
import type { FloorLayout, Style } from './model.ts';
import { modulePanes } from './glazing.ts';

/** Shop glazing follows the entrance and leaves broad uninterrupted wall fields. */
export function fitCommercialWindows(request: BuildingRequest, floors: FloorLayout[], style: Style): void {
  const commercial = ['commerce', 'mall'].includes(request.building.type);
  const ground = floors.find((floor) => floor.index === 0);
  const entrance = ground?.openings.find((opening) => opening.doorRole === 'main' || opening.kind === 'openFront');
  if (!entrance) return;
  const width = new Rng(request.seed, 'commercial-display').pick([4, 5, 6]);
  for (const floor of floors) {
    if (floor.index < 0 || (!commercial && !(floor.index === 0 && ['commerce', 'mall'].includes(floor.kind)))) continue;
    const source = floor.openings.filter((opening) => opening.kind === 'window');
    floor.openings = floor.openings.filter((opening) => opening.kind !== 'window');
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const template = source.find((opening) => opening.edge === edge);
      if (!template || (floor.index === 0 && edge !== entrance.edge)) continue;
      const length = edgeLength(floor.outline, edge);
      const reserved = floor.openings.filter((opening) => opening.edge === edge);
      const spans = freeSpans(1.5, length - 1.5, reserved);
      const cells = floor.index === 0
        ? spans.sort((a, b) => distance(a, entrance.offset + entrance.width / 2) - distance(b, entrance.offset + entrance.width / 2)).slice(0, 2)
        : Array.from({ length: 2 }, (_, index): [number, number] => [index * length / 2 + 1.5, (index + 1) * length / 2 - 1.5]);
      for (const [index, cell] of cells.entries()) {
        const available = freeSpans(cell[0], cell[1], reserved).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
        const span = available[0];
        if (!span) continue;
        const fitted = Math.min(width, Math.floor(span[1] - span[0]));
        if (fitted < 2) continue;
        const offset = Math.round(((span[0] + span[1] - fitted) / 2) * 1000) / 1000;
        floor.openings.push({
          ...template, id: `w:${floor.index}:${edge}:display:${index}`, offset, width: fitted,
          panes: modulePanes(fitted, template.height - (template.head ?? 0) - (template.spandrel ?? 0), style.glazing),
          ...(template.curtain ? { curtain: { ...template.curtain } } : {}),
        });
      }
    }
  }
}

function freeSpans(start: number, end: number, reserved: Opening[]): [number, number][] {
  let spans: [number, number][] = end > start ? [[start, end]] : [];
  for (const opening of reserved) {
    const lo = opening.offset - 1.5, hi = opening.offset + opening.width + 1.5;
    spans = spans.flatMap(([a, b]): [number, number][] => {
      if (hi <= a || lo >= b) return [[a, b]];
      return [...(lo > a ? [[a, lo] as [number, number]] : []), ...(hi < b ? [[hi, b] as [number, number]] : [])];
    });
  }
  return spans;
}

function distance(span: [number, number], center: number): number {
  return Math.abs((span[0] + span[1]) / 2 - center);
}
