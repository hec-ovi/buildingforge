import { describe, expect, it } from 'vitest';
import { FacadeField, MeshBuilder, type FamilyInput, type FamilyPlan, type FloorLayout, type Layout } from '../api.ts';
import { family } from './index.ts';

const request = (): FamilyInput => ({ rectangle: [[0, 0], [28, 0], [28, 28], [0, 28]], floorHeights: [3.6, 3.1, 3.5, 2.8], seed: 'courtyard-contract' });

function scene(input: FamilyInput, plan: FamilyPlan): Layout {
  let elevation = 0;
  const floors: FloorLayout[] = plan.floors.map(assembly => {
    const height = input.floorHeights[assembly.floor]!, base = elevation;
    elevation += height;
    return { index: assembly.floor, kind: 'residential', elevation: base, height, outline: assembly.outline, assembly,
      openings: assembly.sections.flatMap(s => (s.windows ?? []).map((w, i) => ({
        id: `w:${assembly.floor}:${s.id}:${i}`, kind: 'window' as const, sectionId: s.id, edge: s.edge,
        offset: s.offset + w.offset, width: w.width, sill: w.sill, height: w.height,
      }))) };
  });
  return { request: { seed: input.seed, parcel: { footprint: input.rectangle } }, floors, carved: [], assembly: plan } as unknown as Layout;
}

describe('residential courtyard family', () => {
  it('reserves front circulation, retains complete bays and aligns every actual floor window', () => {
    const input = request(), plan = family.plan(input);
    expect(plan).toEqual(family.plan(input));
    expect(plan.extent).toEqual({ width: 26.7, depth: 23.35 });
    expect(plan.floors[0]!.outline[0]).toEqual([.65, 4]);
    for (const floor of plan.floors) {
      expect(floor.outline).toEqual(plan.floors[0]!.outline);
      expect(floor.sections.find(s => s.id === 'rc:0:0')?.offset).toBe(0);
      for (let edge = 0; edge < 4; edge++) {
        let end = 0;
        for (const section of floor.sections.filter(s => s.edge === edge)) {
          expect(section.offset).toBeCloseTo(end);
          expect(section.width).toBeGreaterThanOrEqual(4);
          expect(section.width).toBeLessThanOrEqual(5);
          end += section.width;
          for (const w of section.windows ?? []) {
            expect(w.offset).toBeGreaterThanOrEqual(.7);
            expect(w.offset + w.width).toBeLessThanOrEqual(section.width - .69);
            expect(w.sill + w.height).toBeLessThan(input.floorHeights[floor.floor]!);
            expect(w.panes).toEqual({ cols: 3, rows: 2 });
          }
        }
        expect(end).toBeCloseTo(new FacadeField(floor.outline, edge).length);
      }
    }
    expect(plan.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
  });

  it('preserves exact fixed faces and the minimum footprint, and rejects malformed or unbuildable inputs', () => {
    const fixed = { ...request(), rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]], fixedFaces: true } as FamilyInput;
    expect(family.plan(fixed).floors.every(f => JSON.stringify(f.outline) === JSON.stringify(fixed.rectangle))).toBe(true);
    const minimum = { ...request(), rectangle: [[0, 0], [17.3, 0], [17.3, 20.65], [0, 20.65]] } as FamilyInput;
    expect(family.plan(minimum).extent.width).toBeCloseTo(16);
    expect(family.plan(minimum).extent.depth).toBeCloseTo(16);
    const invalid: Partial<FamilyInput>[] = [{ floorHeights: [3.6] }, { floorHeights: [3.6, 2.5] },
      { rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]] },
      { rectangle: [[0, 0], [0, 28], [28, 28], [28, 0]] },
      { rectangle: [[0, 0], [28, 0], [27, 28], [0, 28]] },
      { rectangle: [[0, 0], [Infinity, 0], [28, 28], [0, 28]] }];
    for (const change of invalid) expect(() => family.plan({ ...request(), ...change })).toThrow(RangeError);
  });

  it('builds fitted shutters, grilles and supported canopies with no ornaments in the stair frontage', () => {
    const input = request(), plan = family.plan(input), layout = scene(input, plan), builder = new MeshBuilder();
    builder.floor = -8;
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.floor).toBe(-8);
    for (const kind of ['shutters', 'grille', 'canopy', 'drain']) expect(builder.parts.some(p => p.name.startsWith(`courtyard:${kind}:`))).toBe(true);
    for (const part of builder.parts) for (const primitive of part.prims.values()) {
      expect(primitive.positions.every(Number.isFinite)).toBe(true);
      expect(primitive.normals.every(Number.isFinite)).toBe(true);
      expect(part.floor).toBeGreaterThanOrEqual(0);
      for (let i = 0; i < primitive.positions.length; i += 3) {
        expect(primitive.positions[i]!).toBeGreaterThanOrEqual(-1e-7);
        expect(primitive.positions[i]!).toBeLessThanOrEqual(28 + 1e-7);
        expect(primitive.positions[i + 2]!).toBeGreaterThanOrEqual(3.8 - 1e-7);
        expect(primitive.positions[i + 2]!).toBeLessThanOrEqual(28 + 1e-7);
      }
      if (part.name.includes('shutters') || part.name.includes('grille') || part.name.includes('canopy')) expect(part.name).not.toContain(':rc:0:');
    }
  });

  it('keeps all fixed-face geometry inside a rotated parcel and omits projecting ornaments', () => {
    const input = request();
    input.fixedFaces = true;
    input.rectangle = input.rectangle.map(([x, z]) => [70 + (x - z) / Math.SQRT2, -30 + (x + z) / Math.SQRT2]) as FamilyInput['rectangle'];
    const layout = scene(input, family.plan(input)), builder = new MeshBuilder();
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.parts.every(p => p.name.startsWith('courtyard:skin:'))).toBe(true);
    for (const part of builder.parts) for (const primitive of part.prims.values()) for (let i = 0; i < primitive.positions.length; i += 3) {
      const x = primitive.positions[i]! - 70, z = primitive.positions[i + 2]! + 30;
      expect((x + z) / Math.SQRT2).toBeGreaterThanOrEqual(-1e-6);
      expect((x + z) / Math.SQRT2).toBeLessThanOrEqual(28 + 1e-6);
      expect((z - x) / Math.SQRT2).toBeGreaterThanOrEqual(-1e-6);
      expect((z - x) / Math.SQRT2).toBeLessThanOrEqual(28 + 1e-6);
    }
  });

  it('sheds repeat ornaments through the host detail ladder while retaining supported canopy and shutter exemplars', () => {
    const input = request(), layout = scene(input, family.plan(input));
    const full = new MeshBuilder(), reduced = new MeshBuilder();
    family.decorate!({ builder: full, layout, material: role => family.materials![role]! });
    layout.detail = new Set(['fittings', 'weathering', 'housings', 'fixtures', 'coverings']);
    family.decorate!({ builder: reduced, layout, material: role => family.materials![role]! });
    const triangles = (builder: MeshBuilder) => builder.parts.reduce((sum, p) => sum
      + [...p.prims.values()].reduce((sum, primitive) => sum + primitive.indices.length / 3, 0), 0);
    expect(triangles(reduced)).toBeLessThan(triangles(full) * .45);
    expect(reduced.parts.filter(p => p.name.includes(':shutters:'))).toHaveLength(1);
    expect(reduced.parts.filter(p => p.name.includes(':grille:'))).toHaveLength(1);
    expect(reduced.parts.some(p => p.name.includes(':canopy:'))).toBe(true);
    expect(reduced.parts.filter(p => p.name.includes(':canopy:')).every(p => p.floor! % 2 === 1)).toBe(true);
    const laundry = reduced.parts.filter(p => p.name.includes(':clothesline:'));
    expect(laundry).toHaveLength(1);
    expect([...laundry[0]!.prims.values()].reduce((sum, p) => sum + p.indices.length / 3, 0)).toBeLessThan(250);
    const lowerFloor = layout.floors[1]!;
    for (const primitive of laundry[0]!.prims.values()) for (let i = 1; i < primitive.positions.length; i += 3) {
      expect(primitive.positions[i]!).toBeGreaterThan(lowerFloor.elevation + .15);
      expect(primitive.positions[i]!).toBeLessThan(lowerFloor.elevation + .92);
    }
    expect(reduced.parts.filter(p => p.name.includes(':skin:')).length).toBe(full.parts.filter(p => p.name.includes(':skin:')).length);
  });

  it('cuts permanent skin around stair doors and suppresses ornaments in an explicit bridge reservation', () => {
    const input = request(), layout = scene(input, family.plan(input)), floor = layout.floors[1]!;
    floor.openings = floor.openings.filter(o => o.sectionId !== 'rc:0:0');
    floor.openings.push({ id: 'stair-door', kind: 'door', edge: 0, offset: 1.65, width: 1.1, sill: 0, height: 2.2 });
    const window = floor.openings.find(o => o.edge === 1)!;
    floor.openings.push({ id: 'bridge-reservation', kind: 'aperture', edge: 1, offset: window.offset - .7,
      width: window.width + 1.4, sill: 0, height: floor.height });
    const builder = new MeshBuilder();
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.parts.filter(p => !p.name.startsWith('courtyard:skin:')).some(p => p.name.includes(window.id))).toBe(false);
    const part = builder.parts.find(p => p.name === 'courtyard:skin:1:0')!;
    for (const primitive of part.prims.values()) for (let i = 0; i < primitive.positions.length; i += 3) {
      const u = primitive.positions[i]! - .65, y = primitive.positions[i + 1]! - floor.elevation;
      expect(u > 1.65 && u < 2.75 && y > 0 && y < 2.2).toBe(false);
    }
  });
});
