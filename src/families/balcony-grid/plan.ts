import type { FamilyFloor, FamilyInput, FamilyPlan, FamilySection, Point } from '../api.ts';
import { BLOCK, BuildingFrame, END_ALLOWANCE, GALLERY, GALLERY_DEPTH, PIER, ROOM_PAIR } from './dimensions.ts';
import { CORNER_RADIUS, glazedCorner } from './corner.ts';

type Run = { kind: 'pier' | 'glass' | 'gallery'; width: number };

/** Recessed galleries occupy one room beside each two-room glazed field. */
export function plan(input: FamilyInput): FamilyPlan {
  const frame = new BuildingFrame(input);
  const rectangle = input.fixedFaces ? input.rectangle.map(p => [...p] as Point) : frame.rectangle();
  const upper = facade(rectangle, Boolean(input.fixedFaces));
  const floors: FamilyFloor[] = input.floorHeights.map((_, floor) => ({
    floor, group: floor === 0 ? 0 : 1,
    outline: floor === 0 ? rectangle.map(p => [...p] as Point) : upper.outline.map(p => [...p] as Point),
    sections: floor === 0 ? rectangle.map((p, edge) => section(`bg:entry:${edge}`, edge, 0,
      Math.hypot(rectangle[(edge + 1) % 4]![0] - p[0], rectangle[(edge + 1) % 4]![1] - p[1]), 'paired-glass', []))
      : upper.sections.map(s => ({ ...s, border: { ...s.border }, ...(s.spans ? { spans: s.spans.map(span => ({ ...span })) } : {}) })),
    balconySections: [],
  }));
  return {
    grid: 0.5, extent: { width: frame.width, depth: frame.depth }, corners: ['square', 'square', input.fixedFaces ? 'square' : 'rounded', 'square'],
    groups: [{ id: 0, fromFloor: 0, toFloor: 0, width: frame.width, depth: frame.depth },
      { id: 1, fromFloor: 1, toFloor: floors.length - 1, width: frame.width, depth: frame.depth }], floors,
  };
}

function runs(length: number): Run[] {
  const count = Math.floor((length - END_ALLOWANCE + 1e-8) / BLOCK);
  const end = (length - count * BLOCK - END_ALLOWANCE) / 2;
  const result: Run[] = [{ kind: 'pier', width: PIER + end }];
  for (let i = 0; i < count; i++) {
    result.push({ kind: 'glass', width: ROOM_PAIR }, { kind: 'pier', width: PIER }, { kind: 'gallery', width: GALLERY });
    if (i < count - 1) result.push({ kind: 'pier', width: PIER });
  }
  result.push({ kind: 'pier', width: end + END_ALLOWANCE });
  return result;
}

function facade(rectangle: Point[], fixed: boolean): { outline: Point[]; sections: FamilySection[] } {
  const outline: Point[] = [], sections: FamilySection[] = [];
  for (let face = 0; face < 4; face++) {
    const a = rectangle[face]!, b = rectangle[(face + 1) % 4]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const point = (u: number, recess = 0): Point => [a[0] + dir[0] * u - dir[1] * recess, a[1] + dir[1] * u + dir[0] * recess];
    if (fixed) outline.push([...a]);
    let cursor = 0;
    const sequence = runs(length);
    if (face === 1) sequence.reverse();
    const start = !fixed && face === 2 ? CORNER_RADIUS : 0;
    const end = !fixed && face === 1 ? length - CORNER_RADIUS : length;
    for (const [bay, run] of sequence.entries()) {
      const from = Math.max(start, cursor), to = Math.min(end, cursor + run.width);
      const width = to - from;
      const clipped = Math.abs(width - run.width) > 1e-7;
      const id = `bg:${clipped ? 'corner:leg' : run.kind}:${face}:${bay}`;
      if (width <= 0) { cursor += run.width; continue; }
      if (fixed) sections.push(section(id, face, cursor, run.width, run.kind === 'pier' ? 'paired-solid' : 'paired-glass'));
      else if (run.kind === 'gallery') {
        outline.push(point(from));
        sections.push(section(`${id}:left`, outline.length - 1, 0, GALLERY_DEPTH, 'paired-solid'));
        outline.push(point(from, GALLERY_DEPTH));
        sections.push(section(id, outline.length - 1, 0, width, 'paired-glass'));
        outline.push(point(to, GALLERY_DEPTH));
        sections.push(section(`${id}:right`, outline.length - 1, 0, GALLERY_DEPTH, 'paired-solid'));
      } else {
        outline.push(point(from));
        sections.push(section(id, outline.length - 1, 0, width, run.kind === 'pier' ? 'paired-solid' : 'paired-glass'));
      }
      cursor += run.width;
    }
    if (face === 1 && !fixed) glazedCorner(rectangle, outline, sections);
  }
  if (fixed) wrapFixedCorner(rectangle, sections);
  return { outline, sections };
}

function wrapFixedCorner(rectangle: Point[], sections: FamilySection[]): void {
  for (const edge of [1, 2]) {
    const a = rectangle[edge]!, b = rectangle[(edge + 1) % 4]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const from = edge === 1 ? length - CORNER_RADIUS : 0, to = from + CORNER_RADIUS;
    for (let i = sections.length - 1; i >= 0; i--) {
      const field = sections[i]!;
      if (field.edge !== edge || field.offset >= to || field.offset + field.width <= from) continue;
      if (field.offset >= from && field.offset + field.width <= to) sections.splice(i, 1);
      else if (field.offset < from) field.width = from - field.offset;
      else { field.width -= to - field.offset; field.offset = to; }
    }
    const field = section(`bg:corner:fixed:${edge}`, edge, from, CORNER_RADIUS, 'paired-glass');
    field.border.side = 0.025;
    field.panes = { cols: 2, rows: 1 };
    sections.push(field);
  }
  sections.sort((a, b) => a.edge - b.edge || a.offset - b.offset);
}

function section(id: string, edge: number, offset: number, width: number,
  technique: FamilySection['technique'], windows?: FamilySection['windows']): FamilySection {
  return { id, edge, offset, width, technique, border: { side: 0.06, bottom: 0.25, top: 0.25, depth: 0.12 },
    ...(windows === undefined ? {} : { windows }) };
}
