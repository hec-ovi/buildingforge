import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout } from '../../api.ts';
import { family } from '../index.ts';

const input: FamilyInput = { rectangle: [[0, 0], [51, 0], [51, 33], [0, 33]], floorHeights: Array(12).fill(4.5), seed: 'corporate-contract' };
type Part = MeshBuilder['parts'][number];

function bounds(parts: Part[]) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const invalid = new Set<string>();
  for (const part of parts) for (const prim of part.prims.values()) {
    if (!prim.positions.every(Number.isFinite) || !prim.normals.every(Number.isFinite)) invalid.add(part.name);
    for (let i = 0; i < prim.positions.length; i++) {
      const axis = i % 3, value = prim.positions[i]! + (part.pivot?.[axis] ?? 0);
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
    }
  }
  return { min, max, invalid: [...invalid] };
}

function expectInsideParcel(parts: Part[]) {
  const geometry = bounds(parts);
  expect(geometry.invalid).toEqual([]);
  expect(geometry.min[0]).toBeGreaterThanOrEqual(-1e-8);
  expect(geometry.max[0]).toBeLessThanOrEqual(51 + 1e-8);
  expect(geometry.min[2]).toBeGreaterThanOrEqual(-1e-8);
  expect(geometry.max[2]).toBeLessThanOrEqual(33 + 1e-8);
}

function panelJoints(part: Part, edge: number) {
  const axis = edge === 0 ? 0 : 2, depthAxis = edge === 0 ? 2 : 0;
  const geometry = bounds([part]), front = edge === 0 ? geometry.min[depthAxis]! : geometry.max[depthAxis]!;
  const prim = part.prims.get(family.materials!.shield!)!;
  const horizontal = new Set<number>(), vertical = new Set<number>();
  for (let i = 0; i < prim.positions.length; i += 3) {
    if (Math.abs(prim.positions[i + depthAxis]! - front) > 1e-8) continue;
    horizontal.add(prim.positions[i + axis]!);
    vertical.add(prim.positions[i + 1]!);
  }
  // Outer coordinates are cuts at the section or floor boundary.
  const interior = (values: Set<number>) => [...values].sort((a, b) => a - b).slice(1, -1);
  return { horizontal: interior(horizontal), vertical: interior(vertical) };
}

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
  it('fits fixed face limits around complete two-metre window repeats and distinct upper blocks', () => {
    const plan = family.plan(input);
    expect(plan).toEqual(family.plan(input));
    expect(plan.extent).toEqual({ width: 43, depth: 25 });
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
      expect(end).toBeCloseTo(edge % 2 ? plan.extent.depth : plan.extent.width);
    }
    expect(plan.floors[0]!.sections.every(s => s.windows?.length === 0)).toBe(true);
    const slit = plan.floors[4]!.sections.find(s => s.id.includes(':recessed-slit:'))!;
    expect(slit.windows).toHaveLength(2);
    expect(slit.windows![0]!.sill).toBe(0.3);
    const facade = plan.floors[4]!.sections.filter(s => s.edge === 0 && !s.id.includes(':end:'));
    const box = facade[0]!, wing = facade.at(-1)!;
    expect(wing.id).toContain(':large-panel:');
    expect(wing.width).toBe(4);
    expect(box.id).toContain(':cassette:');
    expect(box.width).toBe(9);
    expect(box.windows).toHaveLength(2);
    expect(box.windows!.every(w => w.offset + w.width < 6)).toBe(true);
    expect(facade.filter(s => s.id.includes(':recessed-slit:')).every(s => s.width === 2)).toBe(true);
    const wider = family.plan({ ...input, rectangle: [[0, 0], [63, 0], [63, 33], [0, 33]] });
    const expanded = wider.floors[4]!.sections.filter(s => s.edge === 0);
    expect(expanded.filter(s => s.id.includes(':large-panel:')).map(s => s.width)).toEqual([4]);
    expect(expanded.filter(s => s.id.includes(':cassette:')).map(s => s.width)).toEqual([9]);
    expect(expanded.filter(s => s.id.includes(':recessed-slit:'))).toHaveLength(facade.filter(s => s.id.includes(':recessed-slit:')).length + 6);
    const upper = plan.floors[8]!.sections.filter(s => s.edge === 0);
    expect(upper.filter(s => s.id.includes(':mechanical:'))).toHaveLength(1);
    expect(upper.some(s => s.id.includes(':cassette:'))).toBe(false);
    expect(upper.some(s => s.id.includes(':mask-panel:'))).toBe(true);
    expect(plan.floors.every(f => f.balconySections.length === 0)).toBe(true);
  });

  it('preserves supplied bridge faces and rotation without changing any floor pitch', () => {
    const source: FamilyInput = { rectangle: [[10, 20], [34, 38], [19, 58], [-5, 40]], floorHeights: [4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5], seed: 'bridge', fixedFaces: true };
    const plan = family.plan(source);
    expect(plan.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(source.rectangle))).toBe(true);
    expect(plan.extent).toEqual({ width: 30, depth: 25 });
    expect(source.floorHeights).toEqual([4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5]);
    expect(plan.floors[4]!.sections.find(s => s.id.includes(':recessed-slit:'))!.border.depth).toBeCloseTo(4.3);
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
    expectInsideParcel(builder.parts);
    const blocked = new Set<string>();
    const bridgeParts = builder.parts.filter(part => part.name.startsWith('corporate:5:0:'));
    expect(bridgeParts.length).toBeGreaterThan(0);
    for (const part of bridgeParts) for (const prim of part.prims.values()) {
      for (let i = 0; i < prim.indices.length; i += 3) {
        const vertices = prim.indices.slice(i, i + 3).map(index => [prim.positions[index * 3]! + (part.pivot?.[0] ?? 0) - scene.floors[5]!.outline[0]![0], prim.positions[index * 3 + 1]! + (part.pivot?.[1] ?? 0)] as const);
        const overlaps = Math.min(...vertices.map(p => p[0])) < 11.19 && Math.max(...vertices.map(p => p[0])) > 7.81 && Math.min(...vertices.map(p => p[1])) < 26.19 && Math.max(...vertices.map(p => p[1])) > 22.81;
        if (overlaps) blocked.add(part.name);
      }
    }
    expect([...blocked]).toEqual([]);
    const rims = builder.parts.filter(p => p.name.startsWith('corporate:podium-rim:'));
    expect(rims).toHaveLength(4);
    const positions = (part: typeof rims[number]) => new Set([...part.prims.values()].flatMap(p => Array.from({ length: p.positions.length / 3 }, (_, i) => p.positions.slice(i * 3, i * 3 + 3).map(v => v.toFixed(6)).join(','))));
    for (let edge = 0; edge < 4; edge++) {
      const next = positions(rims[(edge + 1) % 4]!);
      expect([...positions(rims[edge]!)].filter(p => next.has(p)).length).toBeGreaterThanOrEqual(4);
      for (const p of rims[edge]!.prims.values()) expect(Math.max(...p.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(18);
    }
    const masks = builder.parts.filter(p => p.name.includes(':mask-panel:'));
    expect(masks.length).toBeGreaterThan(0);
    expect(masks.every(p => p.prims.has(family.materials!.shield!))).toBe(true);
  });

  it('fits fixed-face relief, aligns pale panel grids across unequal storeys, and clears a bridged screen', () => {
    const source = { ...input, fixedFaces: true, floorHeights: input.floorHeights.map((height, index) => height + (index % 3) * 0.1) };
    const scene = layout(family.plan(source), source);
    scene.carved.push({ aperture: { face: 2, kind: 'bridge' }, facePoly: [[20, 25], [25, 25], [25, 29], [20, 29]] } as Layout['carved'][number]);
    const builder = new MeshBuilder();
    family.decorate!({ builder, layout: scene, material: role => family.materials![role]! });
    expect(builder.parts.some(p => p.name === 'corporate:portrait-screen')).toBe(false);
    const wing = builder.parts.find(p => p.name.startsWith('corporate:4:0:large-panel:'))!;
    const box = builder.parts.find(p => p.name.startsWith('corporate:4:0:cassette:'))!;
    const faceDepth = (part: Part) => bounds([part]).min[2]!;
    expect(faceDepth(wing) - faceDepth(box)).toBeCloseTo(0.246, 3);
    expectInsideParcel(builder.parts);
    const misaligned = new Set<string>();
    for (const edge of [0, 1]) {
      const masks = builder.parts.filter(p => new RegExp(`^corporate:[0-9]+:${edge}:mask-panel:`).test(p.name));
      expect(masks.length).toBeGreaterThan(0);
      const reference = panelJoints(masks[0]!, edge).horizontal;
      const origin = (reference[0]! + reference[1]!) / 2;
      for (const part of masks) {
        const joints = panelJoints(part, edge);
        const aligned = (value: number, pitch: number, gap: number) => Math.abs(Math.abs(value - Math.round(value / pitch) * pitch) - gap) < 1e-8;
        if (!joints.horizontal.length || !joints.vertical.length || !joints.horizontal.every(u => aligned(u - origin, 1, 0.016)) || !joints.vertical.every(y => aligned(y, 0.75, 0.018))) misaligned.add(part.name);
      }
    }
    expect([...misaligned]).toEqual([]);
  });
});
