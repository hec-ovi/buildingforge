import type { Role, RoleField, Section, SectionSpan } from './types.ts';

/** Fixed ends and one complete middle field, in the section's own plane. */
export function sectionRoles(section: Section, height: number): RoleField[] {
  const { side, bottom, top } = section.border;
  const left = section.border.left ?? side, right = section.border.right ?? side;
  const widths = [left, section.width - left - right, right];
  const heights = [bottom, height - bottom - top, top];
  if (widths[1]! <= 0 || heights[1]! <= 0) throw new RangeError('section dimensions cannot hold the fixed ends');
  const rows = ['bottom', 'middle', 'top'];
  const columns = ['left', 'middle', 'right'];
  const result: RoleField[] = [];
  let sill = 0;
  for (let y = 0; y < 3; y++) {
    let offset = 0;
    for (let x = 0; x < 3; x++) {
      const role = y === 1 && x === 1 ? 'middle' : `${rows[y]}-${columns[x]}`;
      result.push({ role: role as Role, offset, sill, width: widths[x]!, height: heights[y]! });
      offset += widths[x]!;
    }
    sill += heights[y]!;
  }
  return result;
}

/** A curved bay can cross several outline segments without adding window jambs. */
export function sectionSpans(section: Section): SectionSpan[] {
  return section.spans ?? [{ edge: section.edge, offset: section.offset, width: section.width, sectionOffset: 0 }];
}

/** Intersection of a full authored field and one geometric outline segment. */
export function spanField(field: RoleField, span: SectionSpan): RoleField | undefined {
  const start = Math.max(field.offset, span.sectionOffset);
  const end = Math.min(field.offset + field.width, span.sectionOffset + span.width);
  return end - start > 1e-8 ? { ...field, offset: span.offset + start - span.sectionOffset, width: end - start } : undefined;
}
