import type { Role, RoleField, Section } from './types.ts';

/** Fixed ends and one complete middle field, in the section's own plane. */
export function sectionRoles(section: Section, height: number): RoleField[] {
  const { side, bottom, top } = section.border;
  const widths = [side, section.width - 2 * side, side];
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
