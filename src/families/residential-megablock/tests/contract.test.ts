import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import nativeCatalog from '../../../../public/native-materials/themes/cyberpunk/theme.json' with { type: 'json' };
import { MeshBuilder, type FamilyInput, type FamilyPlan, type Layout, type Point } from '../../api.ts';
import { family } from '../index.ts';

const input: FamilyInput = {
  rectangle: [[0, 0], [26.25, 0], [26.25, 18.75], [0, 18.75]],
  floorHeights: [3.6, 2.6, 3.1, 3.4, 2.8, 3.2, 3.7, 2.7, 3, 3.3],
  seed: 'megablock-contract',
};
type Part = MeshBuilder['parts'][number];
type Reservation = { edge: number; left: number; right: number; bottom: number; top: number };

function layoutFor(source: FamilyInput, plan: FamilyPlan): Layout {
  let elevation = 0;
  return {
    request: { seed: source.seed, parcel: { footprint: source.rectangle } },
    assembly: { ...plan, architecture: family.id }, carved: [], lights: [],
    floors: plan.floors.map(assembly => {
      const height = source.floorHeights[assembly.floor]!;
      const floor = {
        index: assembly.floor, kind: 'residential', elevation, height, outline: assembly.outline, assembly,
        openings: assembly.sections.flatMap(section => (section.windows ?? []).map((window, index) => ({
          id: `${section.id}:window:${index}`, kind: 'window', edge: section.edge,
          offset: section.offset + window.offset, width: window.width, sill: window.sill, height: window.height,
        }))),
      };
      elevation += height;
      return floor;
    }),
  } as unknown as Layout;
}

function rotated(source: FamilyInput): FamilyInput {
  return { ...source, rectangle: source.rectangle.map(([x, z]) =>
    [7 + x * 0.8 - z * 0.6, -13 + x * 0.6 + z * 0.8]) as FamilyInput['rectangle'] };
}

function worldVertex(part: Part, positions: number[], index: number): [number, number, number] {
  return [0, 1, 2].map(axis => positions[index * 3 + axis]! + (part.pivot?.[axis] ?? 0)) as [number, number, number];
}

function facePoint(outline: Point[], edge: number, point: [number, number, number]): [number, number, number] {
  const a = outline[edge]!, b = outline[(edge + 1) % 4]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  const x = point[0] - a[0], z = point[2] - a[1];
  return [x * dx + z * dz, point[1], x * dz - z * dx];
}

function expectInsideParcel(builder: MeshBuilder, source: FamilyInput): void {
  const width = Math.hypot(source.rectangle[1][0] - source.rectangle[0][0], source.rectangle[1][1] - source.rectangle[0][1]);
  const depth = Math.hypot(source.rectangle[3][0] - source.rectangle[0][0], source.rectangle[3][1] - source.rectangle[0][1]);
  const invalid = new Set<string>(), outside = new Set<string>();
  let vertices = 0;
  for (const part of builder.parts) {
    expect(part.name).toMatch(/^megablock:/);
    expect(Number.isInteger(part.floor)).toBe(true);
    expect(part.floor).toBeGreaterThanOrEqual(0);
    expect(part.floor).toBeLessThan(source.floorHeights.length);
    for (const prim of part.prims.values()) {
      if (![...prim.positions, ...prim.normals, ...prim.uvs].every(Number.isFinite)) invalid.add(part.name);
      for (let index = 0; index < prim.positions.length / 3; index++) {
        const [u, , outward] = facePoint(source.rectangle, 0, worldVertex(part, prim.positions, index));
        const v = -outward;
        if (u < -1e-7 || u > width + 1e-7 || v < -1e-7 || v > depth + 1e-7) outside.add(part.name);
        vertices++;
      }
    }
  }
  expect(vertices).toBeGreaterThan(0);
  expect([...invalid]).toEqual([]);
  expect([...outside]).toEqual([]);
}

function reservationHits(builder: MeshBuilder, rectangle: Point[], reservation: Reservation): string[] {
  const hits = new Set<string>();
  // Check the open interior, leaving boundary reveals and window frames clear.
  const margin = 0.08;
  for (const part of builder.parts) for (const prim of part.prims.values()) {
    for (let index = 0; index < prim.indices.length; index += 3) {
      const triangle = prim.indices.slice(index, index + 3).map(i => worldVertex(part, prim.positions, i));
      const centre = [0, 1, 2].map(axis => triangle.reduce((sum, p) => sum + p[axis]!, 0) / 3) as [number, number, number];
      const [u, y, depth] = facePoint(rectangle, reservation.edge, centre);
      if (Math.abs(depth) < 1 && u > reservation.left + margin && u < reservation.right - margin
        && y > reservation.bottom + margin && y < reservation.top - margin) hits.add(part.name);
    }
  }
  return [...hits];
}

function decorate(layout: Layout, builder = new MeshBuilder()): MeshBuilder {
  family.decorate!({ builder, layout, material: role => {
    expect(family.materials?.[role], `material role ${role}`).toBeDefined();
    return family.materials![role]!;
  } });
  return builder;
}

describe('residential megablock public family contract', () => {
  it('fits centered half-metre plates and consecutive four-floor residential groups deterministically', () => {
    expect(family.id).toBe('residential-megablock');
    const before = structuredClone(input);
    const plan = family.plan(input);
    expect(plan.grid).toBe(0.5);
    expect(plan.extent).toEqual({ width: 25.5, depth: 18 });
    expect(plan.groups.map(group => [group.id, group.fromFloor, group.toFloor])).toEqual([
      [0, 0, 0], [1, 1, 4], [2, 5, 8], [3, 9, 9],
    ]);
    expect(plan.floors).toHaveLength(input.floorHeights.length);
    for (const floor of plan.floors) {
      const group = floor.floor === 0 ? 0 : 1 + Math.floor((floor.floor - 1) / 4);
      const inset = Math.min(1.2, Math.max(0, group - 1) * 0.4);
      expect(floor.group).toBe(group);
      expect(floor.balconySections).toEqual([]);
      const expected = [[0.375 + inset, 0.375 + inset], [25.875 - inset, 0.375 + inset],
        [25.875 - inset, 18.375 - inset], [0.375 + inset, 18.375 - inset]];
      expect(floor.outline).toHaveLength(4);
      floor.outline.forEach((point, index) => point.forEach((value, axis) => expect(value).toBeCloseTo(expected[index]![axis]!, 8)));
    }
    for (const seed of [input.seed, 'megablock-another-seed', input.seed]) {
      const seeded = { ...input, seed };
      expect(family.plan(seeded)).toEqual(family.plan(structuredClone(seeded)));
    }
    expect(family.plan(input)).toEqual(plan);
    expect(input).toEqual(before);
    const tall = family.plan({ ...input, floorHeights: Array(30).fill(3) });
    const last = tall.floors.at(-1)!;
    expect(last.outline[0]![0] - tall.floors[0]!.outline[0]![0]).toBeCloseTo(1.2, 8);
  });

  it('partitions every edge with paired upper windows and opaque ground-floor entry bays', () => {
    for (const source of [input, { ...rotated(input), fixedFaces: true }]) {
      const plan = family.plan(source);
      for (const floor of plan.floors) for (let edge = 0; edge < 4; edge++) {
        const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % 4]!;
        const sections = floor.sections.filter(section => section.edge === edge);
        expect(sections.length).toBeGreaterThan(0);
        expect(sections.some(section => section.technique === 'paired-glass')).toBe(true);
        let offset = 0;
        for (const section of sections) {
          expect(section.offset).toBeCloseTo(offset, 8);
          expect(section.width).toBeGreaterThan(0);
          offset += section.width;
          expect(Array.isArray(section.windows)).toBe(true);
          if (floor.floor === 0 || section.technique !== 'paired-glass') expect(section.windows).toEqual([]);
          else {
            expect(section.windows).toHaveLength(2);
            const [left, right] = section.windows!;
            expect(left!.offset + left!.width).toBeLessThanOrEqual(right!.offset);
            for (const window of section.windows!) {
              expect(window.panes).toEqual({ cols: 2, rows: 2 });
              expect(window.offset).toBeGreaterThanOrEqual(0);
              expect(window.width).toBeGreaterThan(0);
              expect(window.offset + window.width).toBeLessThanOrEqual(section.width);
              expect(window.sill).toBeGreaterThanOrEqual(0);
              expect(window.height).toBeGreaterThan(0);
              expect(window.sill + window.height).toBeLessThan(source.floorHeights[floor.floor]!);
            }
          }
        }
        expect(offset).toBeCloseTo(Math.hypot(b[0] - a[0], b[1] - a[1]), 8);
      }
    }
  });

  it('preserves exact rotated fixed faces and accepts the minimum parcel and storey height', () => {
    const source = { ...rotated(input), fixedFaces: true };
    const plan = family.plan(source);
    expect(plan.extent.width).toBeCloseTo(26.25, 8);
    expect(plan.extent.depth).toBeCloseTo(18.75, 8);
    for (const floor of plan.floors) expect(floor.outline).toEqual(source.rectangle);
    for (const fixedFaces of [false, true]) for (const [width, depth] of [[20, 16], [16, 20]] as const) {
      const minimum: FamilyInput = { rectangle: [[0, 0], [width, 0], [width, depth], [0, depth]], floorHeights: [2.6], seed: 'minimum', fixedFaces };
      expect(family.plan(minimum).floors).toHaveLength(1);
      expect(family.plan(minimum).extent).toEqual({ width: fixedFaces ? width : width - 1, depth: fixedFaces ? depth : depth - 1 });
    }
  });

  it('rejects missing or invalid heights and non-rectangular, clockwise, or undersized parcels', () => {
    for (const floorHeights of [[], [2.599], [NaN], [Infinity], [3, -Infinity]]) {
      expect(() => family.plan({ ...input, floorHeights })).toThrow(RangeError);
    }
    const invalid: FamilyInput['rectangle'][] = [
      [[0, 0], [19.99, 0], [19.99, 16], [0, 16]],
      [[0, 0], [20, 0], [20, 15.99], [0, 15.99]],
      [[0, 0], [0, 18], [24, 18], [24, 0]],
      [[0, 0], [24, 0], [23, 18], [0, 18]],
      [[0, 0], [24, 0], [26, 18], [2, 18]],
      [[0, 0], [Infinity, 0], [24, 18], [0, 18]],
      [[NaN, 0], [24, 0], [24, 18], [0, 18]],
    ];
    for (const rectangle of invalid) expect(() => family.plan({ ...input, rectangle })).toThrow(RangeError);
  });

  it('emits finite floor-tagged decoration within free and rotated fixed parcels and restores builder state', () => {
    for (const source of [input, rotated(input), { ...rotated(input), fixedFaces: true }]) {
      const plan = family.plan(source), builder = new MeshBuilder();
      builder.floor = 99;
      decorate(layoutFor(source, plan), builder);
      expect(builder.floor).toBe(99);
      expectInsideParcel(builder, source);
      const repeated = decorate(layoutFor(source, plan));
      expect(repeated.floor).toBeUndefined();
      expect(repeated.parts).toEqual(builder.parts);
      expect(builder.materialSlots().every(slot => Object.values(family.materials!).includes(slot))).toBe(true);
    }
    const slots = Object.values(family.materials!);
    for (const role of ['wall', 'column', 'roof']) expect(family.materials![role]).toBe('cyberpunk/concrete-monolith/mid#weathered');
    expect(slots).toContain('cyberpunk/exterior-graphite-concrete/mid#native');
    const catalog = JSON.parse(readFileSync(new URL('../../../../../materials/themes/cyberpunk/theme.json', import.meta.url), 'utf8'));
    const entries: Record<string, { variants: { id: string; maps: Record<string, string> }[] }> = { ...catalog.entries, ...nativeCatalog.entries };
    for (const slot of slots) {
      expect(slot).toMatch(/^cyberpunk\/[^/#]+\/(poor|mid|rich)#[^#]+$/);
      const [key, variant] = slot.split('#');
      const resolved = entries[key!]?.variants.find(candidate => candidate.id === variant);
      expect(resolved, `catalog slot ${slot}`).toBeDefined();
      expect(resolved?.maps.basecolor, `image source ${slot}`).toBeTruthy();
    }
  });

  it('keeps door and rectangular aperture interiors clear on rotated fixed faces', () => {
    const source = { ...rotated(input), fixedFaces: true };
    const plan = family.plan(source), layout = layoutFor(source, plan);
    const reservations: Reservation[] = [
      { edge: 0, left: 11.5, right: 14.5, bottom: 0, top: 2.7 },
      { edge: 0, left: 5, right: 9, bottom: layout.floors[1]!.elevation, top: layout.floors[2]!.elevation },
      { edge: 2, left: 11, right: 15, bottom: layout.floors[5]!.elevation + 0.2, top: layout.floors[6]!.elevation - 0.2 },
    ];
    const before = decorate(layoutFor(source, plan));
    for (const reservation of reservations) expect(reservationHits(before, source.rectangle, reservation).length).toBeGreaterThan(0);
    const door = reservations[0]!;
    layout.floors[0]!.openings.push({ id: 'entry', kind: 'door', edge: door.edge, offset: door.left,
      width: door.right - door.left, sill: 0, height: door.top } as Layout['floors'][number]['openings'][number]);
    for (const reservation of reservations.slice(1)) {
      const { edge, left, right, bottom, top } = reservation;
      layout.carved.push({ aperture: { face: edge, kind: 'bridge' }, facePoly: [
        [left, bottom], [right, bottom], [right, top], [left, top],
      ] } as Layout['carved'][number]);
    }
    const builder = decorate(layout);
    expectInsideParcel(builder, source);
    for (const reservation of reservations) expect(reservationHits(builder, source.rectangle, reservation)).toEqual([]);
  });

  it('anchors service risers into their wall and omits them when a bridge crosses their service pier', () => {
    const source: FamilyInput = { ...input, rectangle: [[0, 0], [32, 0], [32, 24], [0, 24]], floorHeights: [3.6, 3.1, 3.1], fixedFaces: true };
    const plan = family.plan(source), layout = layoutFor(source, plan), floor = layout.floors[1]!;
    const section = floor.assembly!.sections.find(candidate => candidate.edge === 0 && candidate.id.endsWith(':service'))!;
    expect(section).toBeDefined();
    const before = decorate(layout);
    const services = before.parts.filter(part => part.name.startsWith('megablock:service:1:0:'));
    expect(services.length).toBeGreaterThan(0);
    layout.detail = new Set(['fittings']);
    const simplified = decorate(layout);
    expect(simplified.parts.filter(part => !part.name.startsWith('megablock:service:')))
      .toEqual(before.parts.filter(part => !part.name.startsWith('megablock:service:')));
    const simplerServices = simplified.parts.filter(part => part.name.startsWith('megablock:service:1:0:'));
    expect(simplerServices).toHaveLength(services.length);
    for (const [index, part] of simplerServices.entries()) {
      const slot = family.materials!['megablock-service']!;
      expect(part.prims.get(slot)!.indices.length).toBeLessThan(services[index]!.prims.get(slot)!.indices.length);
    }
    const skin = before.parts.find(part => part.name === 'megablock:skin:1:0')!;
    const concrete = skin.prims.get(family.materials!['wall-trim']!)!;
    const wallFront = Math.max(...Array.from({ length: concrete.positions.length / 3 }, (_, index) =>
      facePoint(floor.outline, 0, worldVertex(skin, concrete.positions, index))[2]));
    for (const part of [...services, ...simplerServices]) {
      const steel = part.prims.get(family.materials!['megablock-service']!)!;
      expect(steel).toBeDefined();
      expect(part.prims.has(family.materials!['window-frame']!)).toBe(true);
      const points = Array.from({ length: steel.positions.length / 3 }, (_, index) =>
        facePoint(floor.outline, 0, worldVertex(part, steel.positions, index)));
      const embedded = points.filter(point => point[2] <= wallFront);
      expect(embedded.length).toBeGreaterThan(0);
      expect(Math.max(...points.map(point => point[2]))).toBeGreaterThan(wallFront + 0.1);
      expect(Math.max(...embedded.map(point => point[1])) - Math.min(...embedded.map(point => point[1]))).toBeGreaterThan(0.8);
    }
    layout.carved.push({ aperture: { face: 0, kind: 'bridge' }, facePoly: [
      [section.offset, floor.elevation], [section.offset + section.width, floor.elevation],
      [section.offset + section.width, floor.elevation + floor.height], [section.offset, floor.elevation + floor.height],
    ] } as Layout['carved'][number]);
    const after = decorate(layout);
    expect(after.parts.some(part => part.name === `megablock:service:1:0:${section.id}`)).toBe(false);
  });
});
