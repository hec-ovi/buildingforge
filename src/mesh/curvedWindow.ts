import { FacadeField } from './facadeField.ts';
import type { PartSink } from './primitives.ts';
import type { FloorLayout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import type { Section } from '../sections/index.ts';

/** One geometric slice of a broad glazed bay; internal curve slices have no jamb. */
export function meshCurvedWindow(sink: PartSink, floor: FloorLayout, opening: Opening, section: Section, mat: (kind: string) => string): NonNullable<Opening['glazing']> {
  const frame = new FacadeField(floor.outline, opening.edge);
  const span = section.spans![opening.sectionSpan!]!;
  const first = opening.sectionSpan === 0, last = opening.sectionSpan === section.spans!.length - 1;
  const u0 = opening.offset, u1 = u0 + opening.width;
  const y0 = floor.elevation + opening.sill, y1 = y0 + opening.height;
  const member = 0.06, glass = -section.border.depth - 0.02;
  const front = glass + 0.06, back = glass - 0.008;
  const solid = (a: number, b: number, bottom: number, top: number) => frame.solid(sink, mat('window-frame'), a, b, bottom, top, front, back, [0, 1], { start: first || a > 1e-7, end: last || b < frame.length - 1e-7 });
  solid(u0, u1, y0, y0 + member);
  solid(u0, u1, y1 - member, y1);
  if (first) solid(u0, u0 + member, y0 + member, y1 - member);
  if (last) solid(u1 - member, u1, y0 + member, y1 - member);
  const left = u0 + (first ? member : 0), right = u1 - (last ? member : 0);
  const clearWidth = section.width - 2 * section.border.side - 2 * member;
  const map = (u: number) => (span.sectionOffset + u - span.offset - section.border.side - member) / clearWidth;
  frame.solid(sink, opening.material ?? mat('window-glass'), left, right, y0 + member, y1 - member, glass, glass - 0.006, [map(left), map(right)], { start: first, end: last });
  return { offset: left, sill: opening.sill + member, width: right - left, height: opening.height - 2 * member,
    glassDepth: -glass, housingBackDepth: -back };
}
