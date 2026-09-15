import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type FloorLayout, type Layout, type Point } from '../api.ts';
import { family } from './index.ts';

const input = (): FamilyInput => JSON.parse(readFileSync(new URL('./fixtures/reference.json', import.meta.url), 'utf8'));

describe('portal-pier family public contract', () => {
  it('fits repeatable slots, solid ground and complete floor groups without moving floor heights', () => {
    const request = input(), result = family.plan(request);
    expect(result).toEqual(family.plan(request));
    expect(result.extent).toEqual({ width: 31, depth: 23 });
    expect(result.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 0], [1, 3], [4, 6], [7, 7]]);
    expect(result.floors).toHaveLength(request.floorHeights.length);
    expect(result.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    expect(result.floors[1]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    expect(result.floors[2]!.sections.some(s => s.windows?.length === 1)).toBe(true);
    for (const floor of result.floors) for (let edge = 0; edge < 4; edge++) {
      const sections = floor.sections.filter(s => s.edge === edge);
      let cursor = 0;
      for (const s of sections) {
        expect(s.offset).toBeCloseTo(cursor);
        cursor += s.width;
        if (s.technique === 'paired-glass') expect(s.width).toBe(5);
        for (const w of s.windows ?? []) {
          expect(w.offset).toBeGreaterThan(0);
          expect(w.offset + w.width).toBeLessThan(s.width);
          expect(w.sill + w.height).toBeLessThan(request.floorHeights[floor.floor]!);
        }
      }
      expect(cursor).toBeCloseTo(edge % 2 === 0 ? result.extent.width : result.extent.depth);
    }
  });

  it('preserves rotated infrastructure faces verbatim and suppresses outward relief', () => {
    const request = input();
    request.rectangle = request.rectangle.map(([x, z]) => [10 + x * 0.8 - z * 0.6, -2 + x * 0.6 + z * 0.8]) as FamilyInput['rectangle'];
    request.fixedFaces = true;
    const result = family.plan(request);
    for (const floor of result.floors) {
      expect(floor.outline).toEqual(request.rectangle);
      expect(floor.sections.filter(s => s.technique === 'paired-solid').every(s => s.border.depth === 0)).toBe(true);
    }
  });

  it('rejects invalid rectangle and height inputs at its entry point', () => {
    const request = input();
    expect(() => family.plan({ ...request, rectangle: [[0, 0], [9, 0], [9, 9], [0, 9]] })).toThrow(RangeError);
    expect(() => family.plan({ ...request, rectangle: [...request.rectangle].reverse() as FamilyInput['rectangle'] })).toThrow(RangeError);
    expect(() => family.plan({ ...request, floorHeights: [2.5] })).toThrow(RangeError);
    expect(() => family.plan({ ...request, floorHeights: [] })).toThrow(RangeError);
  });

  it('emits bounded panels, open entrance reservations and real lights through decorate', () => {
    const request = input(), result = family.plan(request), layout = hostLayout(request, result);
    layout.carved.push({
      aperture: { id: 'bridge', buildingId: 'portal-test', floor: 1, face: 0, kind: 'bridge', u: 15.5, base: 4.5,
        width: 2, height: 3, shape: 'rect', linkId: 'bridge-test', cut: { polygon: [], axisDir: [0, 0, 1] } },
      facePoly: [[15.5, 4.5], [17.5, 4.5], [17.5, 7.5], [15.5, 7.5]],
    });
    const builder = new MeshBuilder();
    builder.floor = -8;
    const decoration = family.decorate!({ builder, layout, material: role => `test/${role}/mid` });
    expect(builder.floor).toBe(-8);
    expect(builder.parts.some(p => p.prims.has('test/portal-trim/mid'))).toBe(true);
    const portalFloors = builder.parts.filter(p => p.prims.has('test/portal-trim/mid')).map(p => p.floor);
    expect(portalFloors).toEqual([0, 1]);
    for (const part of builder.parts) {
      const stone = part.prims.get('test/portal-trim/mid');
      if (stone) expect(stone.uvs.every(uv => uv >= 0 && uv <= 1)).toBe(true);
    }
    expect(layout.lights.length).toBeGreaterThan(0);
    expect(layout.lights.every(l => l.lumens! > 1000 && l.range === 14)).toBe(true);
    expect(decoration?.instances?.map(i => i.kind)).toEqual(['palm', 'shrub', 'palm', 'shrub']);
    for (const instance of decoration?.instances ?? []) {
      expect(instance.position[0] - instance.size[0] / 2).toBeGreaterThanOrEqual(0);
      expect(instance.position[0] + instance.size[0] / 2).toBeLessThanOrEqual(35);
      expect(instance.position[2] - instance.size[2] / 2).toBeGreaterThanOrEqual(0);
      expect(instance.position[2] + instance.size[2] / 2).toBeLessThanOrEqual(27);
    }
    for (const part of builder.parts) for (const primitive of part.prims.values()) {
      expect(primitive.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < primitive.positions.length; i += 3) {
        const [x, y, z] = primitive.positions.slice(i, i + 3) as [number, number, number];
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(35);
        expect(z).toBeGreaterThanOrEqual(0); expect(z).toBeLessThanOrEqual(27);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(36);
        const door = layout.floors[0]!.openings[0]!;
        const [originX, originZ] = layout.floors[0]!.outline[0]!;
        const insidePassage = part.floor === 0 && z < originZ && x > originX + door.offset && x < originX + door.offset + door.width && y > 0.03 && y < door.height;
        expect(insidePassage).toBe(false);
      }
      for (let i = 0; i < primitive.indices.length; i += 3) {
        const triangle = primitive.indices.slice(i, i + 3).map(vertex => primitive.positions.slice(vertex * 3, vertex * 3 + 3));
        const x = triangle.reduce((sum, p) => sum + p[0]!, 0) / 3;
        const y = triangle.reduce((sum, p) => sum + p[1]!, 0) / 3;
        const z = triangle.reduce((sum, p) => sum + p[2]!, 0) / 3;
        const [originX, originZ] = layout.floors[0]!.outline[0]!;
        expect(z < originZ && x > originX + 15.5 && x < originX + 17.5 && y > 4.5 && y < 7.5).toBe(false);
      }
    }
    const count = layout.lights.length;
    family.decorate!({ builder: new MeshBuilder(), layout, material: role => `test/${role}/mid` });
    expect(layout.lights).toHaveLength(count);
  });
});

function hostLayout(request: FamilyInput, assembly: FamilyPlan): Layout {
  let elevation = 0;
  const floors: FloorLayout[] = assembly.floors.map(plan => {
    const floor: FloorLayout = { index: plan.floor, kind: 'office', elevation, height: request.floorHeights[plan.floor]!,
      outline: plan.outline.map(p => [...p] as Point), assembly: plan, openings: [] };
    for (const section of plan.sections) for (const w of section.windows ?? []) floor.openings.push({
      id: `${floor.index}:${section.id}`, sectionId: section.id, kind: 'window', edge: section.edge,
      offset: section.offset + w.offset, width: w.width, sill: w.sill, height: w.height, material: 'test/glass/mid',
    });
    if (plan.floor === 0) {
      const section = plan.sections.find(s => s.edge === 0 && s.technique === 'paired-glass')!;
      floor.openings.push({ id: 'entry', sectionId: section.id, kind: 'door', doorRole: 'main', edge: 0,
        offset: section.offset + 1, width: 3, sill: 0, height: 3.5, material: 'test/door/mid' });
    }
    elevation += floor.height;
    return floor;
  });
  return { assembly: { ...assembly, architecture: 'paired-rectangular' }, floors, carved: [], lights: [] } as unknown as Layout;
}
