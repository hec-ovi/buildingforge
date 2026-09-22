import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout, type Point } from '../api.ts';
import { intersect, reservations } from './geometry.ts';
import { family } from './index.ts';

const input: FamilyInput = { rectangle: [[0, 0], [32, 0], [32, 24], [0, 24]],
  floorHeights: [4.4, 3.2, 4.1, 3.5, 4.3, 3.2, 4, 3.7], seed: 'industrial-framed-contract' };

function host(source: FamilyInput, plan: FamilyPlan): Layout {
  let elevation = 0;
  const floors = plan.floors.map(assembly => {
    const height = source.floorHeights[assembly.floor]!;
    const floor = { assembly, index: assembly.floor, height, elevation, kind: 'industrial', outline: assembly.outline,
      openings: assembly.sections.flatMap(s => (s.windows ?? []).map((w, i) => ({
        id: `test:${assembly.floor}:${s.id}:${i}`, kind: 'window' as const, edge: s.edge,
        offset: s.offset + w.offset, width: w.width, sill: w.sill, height: w.height }))) };
    elevation += height;
    return floor;
  });
  return { floors, carved: [], assembly: { ...plan, architecture: family.id },
    request: { parcel: { footprint: source.rectangle }, seed: source.seed }, lights: [] } as unknown as Layout;
}

describe('industrial-framed public family contract', () => {
  it('fits complete framed bays, with an entrance field and separate windows on every real upper floor', () => {
    const result = family.plan(input);
    expect(result).toEqual(family.plan(input));
    expect(result.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 0], [1, 3], [4, 6], [7, 7]]);
    for (const floor of result.floors) for (let edge = 0; edge < 4; edge++) {
      let cursor = 0;
      const sections = floor.sections.filter(s => s.edge === edge);
      expect(sections.some(s => s.technique === 'paired-glass' && s.width - 2 * s.border.side >= 2)).toBe(true);
      for (const section of sections) {
        expect(section.offset).toBeCloseTo(cursor); cursor += section.width;
        expect(section.windows?.length).toBe(floor.floor && section.technique === 'paired-glass' ? 1 : 0);
        for (const w of section.windows ?? []) {
          expect(w.offset).toBeGreaterThan(0); expect(w.offset + w.width).toBeLessThan(section.width);
          expect(w.sill + w.height).toBeCloseTo(input.floorHeights[floor.floor]! - 0.6);
        }
      }
      expect(cursor).toBeCloseTo(edge % 2 ? result.extent.depth : result.extent.width);
      expect(floor.balconySections).toEqual([]);
    }
    const minimal = family.plan({ ...input, rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]], floorHeights: [3, 3, 3] });
    expect(minimal.floors).toHaveLength(3);
    const rotated: FamilyInput = { ...input, fixedFaces: true,
      rectangle: input.rectangle.map(([x, z]) => [5 + 0.8 * x - 0.6 * z, 2 + 0.6 * x + 0.8 * z]) as FamilyInput['rectangle'] };
    for (const floor of family.plan(rotated).floors) expect(floor.outline).toEqual(rotated.rectangle);
    for (const bad of [
      { ...input, floorHeights: [4, 4] }, { ...input, floorHeights: [4, 2.9, 4] },
      { ...input, floorHeights: [4, NaN, 4] },
      { ...input, rectangle: [[0, 0], [15.9, 0], [15.9, 20], [0, 20]] },
      { ...input, rectangle: [[0, 0], [20, 0], [19, 20], [0, 20]] },
      { ...input, rectangle: [[0, 0], [0, 20], [20, 20], [20, 0]] },
    ]) expect(() => family.plan(bad as FamilyInput)).toThrow(RangeError);
  });

  it('builds deep bands and cross braces within the parcel, preserving window, pocket and connection clearances', () => {
    for (const fixedFaces of [false, true]) {
      const source = { ...input, fixedFaces }, plan = family.plan(source), layout = host(source, plan), builder = new MeshBuilder();
      builder.floor = 91;
      layout.floors[0]!.openings.push({ id: 'main', edge: 0, kind: 'door', offset: 2.3, width: 2.2, sill: 0, height: 2.7,
        door: { set: 'plain', frameWidth: 0.09, frameDepth: 0.06, recessDepth: 0.1, thresholdHeight: 0,
          cassette: { offset: 2.2, width: 2.4, sill: 0, height: 2.85, backDepth: 0.2 },
          clearance: { offset: 2.1, width: 2.6, sill: 0, height: 2.9, backDepth: 0.3 },
          motion: { kind: 'pocket', maxTravel: 1.1, clearDepth: 0,
            leaves: [{ leaf: 0, travelU: -1.1, pocket: { offset: 1.05, width: 1.2, sill: 0, height: 2.7, backDepth: 0.3, frontDepth: 0.1 } }] } } });
      layout.carved.push({ aperture: { face: 0 } as Layout['carved'][number]['aperture'], facePoly: [[5, 5], [9, 5], [9, 9], [5, 9]] });
      family.decorate!({ builder, layout, material: role => family.materials![role]! });
      expect(builder.floor).toBe(91);
      expect(builder.parts.some(p => p.name.includes(':cross-brace:') && p.prims.size > 0)).toBe(true);
      expect(builder.parts.some(p => p.name.endsWith(':group-band') && p.prims.size > 0)).toBe(true);
      for (const part of builder.parts) for (const prim of part.prims.values()) {
        expect(prim.positions.every(Number.isFinite)).toBe(true); expect(prim.normals.every(Number.isFinite)).toBe(true);
        for (let i = 0; i < prim.positions.length; i += 3) {
          expect(prim.positions[i]).toBeGreaterThanOrEqual(-1e-7); expect(prim.positions[i]).toBeLessThanOrEqual(32 + 1e-7);
          expect(prim.positions[i + 2]).toBeGreaterThanOrEqual(-1e-7); expect(prim.positions[i + 2]).toBeLessThanOrEqual(24 + 1e-7);
        }
        if (!part.name.startsWith(`industrial-framed:${part.floor}:0:`)) continue;
        const floor = layout.floors.find(f => f.index === part.floor)!;
        for (let i = 0; i < prim.indices.length; i += 3) {
          const triangle = prim.indices.slice(i, i + 3).map(index => [prim.positions[index * 3]! - floor.outline[0]![0], prim.positions[index * 3 + 1]!] as Point);
          for (const hole of reservations(layout, floor, 0)) {
            const cut = intersect(triangle, hole);
            const area = Math.abs(cut.reduce((sum, p, j) => { const q = cut[(j + 1) % cut.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0));
            expect(area).toBeLessThan(1e-6);
          }
        }
      }
    }
  });
});
