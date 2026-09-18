import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout, type Point } from '../api.ts';
import { family } from './index.ts';

const input = (): FamilyInput => JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));

function host(plan: FamilyPlan, source: FamilyInput): Layout {
  let elevation = 0;
  return {
    request: { seed: source.seed, parcel: { footprint: source.rectangle }, options: {} },
    assembly: plan,
    carved: [],
    floors: plan.floors.map(p => {
      const height = source.floorHeights[p.floor]!;
      const result = { index: p.floor, kind: 'office', elevation, height, outline: p.outline, assembly: p,
        openings: p.sections.flatMap(s => (s.windows ?? []).map((w, i) => ({
          id: `${p.floor}:${s.id}:${i}`, kind: 'window', sectionId: s.id, edge: s.edge, offset: s.offset + w.offset,
          width: w.width, sill: w.sill, height: w.height,
        }))) };
      elevation += height;
      return result;
    }),
  } as unknown as Layout;
}

function contained(point: Point, rectangle: Point[]): boolean {
  return rectangle.every((a, i) => {
    const b = rectangle[(i + 1) % rectangle.length]!;
    return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]) >= -1e-6;
  });
}

describe('faceted-bays public family', () => {
  it('fits whole three-plane cells on rotated and fixed plates, and rejects impossible input', () => {
  {
    const source = input();
    const angle = 0.41;
    source.rectangle = source.rectangle.map(([x, z]) => [5 + x * Math.cos(angle) - z * Math.sin(angle), -9 + x * Math.sin(angle) + z * Math.cos(angle)]) as FamilyInput['rectangle'];
    const plan = family.plan(source);
    expect(plan).toEqual(family.plan(source));
    expect(plan.extent).toEqual({ width: 39.5, depth: 27.5 });
    expect(plan.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 0], [1, 4], [5, 8], [9, 9]]);
    expect(plan.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    expect(plan.floors[1]!.sections.filter(s => s.id.endsWith(':front')).every(s => s.windows?.length === 0)).toBe(true);
    const glazed = plan.floors[2]!;
    expect(glazed.sections.filter(s => s.id.endsWith(':cheek')).every(s => Math.abs(s.width - Math.SQRT2 * 1.5) < 1e-8 && s.windows?.length === 1)).toBe(true);
    expect(glazed.sections.filter(s => s.id.endsWith(':slit')).every(s => s.windows?.[0]?.width === 0.4)).toBe(true);
    for (const floor of plan.floors) {
      expect(floor.outline.every(p => contained(p, source.rectangle))).toBe(true);
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
        const sections = floor.sections.filter(s => s.edge === edge).sort((a, b) => a.offset - b.offset);
        let end = 0;
        for (const s of sections) { expect(s.offset).toBeCloseTo(end); end += s.width; }
        expect(end).toBeCloseTo(Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
    }
  }
  {
    const source = { ...input(), fixedFaces: true };
    source.rectangle = [[3, 6], [44, 6], [44, 35], [3, 35]];
    source.floorHeights[0] = 5;
    const before = structuredClone(source);
    const plan = family.plan(source);
    expect(source).toEqual(before);
    expect(plan.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(source.rectangle))).toBe(true);
    expect(plan.extent).toEqual({ width: 41, depth: 29 });
    expect(plan.floors.every(f => f.balconySections.length === 0)).toBe(true);
  }
  {
    expect(() => family.plan({ ...input(), rectangle: [[0, 0], [30, 0], [29, 30], [0, 30]] })).toThrow(RangeError);
    expect(() => family.plan({ ...input(), rectangle: [[0, 0], [15, 0], [15, 15], [0, 15]] })).toThrow(RangeError);
    expect(() => family.plan({ ...input(), floorHeights: [4.5, 2.2] })).toThrow(RangeError);
  }
  });

  it('emits finite attached geometry and portrait screens inside the parcel, clear of doors and bridge cuts', () => {
  {
    const source = input(), plan = family.plan(source), layout = host(plan, source);
    const floor = layout.floors[0]!;
    floor.openings.push({ id: 'entrance', edge: 0, offset: 9, width: 3, height: 3.8, sill: 0, kind: 'door', material: 'door' });
    const builder = new MeshBuilder();
    builder.floor = 72;
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.floor).toBe(72);
    expect(builder.parts.some(p => p.name.endsWith('/screens') && p.prims.has(family.materials!.screen!))).toBe(true);
    expect(builder.parts.every(p => p.floor !== undefined)).toBe(true);
    for (const part of builder.parts) for (const prim of part.prims.values()) {
      expect(prim.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < prim.positions.length; i += 3) {
        const x = prim.positions[i]!, y = prim.positions[i + 1]!, z = prim.positions[i + 2]!;
        expect(contained([x, z], source.rectangle)).toBe(true);
        if (part.floor === 0 && Math.abs(z - floor.outline[0]![1]) < 0.2) {
          expect(x > floor.outline[0]![0] + 9.04 && x < floor.outline[0]![0] + 11.96 && y < 3.76 && y > 0.04).toBe(false);
        }
      }
    }
  }
  {
    const source = { ...input(), fixedFaces: true };
    source.rectangle = [[0, 0], [42.01, 0], [42.01, 30.01], [0, 30.01]];
    source.floorHeights[2] = 4.51;
    const plan = family.plan(source), layout = host(plan, source);
    const target = layout.floors[1]!.assembly!.sections.find(s => s.id.startsWith('fb:0:0:') && s.id.endsWith(':panel'))!;
    layout.carved.push({ aperture: { face: 0, floor: 1 }, facePoly: [[target.offset, 4.5], [target.offset + target.width, 4.5], [target.offset + target.width, 22.5], [target.offset, 22.5]] } as Layout['carved'][number]);
    const builder = new MeshBuilder();
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.parts.find(p => p.name === 'faceted-bays:1/screens')!.prims.has(family.materials!.screen!)).toBe(false);
    for (const part of builder.parts) for (const prim of part.prims.values()) for (let i = 0; i < prim.positions.length; i += 3) {
      const x = prim.positions[i]!, y = prim.positions[i + 1]!, z = prim.positions[i + 2]!;
      expect(contained([x, z], source.rectangle)).toBe(true);
      expect(z < 0.25 && x > target.offset + 1e-6 && x < target.offset + target.width - 1e-6 && y > 4.5 + 1e-6 && y < 22.5 - 1e-6).toBe(false);
    }
  }
  });
});
