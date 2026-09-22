import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MeshBuilder, type FamilyInput, type FamilyPlan, type FloorLayout, type Layout, type Point } from '../api.ts';
import { intersect, reservations } from './geometry.ts';
import { family } from './index.ts';

const input: FamilyInput = { rectangle: [[0, 0], [32, 0], [32, 24], [0, 24]],
  floorHeights: [3.8, 2.6, 3.2, 3.5], seed: 'residential-serviced-contract' };
const variants = [false, true].flatMap(fixedFaces => [false, true].map(rotated => ({ fixedFaces, rotated })));
type Part = MeshBuilder['parts'][number];
type FramePoint = [number, number, number];

function source(fixedFaces: boolean, rotated: boolean): FamilyInput {
  return { ...input, fixedFaces, rectangle: input.rectangle.map(([x, z]) => rotated
    ? [5 + 0.8 * x - 0.6 * z, -9 + 0.6 * x + 0.8 * z] : [x, z]) as FamilyInput['rectangle'] };
}

function host(source: FamilyInput, plan: FamilyPlan): Layout {
  let elevation = 0;
  const floors = plan.floors.map(assembly => {
    const height = source.floorHeights[assembly.floor]!;
    const floor = { assembly, index: assembly.floor, height, elevation, kind: 'residential', outline: assembly.outline,
      openings: assembly.sections.flatMap(s => (s.windows ?? []).map((w, i) => ({
        id: `test:${assembly.floor}:${s.id}:${i}`, kind: 'window' as const, edge: s.edge,
        offset: s.offset + w.offset, width: w.width, sill: w.sill, height: w.height }))) };
    elevation += height;
    return floor;
  });
  return { floors, carved: [], assembly: { ...plan, architecture: family.id },
    request: { parcel: { footprint: source.rectangle }, seed: source.seed }, lights: [] } as unknown as Layout;
}

function local(point: Point, rectangle: Point[]): Point {
  const a = rectangle[0]!, b = rectangle[1]!, d = rectangle[3]!;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]), depth = Math.hypot(d[0] - a[0], d[1] - a[1]);
  return [((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / width,
    ((point[0] - a[0]) * (d[0] - a[0]) + (point[1] - a[1]) * (d[1] - a[1])) / depth];
}

function length(outline: Point[], edge: number): number {
  const a = outline[edge]!, b = outline[(edge + 1) % outline.length]!;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function area(points: Point[]): number {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]!;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

function project(positions: number[], index: number, floor: FloorLayout, edge: number): Point {
  const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!, width = length(floor.outline, edge);
  return [((positions[index * 3]! - a[0]) * (b[0] - a[0]) +
    (positions[index * 3 + 2]! - a[1]) * (b[1] - a[1])) / width, positions[index * 3 + 1]!];
}

function decorate(layout: Layout): MeshBuilder {
  const builder = new MeshBuilder();
  builder.floor = 91;
  family.decorate!({ builder, layout, material: role => family.materials![role]! });
  expect(builder.floor).toBe(91);
  return builder;
}

function fingerprint(builder: MeshBuilder): string {
  return createHash('sha256').update(JSON.stringify(builder.parts.map(p => ({ ...p, prims: [...p.prims] })))).digest('hex');
}

function addDoor(layout: Layout): void {
  layout.floors[0]!.openings.push({ id: 'main', edge: 0, kind: 'door', offset: 2.3, width: 2.2, sill: 0, height: 2.7,
    door: { set: 'plain', frameWidth: 0.09, frameDepth: 0.06, recessDepth: 0.1, thresholdHeight: 0,
      cassette: { offset: 2.2, width: 2.4, sill: 0, height: 2.85, backDepth: 0.2 },
      clearance: { offset: 2.1, width: 2.6, sill: 0, height: 2.9, backDepth: 0.3 },
      motion: { kind: 'pocket', maxTravel: 1.1, clearDepth: 0,
        leaves: [{ leaf: 0, travelU: -1.1,
          pocket: { offset: 1.05, width: 1.2, sill: 0, height: 2.7, backDepth: 0.3, frontDepth: 0.1 } }] } } });
}

function addCuts(layout: Layout): void {
  const floor = layout.floors[1]!;
  for (let edge = 0; edge < floor.outline.length; edge++) {
    const u = length(floor.outline, edge) * 0.35, y = floor.elevation + 0.34;
    layout.carved.push({ aperture: { face: edge } as Layout['carved'][number]['aperture'],
      facePoly: [[u, y], [u + 0.5, y], [u + 0.5, y + 0.3], [u, y + 0.3]] });
  }
}

function checkEnvelopes(layout: Layout): void {
  const ground = layout.floors[0]!, upper = layout.floors[1]!;
  expect(reservations(layout, ground, 0).some(h => h.u0 < 1.05 && h.u1 > 4.7 && h.y0 < 0 && h.y1 > 2.9)).toBe(true);
  for (let edge = 0; edge < upper.outline.length; edge++) {
    const u = length(upper.outline, edge) * 0.35, y = upper.elevation + 0.34;
    expect(reservations(layout, upper, edge).some(h => h.u0 < u && h.u1 > u + 0.5 && h.y0 < y && h.y1 > y + 0.3)).toBe(true);
  }
  for (const floor of layout.floors) for (const opening of floor.openings) {
    expect(reservations(layout, floor, opening.edge).some(h => h.u0 < opening.offset &&
      h.u1 > opening.offset + opening.width && h.y0 < floor.elevation + opening.sill &&
      h.y1 > floor.elevation + opening.sill + opening.height)).toBe(true);
  }
}

function checkPartitions(plan: FamilyPlan, source: FamilyInput): void {
  for (const floor of plan.floors) for (let edge = 0; edge < floor.outline.length; edge++) {
    const sections = floor.sections.filter(s => s.edge === edge).sort((a, b) => a.offset - b.offset);
    let cursor = 0;
    for (const section of sections) {
      expect(section.offset).toBeCloseTo(cursor); expect(section.width).toBeGreaterThan(0); cursor += section.width;
      if (floor.floor > 0 && section.technique === 'paired-glass') expect(section.windows).toHaveLength(1);
      for (const w of section.windows ?? []) {
        expect(w.offset).toBeGreaterThanOrEqual(0); expect(w.offset + w.width).toBeLessThanOrEqual(section.width + 1e-7);
        expect(w.width).toBeGreaterThan(0); expect(w.sill).toBeCloseTo(1.12);
        expect(w.height).toBeCloseTo(source.floorHeights[floor.floor]! - 1.54);
      }
    }
    expect(cursor).toBeCloseTo(length(floor.outline, edge));
    expect(floor.balconySections).toEqual([]);
  }
}

function checkVertices(builder: MeshBuilder, source: FamilyInput): void {
  let overflow = 0;
  const width = length(source.rectangle, 0), depth = length(source.rectangle, 1);
  for (const part of builder.parts) for (const prim of part.prims.values()) {
    expect([...prim.positions, ...prim.normals, ...prim.uvs].every(Number.isFinite)).toBe(true);
    for (let i = 0; i < prim.positions.length; i += 3) {
      const [u, v] = local([prim.positions[i]!, prim.positions[i + 2]!], source.rectangle);
      overflow = Math.max(overflow, -u, u - width, -v, v - depth);
    }
  }
  expect(overflow).toBeLessThan(1e-7);
}

function checkReservations(builder: MeshBuilder, layout: Layout): void {
  let overlap = 0, collision = '';
  for (const part of builder.parts) {
    const match = /^serviced:(\d+):(\d+):/.exec(part.name);
    expect(match, part.name).not.toBeNull();
    const floor = layout.floors.find(f => f.index === Number(match![1]))!, edge = Number(match![2]);
    expect(part.floor).toBe(floor.index);
    const holes = reservations(layout, floor, edge);
    for (const prim of part.prims.values()) for (let i = 0; i < prim.indices.length; i += 3) {
      const triangle = prim.indices.slice(i, i + 3).map(index => project(prim.positions, index, floor, edge));
      for (const hole of holes) {
        const size = area(intersect(triangle, hole));
        if (size > overlap) { overlap = size; collision = JSON.stringify({ part: part.name, hole, triangle }); }
      }
    }
  }
  expect(overlap, collision).toBeLessThan(1e-6);
}

function edgeVertices(part: Part, floor: FloorLayout, edge: number): FramePoint[] {
  const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!, width = length(floor.outline, edge);
  return [...part.prims.values()].flatMap(prim => Array.from({ length: prim.positions.length / 3 }, (_, i): FramePoint => {
    const [u, y] = project(prim.positions, i, floor, edge);
    const d = ((prim.positions[i * 3]! - a[0]) * (b[1] - a[1]) -
      (prim.positions[i * 3 + 2]! - a[1]) * (b[0] - a[0])) / width;
    return [u, y, d];
  }));
}

function centre(points: FramePoint[]): FramePoint {
  return [0, 1, 2].map(axis => (Math.min(...points.map(p => p[axis]!)) +
    Math.max(...points.map(p => p[axis]!))) / 2) as FramePoint;
}

function checkCableAttachments(builder: MeshBuilder, cable: Part[], floor: FloorLayout, edge: number): void {
  const prefix = `serviced:${floor.index}:${edge}:`, skin = -floor.assembly!.sections.find(s => s.edge === edge)!.border.surfaceDepth!;
  const cases = builder.parts.filter(p => p.name.startsWith(`${prefix}condenser:`) && p.name.endsWith(':casing'))
    .map(p => edgeVertices(p, floor, edge).filter(v => v[1] < floor.elevation + 0.89)).sort((a, b) => centre(a)[0] - centre(b)[0]);
  const anchors = cable.filter(p => p.name.includes(':anchor')).map(p => centre(edgeVertices(p, floor, edge))).sort((a, b) => a[0] - b[0]);
  const conductor = edgeVertices(cable.find(p => p.name.endsWith(':conductor'))!, floor, edge);
  expect(anchors).toHaveLength(2);
  const left = cases.findIndex(points => Math.abs(Math.max(...points.map(p => p[0])) - anchors[0]![0]) < 1e-6);
  const right = cases.findIndex(points => Math.abs(Math.min(...points.map(p => p[0])) - anchors[1]![0]) < 1e-6);
  expect(left).toBeGreaterThanOrEqual(0); expect(right).toBe(left + 1);
  for (const anchor of anchors) {
    expect(anchor[1]).toBeCloseTo(floor.elevation + 0.55); expect(anchor[2]).toBeCloseTo(skin + 0.4);
    expect(Math.min(...conductor.map(p => Math.hypot(p[0] - anchor[0], p[1] - anchor[1], p[2] - anchor[2])))).toBeCloseTo(0.008, 5);
  }
}

function checkCableSpan(cable: Part[], floor: FloorLayout, edge: number): void {
  const conductor = edgeVertices(cable.find(p => p.name.endsWith(':conductor'))!, floor, edge);
  const skin = -floor.assembly!.sections.find(s => s.edge === edge)!.border.surfaceDepth!;
  const triangles = cable.reduce((total, part) => total + [...part.prims.values()].reduce((n, prim) => n + prim.indices.length / 3, 0), 0);
  expect(triangles).toBeGreaterThan(0); expect(triangles).toBeLessThanOrEqual(250);
  expect(Math.min(...conductor.map(p => p[1]))).toBeGreaterThanOrEqual(floor.elevation + 0.44 - 1e-7);
  expect(Math.min(...conductor.map(p => p[1]))).toBeLessThan(floor.elevation + 0.48);
  expect(Math.max(...conductor.map(p => p[1]))).toBeLessThanOrEqual(floor.elevation + 0.56 + 1e-7);
  expect(conductor.every(p => Math.abs(p[2] - skin - 0.4) <= 0.008 + 1e-7)).toBe(true);
  for (const part of cable) for (const material of part.prims.keys()) expect(Object.values(family.materials!)).toContain(material);
}

describe('residential-serviced public family contract', () => {
  it('keeps the canonical eight-floor fixture below budget with its connected service cable', async () => {
    const { generate } = await import('../../index.ts');
    const request = JSON.parse(readFileSync(new URL('../../../fixtures/residential-serviced.request.json', import.meta.url), 'utf8'));
    const { blueprint, glb } = await generate(request, { textures: { mode: 'keys' } });
    expect(blueprint.floors).toHaveLength(8);
    expect(blueprint.geometry!.triangles).toBeLessThan(blueprint.geometry!.budget.triangles - 3000);
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + view.getUint32(12, true))));
    expect(json.nodes.filter((node: { name?: string }) => node.name?.endsWith(':service-cable:conductor'))).toHaveLength(1);
  });

  it('preserves fixed faces and wraps upper glazing around the four-facet fillet on free plates', () => {
    for (const fixedFaces of [false, true]) for (const rotated of [false, true]) {
      const request = source(fixedFaces, rotated), before = structuredClone(request), plan = family.plan(request);
      expect(plan).toEqual(family.plan(request)); expect(request).toEqual(before);
      expect(plan.floors).toHaveLength(request.floorHeights.length);
      expect(plan.groups.map(g => [g.fromFloor, g.toFloor])).toEqual(request.floorHeights.map((_, floor) => [floor, floor]));
      checkPartitions(plan, request);
      for (const floor of plan.floors) {
        expect(floor.outline).toHaveLength(fixedFaces ? 4 : 8);
        if (fixedFaces) { expect(floor.outline).toEqual(request.rectangle); continue; }
        const expected: Point[] = [[0.8, 0.8], ...Array.from({ length: 5 }, (_, i): Point => {
          const angle = -Math.PI / 2 + i * Math.PI / 8;
          return [27.2 + 4 * Math.cos(angle), 4.8 + 4 * Math.sin(angle)];
        }), [31.2, 23.2], [0.8, 23.2]];
        floor.outline.forEach((point, i) => local(point, request.rectangle).forEach((v, axis) => expect(v).toBeCloseTo(expected[i]![axis]!)));
        if (floor.floor > 0) for (const edge of [1, 2, 3, 4]) {
          expect(floor.sections.filter(s => s.edge === edge).some(s => (s.windows?.length ?? 0) > 0)).toBe(true);
        }
      }
      const ground = plan.floors[0]!;
      expect(ground.sections.every(s => s.windows?.length === 0)).toBe(true);
      for (let edge = 0; edge < ground.outline.length; edge++) if (length(ground.outline, edge) > 4) {
        expect(ground.sections.some(s => s.edge === edge && s.technique === 'paired-glass' &&
          s.width - (s.border.left ?? s.border.side) - (s.border.right ?? s.border.side) >= 2 && !s.border.surfaceProfile)).toBe(true);
      }
    }
  });

  it('accepts the minimum parcel and storeys and rejects undersized or malformed input', () => {
    const minimum: FamilyInput = { ...input, rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]], floorHeights: [2.6, 2.6, 2.6] };
    for (const fixedFaces of [false, true]) expect(family.plan({ ...minimum, fixedFaces }).floors).toHaveLength(3);
    for (const bad of [
      { ...input, floorHeights: [3, 3] }, { ...input, floorHeights: [3, 2.59, 3] },
      { ...input, floorHeights: [3, NaN, 3] }, { ...input, floorHeights: [3, Infinity, 3] },
      { ...input, rectangle: [[0, 0], [15.9, 0], [15.9, 20], [0, 20]] },
      { ...input, rectangle: [[0, 0], [20, 0], [20, 15.9], [0, 15.9]] },
      { ...input, rectangle: [[0, 0], [20, 0], [19, 20], [0, 20]] },
      { ...input, rectangle: [[0, 0], [0, 20], [20, 20], [20, 0]] },
      { ...input, rectangle: [[0, 0], [NaN, 0], [20, 20], [0, 20]] },
    ]) expect(() => family.plan(bad as FamilyInput)).toThrow(RangeError);
  });

  it.each(variants)('keeps deterministic attached equipment inside the parcel and clear of openings ($fixedFaces fixed, $rotated rotated)', ({ fixedFaces, rotated }) => {
    const request = source(fixedFaces, rotated), layout = host(request, family.plan(request));
    addDoor(layout); addCuts(layout);
    checkEnvelopes(layout);
    const builder = decorate(layout);
    expect(fingerprint(builder)).toBe(fingerprint(decorate(layout)));
    for (const token of [':condenser:', ':riser:', ':spandrel:', 'skin', 'support', 'fan', 'grille']) {
      expect(builder.parts.some(p => p.name.includes(token) && p.prims.size > 0), token).toBe(true);
    }
    for (const part of builder.parts.filter(p => p.name.includes(':condenser:'))) {
      const floor = layout.floors.find(f => f.index === part.floor)!;
      expect(floor.index).toBeGreaterThan(0);
      let highest = -Infinity;
      for (const prim of part.prims.values()) for (let i = 1; i < prim.positions.length; i += 3) {
        highest = Math.max(highest, prim.positions[i]!);
      }
      expect(highest).toBeLessThanOrEqual(floor.elevation + 1.12 + 1e-7);
    }
    checkVertices(builder, request); checkReservations(builder, layout);
  });

  it.each([false, true])('fits its complete geometry on the minimum parcel and storeys (fixed: %s)', fixedFaces => {
    const request: FamilyInput = { ...input, fixedFaces,
      rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]], floorHeights: [2.6, 2.6, 2.6] };
    const layout = host(request, family.plan(request)), builder = decorate(layout);
    checkVertices(builder, request); checkReservations(builder, layout);
  });

  it('preserves spanning door reservations and recognizable equipment when repeat detail is reduced', () => {
    const request = source(false, true), layout = host(request, family.plan(request));
    addDoor(layout);
    layout.floors[0]!.openings[0]!.door!.clearance!.height = 5;
    const full = decorate(layout);
    layout.detail = new Set(['fittings', 'coverings']);
    const reduced = decorate(layout), triangles = (b: MeshBuilder) => b.parts.reduce((n, p) => n +
      [...p.prims.values()].reduce((sum, prim) => sum + prim.indices.length / 3, 0), 0);
    expect(triangles(reduced)).toBeLessThan(triangles(full));
    for (const token of [':casing', ':fan', ':grille', ':support']) expect(reduced.parts.some(p => p.name.endsWith(token))).toBe(true);
    expect(reduced.parts.filter(p => p.name.includes(':spandrel:')).length).toBe(full.parts.filter(p => p.name.includes(':spandrel:')).length);
    expect(reservations(layout, layout.floors[1]!, 0).some(h => h.u0 < 1.05 && h.u1 > 4.7 && h.y1 > 5)).toBe(true);
    checkVertices(reduced, request); checkReservations(reduced, layout);
  });

  it.each(variants)('keeps one fitted cable between adjacent surviving ACs ($fixedFaces fixed, $rotated rotated)', ({ fixedFaces, rotated }) => {
    for (const reduced of [false, true]) {
      const request = source(fixedFaces, rotated), layout = host(request, family.plan(request));
      if (reduced) layout.detail = new Set(['fittings', 'coverings']);
      const builder = decorate(layout), cable = builder.parts.filter(p => p.name.includes(':service-cable'));
      const conductors = cable.filter(p => p.name.endsWith(':conductor'));
      expect(conductors).toHaveLength(1); expect(cable).toHaveLength(3);
      const match = /^serviced:(\d+):(\d+):service-cable:conductor$/.exec(conductors[0]!.name);
      expect(match).not.toBeNull();
      const floor = layout.floors.find(f => f.index === Number(match![1]))!, edge = Number(match![2]);
      expect(cable.every(p => p.name.startsWith(`serviced:${floor.index}:${edge}:service-cable:`) && p.prims.size > 0)).toBe(true);
      checkCableAttachments(builder, cable, floor, edge); checkCableSpan(cable, floor, edge);
      expect(fingerprint(builder)).toBe(fingerprint(decorate(layout)));
      checkVertices(builder, request); checkReservations(builder, layout);
    }
  });

  it('emits no dangling cable or anchors when aperture reservations remove every AC', () => {
    const request = source(false, true), layout = host(request, family.plan(request));
    for (const floor of layout.floors.filter(f => f.index > 0)) for (let edge = 0; edge < floor.outline.length; edge++) {
      const width = length(floor.outline, edge), y = floor.elevation;
      layout.carved.push({ aperture: { face: edge } as Layout['carved'][number]['aperture'],
        facePoly: [[0, y + 0.12], [width, y + 0.12], [width, y + 1], [0, y + 1]] });
    }
    const builder = decorate(layout);
    expect(builder.parts.some(p => p.name.includes(':condenser:') && p.name.endsWith(':casing'))).toBe(false);
    expect(builder.parts.some(p => p.name.includes(':service-cable'))).toBe(false);
    checkVertices(builder, request); checkReservations(builder, layout);
  });
});
