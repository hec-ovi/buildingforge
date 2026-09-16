import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout } from '../../api.ts';
import { family } from '../index.ts';
import { generate, type BuildingRequest } from '../../../index.ts';
import { NodeIO, type Document } from '@gltf-transform/core';

const input: FamilyInput = { rectangle: [[0, 0], [51, 0], [51, 39], [0, 39]], floorHeights: Array(12).fill(4.5), seed: 'corporate-contract' };
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
  expect(geometry.max[2]).toBeLessThanOrEqual(39 + 1e-8);
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
  const joints = (values: Set<number>, gap: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.flatMap((value, i) => i && Math.abs(value - sorted[i - 1]! - gap) < 1e-8 ? [(value + sorted[i - 1]!) / 2] : []);
  };
  return { horizontal: joints(horizontal, 0.032), vertical: joints(vertical, 0.036) };
}

function frontAt(parts: Part[], x: number, y: number): number {
  let nearest = Infinity;
  for (const part of parts) for (const prim of part.prims.values()) for (let i = 0; i < prim.indices.length; i += 3) {
    const points = prim.indices.slice(i, i + 3).map(index => [0, 1, 2].map(axis => prim.positions[index * 3 + axis]! + (part.pivot?.[axis] ?? 0)));
    nearest = Math.min(nearest, triangleDepth(points, x, y));
  }
  return nearest;
}

function triangleDepth(points: number[][], x: number, y: number): number {
  const [a, b, c] = points as [number[], number[], number[]];
  const denominator = (b[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[1]! - c[1]!);
  if (Math.abs(denominator) < 1e-10) return Infinity;
  const u = ((b[1]! - c[1]!) * (x - c[0]!) + (c[0]! - b[0]!) * (y - c[1]!)) / denominator;
  const v = ((c[1]! - a[1]!) * (x - c[0]!) + (a[0]! - c[0]!) * (y - c[1]!)) / denominator;
  return u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8 ? u * a[2]! + v * b[2]! + (1 - u - v) * c[2]! : Infinity;
}

function slabCovers(document: Document, floor: number, x: number, z: number): boolean {
  const node = document.getRoot().listNodes().find(n => n.getName() === `floor:${floor}/slab`)!;
  const matrix = node.getWorldMatrix();
  for (const primitive of node.getMesh()!.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!.getArray()!, indices = primitive.getIndices()!.getArray()!;
    for (let i = 0; i < indices.length; i += 3) {
      const points = Array.from(indices.slice(i, i + 3), index => [0, 2, 1].map(axis => matrix[axis]! * positions[index * 3]! + matrix[4 + axis]! * positions[index * 3 + 1]! + matrix[8 + axis]! * positions[index * 3 + 2]! + matrix[12 + axis]!));
      if (Number.isFinite(triangleDepth(points, x, z))) return true;
    }
  }
  return false;
}

function exportedSource(apertures: BuildingRequest['apertures'] = []) {
  return generate({
    seed: input.seed, buildingId: 'corporate-window-plane', theme: 'cyberpunk',
    parcel: { footprint: input.rectangle, accessPoint: [25, -1], maxHeight: 60 },
    building: { type: 'corpo', tier: 'rich', floors: 12 }, apertures,
    options: { architecture: 'corporate-sectors', glb: 'named', balconies: 'off', roofArtifacts: 'off', facadeServices: 'off', fireEscape: 'off', adScreens: 'off' },
  }, { textures: { mode: 'keys', source: null } });
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
  return { assembly: { ...plan, architecture: family.id }, floors, carved: [], lights: [], request: { seed: source.seed, parcel: { footprint: source.rectangle } } } as unknown as Layout;
}

describe('corporate sectors public family', () => {

  it('keeps the exported middle window casings at the recessed panel plane', async () => {
    const { blueprint, glb } = await exportedSource();
    const floor = blueprint.floors.find(f => f.index === 4)!;
    const opening = floor.openings.find(o => o.sectionId?.includes(':recessed-slit:'))!;
    const section = blueprint.assembly!.floors[4]!.sections.find(s => s.id === opening.sectionId)!;
    expect(section.border.surfaceDepth).toBe(1);
    const document = await new NodeIO().readBinary(glb);
    const node = document.getRoot().listNodes().find(n => n.getName() === `window:${opening.id}`)!;
    const matrix = node.getWorldMatrix();
    let front = Infinity;
    for (const primitive of node.getMesh()!.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')!.getArray()!;
      for (let i = 0; i < positions.length; i += 3) front = Math.min(front, matrix[2]! * positions[i]! + matrix[6]! * positions[i + 1]! + matrix[10]! * positions[i + 2]! + matrix[14]!);
    }
    expect(front).toBeCloseTo(floor.outline[0]![1] + 1 - 0.04, 4);
    const middle = floor.outline[0]![0] + section.offset + section.width / 2;
    expect(slabCovers(document, 4, middle, floor.outline[0]![1] + 0.5)).toBe(true);
    expect(slabCovers(document, 4, middle, floor.outline[0]![1] + 1.5)).toBe(true);
    expect(slabCovers(document, 5, middle, floor.outline[0]![1] + 0.5)).toBe(false);
    const reveal = blueprint.assembly!.floors[5]!.sections.find(s => s.edge === 0 && s.id.includes(':channel-right:'))!;
    const revealX = floor.outline[0]![0] + reveal.offset + reveal.width * 0.8;
    expect(slabCovers(document, 5, revealX, floor.outline[0]![1] + 0.2)).toBe(false);
    expect(slabCovers(document, 5, revealX, floor.outline[0]![1] + 1.1)).toBe(true);
  });

  it('retains walking approaches through an inset shell to fixed bridges and the entrance', async () => {
    const { blueprint, glb } = await exportedSource([{ id: 'bridge', buildingId: 'corporate-window-plane', floor: 2, face: 1, kind: 'bridge', u: 18, base: 9, width: 3, height: 3, shape: 'rect',
      cut: { polygon: [[51, 9, 16.5], [51, 9, 19.5], [51, 12, 19.5], [51, 12, 16.5]], axisDir: [1, 0, 0] }, linkId: 'link' }]);
    const document = await new NodeIO().readBinary(glb);
    expect(slabCovers(document, 2, 50.5, 18)).toBe(true);
    expect(slabCovers(document, 2, 50.5, 24)).toBe(false);
    const entrance = blueprint.floors[0]!.openings.find(o => o.kind === 'door')!;
    expect(slabCovers(document, 0, entrance.offset + entrance.width / 2, 0.5)).toBe(true);
  });
  it('fits fixed face limits around complete two-metre window repeats and distinct upper blocks', () => {
    const plan = family.plan(input);
    expect(plan).toEqual(family.plan(input));
    expect(plan.extent).toEqual({ width: 44, depth: 32 });
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
    expect(slit.windows![1]!.height).toBe(slit.windows![0]!.height);
    expect(input.floorHeights[4]! - slit.windows![1]!.sill - slit.windows![1]!.height).toBeCloseTo(0.3);
    const facade = plan.floors[4]!.sections.filter(s => s.edge === 0 && !s.id.includes(':end:'));
    const box = facade[0]!, wing = facade.at(-1)!;
    expect(wing.id).toContain(':large-panel:');
    expect(wing.width).toBe(4);
    expect(box.id).toContain(':cassette:');
    expect(box.width).toBe(18);
    expect(box.windows).toHaveLength(1);
    expect(box.windows![0]!.panes?.cols).toBe(2);
    expect(box.windows![0]!.offset + box.windows![0]!.width).toBeLessThan(12);
    expect(facade.filter(s => s.id.includes(':recessed-slit:')).every(s => s.width === 2)).toBe(true);
    const wider = family.plan({ ...input, rectangle: [[0, 0], [63, 0], [63, 39], [0, 39]] });
    const expanded = wider.floors[4]!.sections.filter(s => s.edge === 0);
    expect(expanded.filter(s => s.id.includes(':large-panel:')).map(s => s.width)).toEqual([4]);
    expect(expanded.filter(s => s.id.includes(':cassette:')).map(s => s.width)).toEqual([18]);
    expect(expanded.filter(s => s.id.includes(':recessed-slit:'))).toHaveLength(facade.filter(s => s.id.includes(':recessed-slit:')).length + 6);
    const upper = plan.floors[8]!.sections.filter(s => s.edge === 0);
    expect(upper.filter(s => s.id.includes(':mechanical:'))).toHaveLength(1);
    expect(upper.some(s => s.id.includes(':cassette:'))).toBe(false);
    expect(upper.filter(s => s.id.includes(':upper-window:')).every(s => s.windows?.length === 2)).toBe(true);
    expect([0, 1, 2, 3].map(edge => plan.floors[4]!.sections.filter(s => s.edge === edge && s.id.includes(':cassette:')).length)).toEqual([1, 1, 0, 0]);
    expect(plan.floors[8]!.sections.filter(s => s.id.includes(':screen:')).map(s => s.edge)).toEqual([2]);
    expect(plan.floors[8]!.sections.filter(s => s.edge === 3 && s.id.includes(':mechanical:'))).toHaveLength(1);
    expect(plan.floors.every(f => f.balconySections.length === 0)).toBe(true);
  });

  it('preserves supplied bridge faces and rotation without changing any floor pitch', () => {
    const source: FamilyInput = { rectangle: [[10, 20], [43.6, 45.2], [20.8, 75.6], [-12.8, 50.4]], floorHeights: [4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5, 4.5, 4.5, 4.5, 4.5, 4.5], seed: 'bridge', fixedFaces: true };
    const plan = family.plan(source);
    expect(plan.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(source.rectangle))).toBe(true);
    expect(plan.extent.width).toBeCloseTo(42);
    expect(plan.extent.depth).toBeCloseTo(38);
    expect(source.floorHeights).toEqual([4.5, 4.5, 4.7, 4.3, 4.5, 4.5, 5, 4.5, 4.5, 4.5, 4.5, 4.5]);
    expect(plan.floors[4]!.sections.find(s => s.id.includes(':recessed-slit:'))!.border.depth).toBeCloseTo(4.68);
  });

  it('rejects impossible storeys and malformed or undersized plates', () => {
    for (const override of [
      { floorHeights: Array(11).fill(4.5) }, { floorHeights: input.floorHeights.map((h, i) => i === 2 ? 2 : h) },
      { rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]] },
      { rectangle: [[0, 0], [35, 0], [35, 34.5], [0, 34.5]] },
      { rectangle: [[0, 0], [32, 0], [31, 32], [0, 32]] },
      { rectangle: [[0, 0], [0, 32], [32, 32], [32, 0]] },
    ]) expect(() => family.plan({ ...input, ...override } as FamilyInput)).toThrow(RangeError);
    const minimum = family.plan({ ...input, rectangle: [[0, 0], [35, 0], [35, 35], [0, 35]] });
    expect(minimum.extent).toEqual({ width: 28, depth: 28 });
    expect(minimum.groups.map(g => [g.fromFloor, g.toFloor])).toEqual([[0, 3], [4, 7], [8, 11]]);
  });

  it('decorates within the parcel, leaves bridge holes clear, and publishes cyan emitters', () => {
    const scene = layout(family.plan(input));
    scene.carved.push({ aperture: { face: 0, kind: 'bridge' }, facePoly: [[1, 23], [4, 23], [4, 26], [1, 26]] } as Layout['carved'][number]);
    scene.carved.push({ aperture: { face: 1, kind: 'bridge' }, facePoly: [[5, 42], [9, 42], [9, 44], [5, 44]] } as Layout['carved'][number]);
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
    for (const [floorIndex, edge, left, right, bottom, top] of [[5, 0, 1, 4, 23, 26], [9, 1, 5, 9, 42, 44]] as const) {
      const bridgeParts = builder.parts.filter(part => part.name.startsWith(`corporate:${floorIndex}:${edge}:`));
      expect(bridgeParts.length).toBeGreaterThan(0);
      const a = scene.floors[floorIndex]!.outline[edge]!, b = scene.floors[floorIndex]!.outline[(edge + 1) % 4]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const part of bridgeParts) for (const prim of part.prims.values()) for (let i = 0; i < prim.indices.length; i += 3) {
        const vertices = prim.indices.slice(i, i + 3).map(index => [
          ((prim.positions[index * 3]! + (part.pivot?.[0] ?? 0) - a[0]) * (b[0] - a[0]) + (prim.positions[index * 3 + 2]! + (part.pivot?.[2] ?? 0) - a[1]) * (b[1] - a[1])) / length,
          prim.positions[index * 3 + 1]! + (part.pivot?.[1] ?? 0)] as const);
        const overlaps = Math.min(...vertices.map(p => p[0])) < right + 0.19 && Math.max(...vertices.map(p => p[0])) > left - 0.19 && Math.min(...vertices.map(p => p[1])) < top + 0.19 && Math.max(...vertices.map(p => p[1])) > bottom - 0.19;
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
    const masks = builder.parts.filter(p => p.name.endsWith(':cover'));
    expect(masks.length).toBeGreaterThan(0);
    expect(masks.every(p => p.prims.has(family.materials!.shield!))).toBe(true);
    const boxes = builder.parts.filter(p => p.name.includes(':cassette:') && !p.name.startsWith('corporate:5:'));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      const shape = bounds([box]);
      expect(shape.max[1]! - shape.min[1]!).toBeCloseTo(2.4);
      const axis = box.name.split(':')[2] === '0' ? 0 : 2;
      expect(shape.max[axis]! - shape.min[axis]!).toBeCloseTo(18);
      expect([...box.prims.keys()].some(key => key.includes('/paired-blind/'))).toBe(false);
    }
    const floor = scene.floors[4]!, channel = floor.assembly!.sections.find(s => s.id.includes(':recessed-slit:'))!;
    expect(frontAt(builder.parts.filter(p => p.name === 'corporate:4:0:cladding'), floor.outline[0]![0] + channel.offset + channel.width / 2, floor.elevation + 1.5)).toBeCloseTo(floor.outline[0]![1] + 1);
    const cassette = floor.assembly!.sections.find(s => s.id.includes(':cassette:'))!;
    const openBox = builder.parts.find(p => p.name === `${cassette.id}:box`)!;
    const centre = floor.outline[0]![0] + cassette.offset + cassette.width / 3;
    expect(frontAt([openBox], centre, floor.elevation + floor.height - 0.65)).toBe(Infinity);
    expect(masks.every(p => ['0', '1'].includes(p.name.split(':')[2]!))).toBe(true);
    const coverage = scene.floors.filter(f => f.index >= 8).map(f => {
      const cover = builder.parts.filter(p => p.name === `corporate:${f.index}:0:cover`);
      const windows = f.openings.filter(o => o.edge === 0 && o.kind === 'window');
      return windows.filter(o => Number.isFinite(frontAt(cover, f.outline[0]![0] + o.offset + o.width / 2, f.elevation + o.sill + o.height / 2))).length;
    });
    expect(Math.min(...coverage)).toBeGreaterThanOrEqual(5);
    expect(new Set(coverage).size).toBeGreaterThan(1);
    expect(builder.parts.some(p => p.name === 'corporate:8:3:services')).toBe(true);
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
    expect(faceDepth(box)).toBeLessThan(faceDepth(wing));
    expectInsideParcel(builder.parts);
    const misaligned = new Set<string>();
    for (const edge of [0, 1]) {
      const masks = builder.parts.filter(p => new RegExp(`^corporate:[0-9]+:${edge}:cover$`).test(p.name));
      expect(masks.length).toBeGreaterThan(0);
      const reference = masks.map(part => panelJoints(part, edge).horizontal).find(values => values.length >= 2)!;
      expect(reference).toBeDefined();
      const origin = reference[0]!;
      let horizontalJoints = 0, verticalJoints = 0;
      for (const part of masks) {
        const joints = panelJoints(part, edge);
        const aligned = (value: number) => Math.abs(value - Math.round(value / 3) * 3) < 1e-8;
        horizontalJoints += joints.horizontal.length; verticalJoints += joints.vertical.length;
        if (!joints.horizontal.every(u => aligned(u - origin)) || !joints.vertical.every(y => aligned(y))) misaligned.add(part.name);
      }
      expect(horizontalJoints).toBeGreaterThan(0);
      expect(verticalJoints).toBeGreaterThan(0);
    }
    expect([...misaligned]).toEqual([]);
  });
});
