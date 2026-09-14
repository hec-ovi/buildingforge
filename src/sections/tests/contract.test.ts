import { expect, it } from 'vitest';
import { ARCHITECTURES, SectionAssembler, sectionRoles } from '../index.ts';

it('fits complete corner and bay sections and partitions every actual floor edge', () => {
  const assembler = new SectionAssembler();
  for (const architecture of ARCHITECTURES) {
    const input = { architecture, rectangle: [[0, 0], [32, 0], [32, 28], [0, 28]] as [[number, number], [number, number], [number, number], [number, number]], floorHeights: Array(9).fill(4) };
    const result = assembler.assemble(input);
    expect(result).toEqual(assembler.assemble(input));
    expect(result.extent).toEqual({ width: 30, depth: 26 });
    for (const floor of result.floors) {
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
        const sections = floor.sections.filter(s => s.edge === edge);
        let cursor = 0;
        for (const section of sections) {
          expect(section.offset).toBeCloseTo(cursor, 7);
          cursor += section.width;
          const fields = sectionRoles(section, 4);
          expect(new Set(fields.map(f => f.role)).size).toBe(9);
          expect(fields.reduce((area, f) => area + f.width * f.height, 0)).toBeCloseTo(section.width * 4, 7);
          expect(fields.every(f => f.width > 0 && f.height > 0)).toBe(true);
          if (section.technique === 'deep-bay' || section.technique === 'ribbon-bay') expect(section.width).toBe(4);
        }
        expect(cursor).toBeCloseTo(Math.hypot(b[0] - a[0], b[1] - a[1]), 7);
      }
    }
    if (architecture === 'terrace-blocks') {
      expect(result.groups.map(g => g.width)).toEqual([30, 26, 22]);
      expect(result.floors.filter(f => f.balconySections.length > 0).map(f => f.floor)).toEqual([2]);
    }
  }
});

it('rejects invalid inputs and insufficient whole-section fits', () => {
  const assembler = new SectionAssembler();
  expect(() => assembler.assemble({ architecture: 'rounded-corner', rectangle: [[0, 0], [8, 0], [8, 8], [0, 8]], floorHeights: [4] })).toThrow(RangeError);
  expect(() => assembler.assemble({ architecture: 'rounded-corner', rectangle: [[0, 0], [32, 0], [31, 28], [0, 28]], floorHeights: [4] })).toThrow(RangeError);
  expect(() => assembler.assemble({ architecture: 'terrace-blocks', rectangle: [[0, 0], [32, 0], [32, 28], [0, 28]], floorHeights: [4] })).toThrow(RangeError);
});
