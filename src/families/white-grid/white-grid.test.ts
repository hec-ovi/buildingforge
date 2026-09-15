import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout } from '../api.ts';
import reference from './fixtures/reference.json' with { type: 'json' };
import { family } from './index.ts';

const input = reference as FamilyInput;

function decorationLayout(plan: FamilyPlan, source: FamilyInput): Layout {
  let elevation = 0;
  const floors = plan.floors.map(assembly => {
    const height = source.floorHeights[assembly.floor]!;
    const floor = { assembly, index: assembly.floor, kind: 'offices', elevation, height, outline: assembly.outline, openings: [] };
    elevation += height;
    return floor;
  });
  return {
    assembly: { ...plan, architecture: family.id }, floors, carved: [],
    request: { seed: source.seed, buildingId: 'white-grid-test', theme: 'cyberpunk',
      building: { type: 'offices', tier: 'mid', floors: source.floorHeights.length },
      parcel: { footprint: source.rectangle, accessPoint: source.rectangle[0], maxHeight: elevation } },
  } as unknown as Layout;
}

describe('white-grid family contract', () => {
  it('fits complete eight-pane bays, opaque ground and consecutive three-floor braces deterministically', () => {
    const plan = family.plan(input);
    expect(plan).toEqual(family.plan(input));
    expect(plan.extent).toEqual({ width: 31.5, depth: 16.5 });
    const offCentre = family.plan({ ...input, rectangle: [[0, 0], [20, 0], [20, 20], [0, 20]] });
    expect(offCentre.floors[0]!.outline.flat().every(value => Number.isInteger(value * 2))).toBe(true);
    expect(plan.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 0], [1, 3], [4, 6]]);
    for (const floor of plan.floors) {
      for (let edge = 0; edge < 4; edge++) {
        const sections = floor.sections.filter(s => s.edge === edge);
        let cursor = 0;
        for (const section of sections) {
          expect(section.offset).toBeCloseTo(cursor);
          cursor += section.width;
          expect(section.width).toBe(section.technique === 'paired-pier' ? 1.5 : 13.5);
          expect(section.windows?.length).toBe(floor.floor === 0 || section.technique === 'paired-pier' ? 0 : 1);
          for (const window of section.windows ?? []) expect(window.panes).toEqual({ cols: 8, rows: 1 });
        }
        expect(cursor).toBe(edge % 2 ? plan.extent.depth : plan.extent.width);
      }
      expect(floor.balconySections).toEqual([]);
    }
  });

  it('preserves fixed rotated faces, exact edge partitions and caller floor heights', () => {
    const fixed: FamilyInput = { rectangle: [[7, 3], [19, 19], [3, 31], [-9, 15]],
      floorHeights: [5, 4, 5, 4, 6, 4], fixedFaces: true, seed: 'fixed' };
    const plan = family.plan(fixed);
    expect(plan.extent).toEqual({ width: 20, depth: 20 });
    for (const floor of plan.floors) {
      expect(floor.outline).toEqual(fixed.rectangle);
      for (let edge = 0; edge < 4; edge++) {
        expect(floor.sections.filter(s => s.edge === edge).reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(20);
      }
      for (const section of floor.sections) for (const window of section.windows ?? []) {
        expect(window.sill + window.height).toBeCloseTo(fixed.floorHeights[floor.floor]! - section.border.top);
        expect(window.panes).toEqual({ cols: 10, rows: 1 });
      }
    }
    expect(plan.groups).toMatchObject([{ fromFloor: 0, toFloor: 0 }, { fromFloor: 1, toFloor: 4 }, { fromFloor: 5, toFloor: 5 }]);
    expect(fixed.rectangle).toEqual([[7, 3], [19, 19], [3, 31], [-9, 15]]);
  });

  it('rejects impossible plates and floor stacks with RangeError', () => {
    const invalid: FamilyInput[] = [
      { ...input, floorHeights: [5, 4.5, 4.5] },
      { ...input, floorHeights: [5, 4.5, 2, 4.5] },
      { ...input, floorHeights: [5, 4.5, NaN, 4.5] },
      { ...input, rectangle: [[0, 0], [9, 0], [9, 10], [0, 10]] },
      { ...input, rectangle: [[0, 0], [16.5, 0], [16.5, 16.5], [0, 16.5]] },
      { ...input, rectangle: [[0, 0], [20, 0], [19, 20], [0, 20]] },
      { ...input, rectangle: [[0, 0], [0, 20], [20, 20], [20, 0]] },
      { ...input, rectangle: [[0, 0], [Infinity, 0], [20, 20], [0, 20]] },
    ];
    for (const bad of invalid) expect(() => family.plan(bad)).toThrow(RangeError);
  });

  it('emits solid diagonal panels and metal bands within the parcel, with restored floor ownership', () => {
    const plan = family.plan(input), builder = new MeshBuilder();
    builder.floor = 42;
    family.decorate!({ builder, layout: decorationLayout(plan, input), material: role => family.materials![role]! });
    expect(builder.floor).toBe(42);
    const braces = builder.parts.filter(p => p.name.includes(':brace:'));
    expect(braces.length).toBeGreaterThan(0);
    expect(builder.materialSlots()).toContain('cyberpunk/facade-chrome/mid#native');
    for (const part of builder.parts) {
      expect(part.floor).toBeGreaterThanOrEqual(0);
      for (const prim of part.prims.values()) {
        expect(prim.positions.every(Number.isFinite)).toBe(true);
        expect(prim.normals.every(Number.isFinite)).toBe(true);
        for (let i = 0; i < prim.positions.length; i += 3) {
          expect(prim.positions[i]).toBeGreaterThanOrEqual(0);
          expect(prim.positions[i]).toBeLessThanOrEqual(32.5);
          expect(prim.positions[i + 2]).toBeGreaterThanOrEqual(0);
          expect(prim.positions[i + 2]).toBeLessThanOrEqual(17.5);
        }
      }
      const chrome = part.prims.get('cyberpunk/facade-chrome/mid#native');
      if (chrome) expect(chrome.uvs.every(uv => uv >= -1e-7 && uv <= 1 + 1e-7)).toBe(true);
    }
    const front = braces.find(p => p.name.startsWith('white-grid:2:0:'))!;
    const prim = [...front.prims.values()][0]!;
    const depths = prim.positions.filter((_, i) => i % 3 === 2);
    expect(Math.max(...depths) - Math.min(...depths)).toBeCloseTo(0.14);
  });

  it('cuts bridge and door reservations through the actual decoration', () => {
    const source: FamilyInput = { ...input, fixedFaces: true };
    const plan = family.plan(source), layout = decorationLayout(plan, source), builder = new MeshBuilder();
    const bridge = { id: 'bridge-test', buildingId: 'white-grid-test', floor: 2, face: 0, kind: 'bridge' as const,
      u: 3, base: 9.5, width: 3, height: 3, shape: 'rect' as const,
      cut: { polygon: [[3, 9.5, 0], [6, 9.5, 0], [6, 12.5, 0], [3, 12.5, 0]], axisDir: [0, 0, -1] }, linkId: 'bridge' };
    layout.request.apertures = [bridge as NonNullable<Layout['request']['apertures']>[number]];
    layout.carved = [{ aperture: layout.request.apertures[0]!, facePoly: [[3, 9.5], [6, 9.5], [6, 12.5], [3, 12.5]] }];
    layout.floors[0]!.openings.push({ id: 'entry', kind: 'door', edge: 0, offset: 3, width: 3, height: 3, sill: 0 });
    family.decorate!({ builder, layout, material: role => family.materials![role]! });
    for (const part of builder.parts.filter(p => /^white-grid:(0|2):0:/.test(p.name))) {
      for (const prim of part.prims.values()) {
        for (let i = 0; i < prim.positions.length; i += 3) {
          const x = prim.positions[i]!, y = prim.positions[i + 1]!, z = prim.positions[i + 2]!;
          const inside = x > 3 && x < 6 && (part.floor === 0 ? y >= 0 && y < 3 : y > 9.5 && y < 12.5);
          expect(inside).toBe(false);
          expect(z).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
