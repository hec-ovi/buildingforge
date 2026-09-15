import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout } from '../../api.ts';
import { family } from '../index.ts';

const input: FamilyInput = { rectangle: [[0, 0], [51, 0], [51, 33], [0, 33]], floorHeights: Array(12).fill(4.5), seed: 'corporate-contract' };

function layout(plan: FamilyPlan, source = input): Layout {
  let elevation = 0;
  const floors = plan.floors.map(f => {
    const value = { index: f.floor, kind: 'office', elevation, height: source.floorHeights[f.floor]!, outline: f.outline, assembly: f,
      openings: f.sections.flatMap(s => (s.windows ?? []).map((w, i) => ({ id: `${s.id}:${i}`, kind: 'window' as const, edge: s.edge, offset: s.offset + w.offset, width: w.width, sill: w.sill, height: w.height }))) };
    elevation += value.height;
    return value;
  });
  floors[0]!.openings.push({ id: 'entry', kind: 'door' as never, edge: 0, offset: plan.extent.width / 2 - 1.5, width: 3, sill: 0, height: 2.8 });
  return { assembly: { ...plan, architecture: family.id }, floors, carved: [], lights: [], request: { parcel: { footprint: source.rectangle } } } as unknown as Layout;
}

describe('corporate sectors public family', () => {
  it('partitions all four faces into complete variable-width sectors and floor groups', () => {
    const plan = family.plan(input);
    expect(plan).toEqual(family.plan(input));
    expect(plan.extent).toEqual({ width: 48, depth: 30 });
    expect(plan.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 3], [4, 7], [8, 11]]);
    for (const floor of plan.floors) for (let edge = 0; edge < 4; edge++) {
      let end = 0;
      for (const section of floor.sections.filter(s => s.edge === edge)) {
        expect(section.offset).toBeCloseTo(end);
        end += section.width;
        for (const window of section.windows ?? []) {
          expect(window.offset).toBeGreaterThan(0);
          expect(window.offset + window.width).toBeLessThan(section.width);
          expect(window.sill + window.height).toBeLessThan(input.floorHeights[floor.floor]!);
        }
      }
      expect(end).toBeCloseTo(edge % 2 ? 30 : 48);
    }
    expect(plan.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    const slit = plan.floors[4]!.sections.find(s => s.id.includes(':recessed-slit:'))!;
    expect(slit.windows).toHaveLength(2);
    expect(slit.windows![0]!.sill).toBe(0.3);
    expect(plan.floors.every(f => f.balconySections.length === 0)).toBe(true);
  });

  it('preserves supplied bridge faces and rotation without changing any floor pitch', () => {
    const source: FamilyInput = { rectangle: [[10, 20], [34, 38], [19, 58], [-5, 40]], floorHeights: [4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5], seed: 'bridge', fixedFaces: true };
    const plan = family.plan(source);
    expect(plan.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(source.rectangle))).toBe(true);
    expect(plan.extent).toEqual({ width: 30, depth: 25 });
    expect(source.floorHeights).toEqual([4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5]);
  });

  it('rejects impossible storeys and malformed or undersized plates', () => {
    for (const override of [
      { floorHeights: [4.5] }, { floorHeights: [4.5, 4.5, 2, 4.5, 4.5] },
      { rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]] },
      { rectangle: [[0, 0], [32, 0], [31, 32], [0, 32]] },
      { rectangle: [[0, 0], [0, 32], [32, 32], [32, 0]] },
    ]) expect(() => family.plan({ ...input, ...override } as FamilyInput)).toThrow(RangeError);
  });

  it('decorates within the parcel, leaves bridge holes clear, and publishes cyan emitters', () => {
    const scene = layout(family.plan(input));
    scene.carved.push({ aperture: { face: 0, kind: 'bridge' }, facePoly: [[8, 23], [11, 23], [11, 26], [8, 26]] } as Layout['carved'][number]);
    const builder = new MeshBuilder();
    builder.floor = 99;
    const decoration = family.decorate!({ builder, layout: scene, material: role => family.materials![role]! });
    expect(builder.floor).toBe(99);
    expect(builder.parts.some(p => p.name === 'corporate:portrait-screen')).toBe(true);
    expect(scene.lights.length).toBeGreaterThan(20);
    expect(scene.lights.every(l => l.color === '#9bdded' && l.lumens! >= 1200)).toBe(true);
    expect(decoration?.instances).toHaveLength(2);
    expect(decoration?.instances?.every(i => i.kind === 'ornamental-tree')).toBe(true);
    for (const part of builder.parts) for (const prim of part.prims.values()) {
      expect(prim.positions.every(Number.isFinite)).toBe(true);
      expect(prim.normals.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < prim.positions.length; i += 3) {
        expect(prim.positions[i]! + (part.pivot?.[0] ?? 0)).toBeGreaterThanOrEqual(0);
        expect(prim.positions[i]! + (part.pivot?.[0] ?? 0)).toBeLessThanOrEqual(51);
        expect(prim.positions[i + 2]! + (part.pivot?.[2] ?? 0)).toBeGreaterThanOrEqual(0);
        expect(prim.positions[i + 2]! + (part.pivot?.[2] ?? 0)).toBeLessThanOrEqual(33);
      }
      if (part.name === 'corporate:5:0:cladding') for (let i = 0; i < prim.indices.length; i += 3) {
        const vertices = prim.indices.slice(i, i + 3).map(index => [prim.positions[index * 3]! - 1.5, prim.positions[index * 3 + 1]!] as const);
        const overlaps = Math.min(...vertices.map(p => p[0])) < 11.19 && Math.max(...vertices.map(p => p[0])) > 7.81 && Math.min(...vertices.map(p => p[1])) < 26.19 && Math.max(...vertices.map(p => p[1])) > 22.81;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('keeps fixed-face relief inside the plate and suppresses a screen across a bridge', () => {
    const source = { ...input, fixedFaces: true };
    const scene = layout(family.plan(source), source);
    scene.carved.push({ aperture: { face: 2, kind: 'bridge' }, facePoly: [[20, 25], [25, 25], [25, 29], [20, 29]] } as Layout['carved'][number]);
    const builder = new MeshBuilder();
    family.decorate!({ builder, layout: scene, material: role => family.materials![role]! });
    expect(builder.parts.some(p => p.name === 'corporate:portrait-screen')).toBe(false);
    for (const part of builder.parts) for (const prim of part.prims.values()) for (let i = 0; i < prim.positions.length; i += 3) {
      expect(prim.positions[i]!).toBeGreaterThanOrEqual(-1e-8);
      expect(prim.positions[i]!).toBeLessThanOrEqual(51 + 1e-8);
      expect(prim.positions[i + 2]!).toBeGreaterThanOrEqual(-1e-8);
      expect(prim.positions[i + 2]!).toBeLessThanOrEqual(33 + 1e-8);
    }
  });
});
