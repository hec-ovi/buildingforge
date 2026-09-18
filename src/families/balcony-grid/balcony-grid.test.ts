import { describe, expect, it } from 'vitest';
import { FacadeField, MeshBuilder, type FamilyInput, type FamilyPlan, type FloorLayout, type Layout } from '../api.ts';
import { family } from './index.ts';
import p117 from './fixtures/p117.json' with { type: 'json' };
import { intersections } from './simple-polygon.fixture.ts';

const input = (): FamilyInput => ({ rectangle: [[0, 0], [37.5, 0], [37.5, 37.5], [0, 37.5]],
  floorHeights: [4.5, 4.5, 6, 4.5], seed: 'balcony-grid-contract' });

function layout(plan: FamilyPlan, request: FamilyInput): Layout {
  let elevation = 0;
  const floors: FloorLayout[] = plan.floors.map(assembly => {
    const height = request.floorHeights[assembly.floor]!;
    const floor: FloorLayout = { index: assembly.floor, kind: 'office', height, elevation, outline: assembly.outline,
      assembly, openings: assembly.floor === 0 ? [] : assembly.sections.filter(s => s.technique === 'paired-glass').flatMap(s =>
        (s.spans ?? [{ edge: s.edge, offset: s.offset, width: s.width, sectionOffset: 0 }]).map((span, sectionSpan) => ({
        id: `w:${assembly.floor}:${s.id}:${sectionSpan}`, kind: 'window', edge: span.edge, sectionId: s.id, sectionSpan,
        offset: span.offset + 0.025, width: span.width - 0.05, sill: 0.25, height: height - 0.5,
        scenery: { nodeId: `scenery:${assembly.floor}`, depth: 2.8, state: 'lit', lightLayout: 'strips', lights: [] },
      }))) };
    elevation += height;
    return floor;
  });
  return { floors, carved: [] } as unknown as Layout;
}

describe('balcony-grid family contract', () => {
  it('plans separated galleries, paired glazing, the curved end and fixed faces, and rejects impossible input', () => {
  {
    const real = p117 as FamilyInput;
    const minimum = { ...real, rectangle: [[0, 0], [20.5, 0], [20.5, 20.5], [0, 20.5]] } as FamilyInput;
    const rotated = { ...real, rectangle: real.rectangle.map(([x, z]) =>
      [(x - z) / Math.SQRT2, (x + z) / Math.SQRT2]) } as FamilyInput;
    for (const request of [real, minimum, rotated]) {
      const result = family.plan(request);
      expect(result.floors).toHaveLength(13);
      for (const floor of result.floors) expect(intersections(floor.outline)).toEqual([]);
      expect(result.floors[1]!.sections.filter(s => s.id.startsWith('bg:glass:')).every(s => s.width === 10)).toBe(true);
      expect(result.floors[1]!.sections.filter(s => s.id.startsWith('bg:gallery:') && s.technique === 'paired-glass')
        .every(s => s.width === 5)).toBe(true);
      expect(result.floors[1]!.sections.filter(s => s.id.startsWith('bg:corner:curve:'))).toHaveLength(4);
    }
    expect(family.plan(real).extent).toEqual({ width: 54, depth: 20 });
  }
  {
    const request = input(), result = family.plan(request);
    expect(family.id).toBe('balcony-grid');
    expect(result).toEqual(family.plan(request));
    expect(result.extent).toEqual({ width: 37, depth: 37 });
    expect(result.floors.map(f => f.floor)).toEqual([0, 1, 2, 3]);
    expect(result.groups).toEqual([{ id: 0, fromFloor: 0, toFloor: 0, width: 37, depth: 37 },
      { id: 1, fromFloor: 1, toFloor: 3, width: 37, depth: 37 }]);
    expect(result.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    for (const floor of result.floors) {
      expect(floor.balconySections).toEqual([]);
      for (const [edge] of floor.outline.entries()) {
        const fields = floor.sections.flatMap<{ edge: number; offset: number; width: number }>(s => s.spans ?? [s])
          .filter(s => s.edge === edge).sort((a, b) => a.offset - b.offset);
        let end = 0;
        for (const field of fields) { expect(field.offset).toBeCloseTo(end); end += field.width; }
        expect(end).toBeCloseTo(new FacadeField(floor.outline, edge).length);
      }
    }
    const upper = result.floors[1]!;
    expect(upper.sections.filter(s => s.id.startsWith('bg:glass:')).every(s => s.width === 10)).toBe(true);
    const galleries = upper.sections.filter(s => s.technique === 'paired-glass' && s.id.startsWith('bg:gallery:'));
    expect(galleries).toHaveLength(8);
    expect(galleries.every(s => s.width === 5)).toBe(true);
  }
  {
    const result = family.plan(input()), floor = result.floors[1]!;
    const fields = floor.sections.filter(s => s.id.startsWith('bg:corner:curve:'));
    expect(result.corners[2]).toBe('rounded');
    expect(fields).toHaveLength(4);
    expect(fields.every(s => s.technique === 'paired-glass' && s.spans?.length === 3 && s.panes?.cols === 1)).toBe(true);
    const spans = fields.flatMap(s => s.spans!);
    for (const span of spans) {
      const point = floor.outline[span.edge]!;
      expect(Math.hypot(point[0] - 32.25, point[1] - 32.25)).toBeCloseTo(5);
    }
    const last = spans.at(-1)!;
    expect(floor.outline[(last.edge + 1) % floor.outline.length]).toEqual([32.25, 37.25]);
    expect(floor.outline[spans[0]!.edge]).toEqual([37.25, 32.25]);
    expect(floor.sections.filter(s => s.id.startsWith('bg:corner:leg:')).map(s => s.width)).toEqual([6, 6]);
  }
  {
    const request = input();
    request.rectangle = request.rectangle.map(([x, z]) => [70 + (x - z) / Math.SQRT2, -40 + (x + z) / Math.SQRT2]) as FamilyInput['rectangle'];
    request.fixedFaces = true;
    const result = family.plan(request), scene = layout(result, request), builder = new MeshBuilder();
    expect(result.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(request.rectangle))).toBe(true);
    expect(result.floors.every(f => f.sections.every(s => s.edge >= 0 && s.edge < 4))).toBe(true);
    const corner = result.floors[1]!.sections.filter(s => s.id.startsWith('bg:corner:fixed:'));
    expect(corner.map(s => s.edge)).toEqual([1, 2]);
    expect(corner.every(s => s.technique === 'paired-glass' && s.width === 5)).toBe(true);
    family.decorate!({ builder, layout: scene, material: role => family.materials![role]! });
    for (const part of builder.parts) for (const primitive of part.prims.values()) {
      for (let i = 0; i < primitive.positions.length; i += 3) {
        const x = primitive.positions[i]! - 70, z = primitive.positions[i + 2]! + 40;
        expect((x + z) / Math.SQRT2).toBeGreaterThanOrEqual(-1e-7);
        expect((x + z) / Math.SQRT2).toBeLessThanOrEqual(37.5 + 1e-7);
        expect((z - x) / Math.SQRT2).toBeGreaterThanOrEqual(-1e-7);
        expect((z - x) / Math.SQRT2).toBeLessThanOrEqual(37.5 + 1e-7);
      }
    }
  }
  {
    const invalid: Partial<FamilyInput>[] = [
      { rectangle: [[0, 0], [17, 0], [17, 37.5], [0, 37.5]] },
      { rectangle: [[0, 0], [0, 37.5], [37.5, 37.5], [37.5, 0]] },
      { rectangle: [[0, 0], [37.5, 0], [35, 37.5], [0, 37.5]] },
      { rectangle: [[0, 0], [Infinity, 0], [37.5, 37.5], [0, 37.5]] },
      { floorHeights: [4.5] },
      { floorHeights: [4.5, 2.5] },
    ] as Partial<FamilyInput>[];
    for (const bad of invalid) expect(() => family.plan({ ...input(), ...bad }), JSON.stringify(bad)).toThrow(RangeError);
  }
  });

  it('builds finite owned gallery geometry, publishes fixture lights, and omits reservations and dark emitters', () => {
    const request = input(), result = family.plan(request), scene = layout(result, request), builder = new MeshBuilder();
    const floor = scene.floors[1]!;
    const galleries = floor.assembly!.sections.filter(s => s.technique === 'paired-glass' && s.id.startsWith('bg:gallery:'));
    const reserved = galleries[0]!, dark = galleries[1]!;
    floor.openings.push({ id: 'bridge', kind: 'aperture', edge: reserved.edge, offset: 0.2, width: 3, sill: 0, height: 3 });
    floor.openings.find(o => o.sectionId === dark.id)!.scenery!.state = 'dark';
    builder.floor = -4;
    family.decorate!({ builder, layout: scene, material: role => family.materials![role]! });
    expect(builder.floor).toBe(-4);
    expect(builder.parts.some(p => p.name === `balcony-grid:1:${reserved.id}`)).toBe(false);
    expect(builder.parts.some(p => p.name === `balcony-grid:1:${dark.id}`)).toBe(true);
    expect(builder.parts.every(p => p.floor !== undefined && p.floor >= 0)).toBe(true);
    expect(floor.openings.find(o => o.sectionId === dark.id)!.scenery!.lights).toEqual([]);
    expect(floor.openings.find(o => o.sectionId === galleries[2]!.id)!.scenery!.lights).toHaveLength(4);
    for (const part of builder.parts) for (const primitive of part.prims.values()) {
      expect(primitive.positions.every(Number.isFinite)).toBe(true);
      expect(primitive.normals.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < primitive.positions.length; i += 3) {
        expect(primitive.positions[i]!).toBeGreaterThanOrEqual(0.25 - 1e-7);
        expect(primitive.positions[i]!).toBeLessThanOrEqual(37.25 + 1e-7);
        expect(primitive.positions[i + 2]!).toBeGreaterThanOrEqual(0.25 - 1e-7);
        expect(primitive.positions[i + 2]!).toBeLessThanOrEqual(37.25 + 1e-7);
      }
    }
  });
});
