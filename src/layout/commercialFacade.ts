import { Rng } from '../core/rng.ts';
import { edgeLength } from '../core/polygon.ts';
import type { BuildingRequest, Opening } from '../types.ts';
import type { FloorLayout, Style } from './model.ts';
import { modulePanes } from './glazing.ts';
import { openingEnvelope } from './openingEnvelope.ts';

interface UpperDisplayFit { edge: number; maxWidth: number }

/** Shop glazing follows the entrance and leaves broad uninterrupted wall fields. */
export function fitCommercialWindows(
  request: BuildingRequest, floors: FloorLayout[], style: Style, upperFit?: UpperDisplayFit,
): void {
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
        const fittingCore = floor.index > 0 && edge === upperFit?.edge;
        const fitted = Math.min(width, Math.floor(span[1] - span[0]), fittingCore ? upperFit!.maxWidth : Infinity);
        if (fitted < 2) continue;
        const seat = fittingCore ? (index === 0 ? span[0] : span[1] - fitted)
          : (span[0] + span[1] - fitted) / 2;
        const offset = Math.round(seat * 1000) / 1000;
        const id = `w:${floor.index}:${edge}:display:${index}`;
        const appearance = source.find((opening) => opening.id === id) ?? template;
        floor.openings.push({
          ...appearance, id, offset, width: fitted,
          panes: modulePanes(fitted, appearance.height - (appearance.head ?? 0) - (appearance.spandrel ?? 0), style.glazing),
          ...(appearance.curtain ? { curtain: { ...appearance.curtain } } : {}),
        });
      }
    }
  }
}

/** Retain each display pair and its piers while giving the core more central wall. */
export function* commercialCoreCandidates(
  request: BuildingRequest, floors: FloorLayout[], style: Style,
): Generator<FloorLayout[]> {
  if (!['commerce', 'mall'].includes(request.building.type)) return;
  const windows = floors.filter((floor) => floor.index > 0)
    .flatMap((floor) => floor.openings.filter((opening) => opening.kind === 'window'));
  const edges = [...new Set(windows.map((window) => window.edge))].sort((a, b) => a - b);
  for (const edge of edges) {
    const widest = Math.max(...windows.filter((window) => window.edge === edge).map((window) => window.width));
    for (let maxWidth = widest; maxWidth >= 2; maxWidth--) {
      const candidate = floors.map((floor) => ({ ...floor, openings: structuredClone(floor.openings) }));
      fitCommercialWindows(request, candidate, style, { edge, maxWidth });
      yield candidate;
    }
  }
}

function freeSpans(start: number, end: number, reserved: Opening[]): [number, number][] {
  let spans: [number, number][] = end > start ? [[start, end]] : [];
  for (const opening of reserved) {
    const field = openingEnvelope(opening);
    const lo = field.offset - 1.5, hi = field.offset + field.width + 1.5;
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
