import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/frontage.json' with { type: 'json' };
import { family } from '../index.ts';
import { MeshBuilder } from '../../api.ts';
import type { FamilyInput, FamilyPlan, Layout, Point } from '../../api.ts';

const input = fixture as FamilyInput;

function layoutFor(request: FamilyInput, plan: FamilyPlan): Layout {
  let elevation = 0;
  return {
    request: { seed: request.seed, parcel: { footprint: request.rectangle } },
    assembly: { ...plan, architecture: family.id }, carved: [],
    floors: plan.floors.map(f => {
      const height = request.floorHeights[f.floor]!;
      const result = { index: f.floor, kind: 'office', elevation, height, outline: f.outline, assembly: f, openings: [] };
      elevation += height;
      return result;
    }),
  } as unknown as Layout;
}

describe('mirror-shutters public family contract', () => {
  it('fits complete frontage cells on free and rotated bound plates, and rejects impossible input', () => {
  {
    const variable = { ...input, floorHeights: [4.5, 5, 3.5, 4.5, 4, 6] };
    const plan = family.plan(variable);
    expect(plan).toEqual(family.plan(variable));
    expect(plan.extent).toEqual({ width: 49, depth: 29 });
    expect(plan.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 0], [1, 4], [5, 5]]);
    expect(plan.floors.every(f => !f.balconySections.length)).toBe(true);
    for (const floor of plan.floors) for (let edge = 0; edge < 4; edge++) {
      const sections = floor.sections.filter(s => s.edge === edge);
      let offset = 0;
      for (const section of sections) {
        expect(section.offset).toBeCloseTo(offset, 8);
        offset += section.width;
        for (const w of section.windows ?? []) {
          expect(w.offset).toBeGreaterThanOrEqual(0);
          expect(w.offset + w.width).toBeLessThanOrEqual(section.width);
          expect(w.sill + w.height).toBeLessThanOrEqual(variable.floorHeights[floor.floor]! - 0.49);
        }
      }
      expect(offset).toBeCloseTo(edge % 2 ? plan.extent.depth : plan.extent.width, 8);
    }
    expect(plan.floors[0]!.sections.every(s => !s.windows?.length)).toBe(true);
    const upper = plan.floors[1]!;
    expect(upper.sections.filter(s => s.edge === 0 && s.id.includes(':bank:'))).toHaveLength(2);
    expect(upper.sections.find(s => s.edge === 0 && s.id.includes(':spine:'))?.windows).toHaveLength(3);
    expect(upper.sections.find(s => s.edge === 0 && s.id.includes(':spine:'))!.windows!.every(w => w.panes?.cols === 1)).toBe(true);
    expect(upper.sections.find(s => s.id.includes(':bank:'))!.windows![0]!.height)
      .toBeGreaterThan(upper.sections.find(s => s.id.includes(':ribbon:'))!.windows![0]!.height);
  }
  {
    const transform = ([x, z]: Point): Point => [8 + x * 0.8 - z * 0.6, -11 + x * 0.6 + z * 0.8];
    const rectangle = ([[0, 0], [37.75, 0], [37.75, 22.25], [0, 22.25]] as Point[]).map(transform) as FamilyInput['rectangle'];
    const plan = family.plan({ ...input, rectangle, fixedFaces: true });
    for (const floor of plan.floors) expect(floor.outline).toEqual(rectangle);
    expect(plan.extent.width).toBeCloseTo(37.75, 8);
    expect(plan.extent.depth).toBeCloseTo(22.25, 8);
  }
  {
    expect(() => family.plan({ ...input, rectangle: [[0, 0], [28, 0], [28, 20], [0, 20]] })).toThrow(RangeError);
    expect(() => family.plan({ ...input, rectangle: [[0, 0], [54, 0], [53, 34], [0, 34]] })).toThrow(RangeError);
    expect(() => family.plan({ ...input, floorHeights: [4.5] })).toThrow(RangeError);
    expect(() => family.plan({ ...input, floorHeights: [4.5, NaN] })).toThrow(RangeError);
  }
  });

  it('builds entry ribs and mullions inside the parcel, clear of bridge holes, and omits trees at reservations', () => {
  {
    const plan = family.plan(input), builder = new MeshBuilder();
    builder.floor = 99;
    const decoration = family.decorate!({ builder, layout: layoutFor(input, plan), material: role => family.materials![role]! });
    expect(builder.floor).toBe(99);
    expect(builder.parts.some(p => p.name.endsWith(':entry-rib'))).toBe(true);
    expect(builder.parts.some(p => p.name.endsWith(':mullions') && p.prims.size > 0)).toBe(true);
    for (const part of builder.parts) {
      expect(part.floor).toBeGreaterThanOrEqual(0);
      for (const prim of part.prims.values()) {
        expect(prim.positions.every(Number.isFinite)).toBe(true);
        for (let i = 0; i < prim.positions.length; i += 3) {
          expect(prim.positions[i]).toBeGreaterThanOrEqual(-1e-7);
          expect(prim.positions[i]).toBeLessThanOrEqual(54 + 1e-7);
          expect(prim.positions[i + 2]).toBeGreaterThanOrEqual(-1e-7);
          expect(prim.positions[i + 2]).toBeLessThanOrEqual(34 + 1e-7);
        }
      }
    }
    expect(builder.materialSlots()).toContain('cyberpunk/paired-light-warm/mid#surface');
    expect(decoration?.instances?.length).toBeGreaterThan(0);
    for (const tree of decoration!.instances!) {
      expect(tree.kind).toBe('ornamental-tree');
      expect(tree.size).toEqual([2.1, 6, 2.1]);
      expect(tree.position[1]).toBe(0);
      expect(tree.position[0] - tree.size[0] / 2).toBeGreaterThan(0);
      expect(tree.position[0] + tree.size[0] / 2).toBeLessThan(54);
      expect(tree.position[2] - tree.size[2] / 2).toBeGreaterThan(0);
      expect(tree.position[2] + tree.size[2] / 2).toBeLessThan(34);
      expect(Math.abs(tree.position[0] - 27)).toBeGreaterThan(3.35);
    }
  }
  {
    const bound = { ...input, fixedFaces: true };
    const plan = family.plan(bound), layout = layoutFor(bound, plan), builder = new MeshBuilder();
    const section = plan.floors[1]!.sections.find(s => s.edge === 0 && s.id.includes(':bank:'))!;
    const u0 = section.offset - 0.1, u1 = section.offset + section.width + 0.1;
    layout.carved.push({ aperture: { face: 0, kind: 'bridge' }, facePoly: [[u0, 4.5], [u1, 4.5], [u1, 9], [u0, 9]] } as Layout['carved'][number]);
    for (const y of [0.5, 2.5]) layout.carved.push({ aperture: { face: 0, kind: 'bridge' },
      facePoly: [[10, y], [14, y], [14, y + 0.8], [10, y + 0.8]] } as Layout['carved'][number]);
    const decoration = family.decorate!({ builder, layout, material: role => family.materials![role]! });
    expect(builder.parts.some(p => p.name.endsWith(':entry-rib'))).toBe(false);
    expect(decoration?.instances).toEqual([]);
    const mullions = builder.parts.find(p => p.name === 'mirror-shutters:1:0:mullions')!;
    for (const prim of mullions.prims.values()) for (let i = 0; i < prim.positions.length; i += 3) {
      expect(prim.positions[i]! < u0 || prim.positions[i]! > u1).toBe(true);
    }
    const podium = builder.parts.find(p => p.name === 'mirror-shutters:0:0:podium-panels')!;
    for (const prim of podium.prims.values()) for (let i = 0; i < prim.indices.length; i += 3) {
      const points = prim.indices.slice(i, i + 3).map(v => [prim.positions[v * 3]!, prim.positions[v * 3 + 1]!] as Point);
      for (const y of [0.9, 2.9]) {
        const sides = points.map(([x, z], index) => {
          const next = points[(index + 1) % 3]!;
          return (next[0] - x) * (y - z) - (next[1] - z) * (12 - x);
        });
        expect(sides.every(v => v > 1e-7) || sides.every(v => v < -1e-7)).toBe(false);
      }
    }
  }
  {
    const plan = family.plan(input), layout = layoutFor(input, plan);
    const material = (role: string) => family.materials![role]!;
    const before = family.decorate!({ builder: new MeshBuilder(), layout, material })!.instances!;
    const frontage = before.filter(t => t.position[2] < plan.floors[0]!.outline[0]![1]);
    expect(frontage.length).toBeGreaterThanOrEqual(2);
    const entrance = frontage[0]!, bridge = frontage[1]!;
    const origin = plan.floors[0]!.outline[0]![0];
    layout.floors[0]!.openings.push({ kind: 'door', edge: 0, offset: entrance.position[0] - origin - 1.5,
      width: 3, sill: 0, height: 2.5 } as Layout['floors'][number]['openings'][number]);
    const u = bridge.position[0] - origin;
    layout.carved.push({ aperture: { face: 0, kind: 'bridge' },
      facePoly: [[u - 1, 4.5], [u + 1, 4.5], [u + 1, 8], [u - 1, 8]] } as Layout['carved'][number]);
    const after = family.decorate!({ builder: new MeshBuilder(), layout, material })!.instances!;
    expect(after).toHaveLength(before.length - 2);
    expect(after.some(t => JSON.stringify(t.position) === JSON.stringify(entrance.position))).toBe(false);
    expect(after.some(t => JSON.stringify(t.position) === JSON.stringify(bridge.position))).toBe(false);
  }
  });
});
