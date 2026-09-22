import { describe, expect, it } from 'vitest';
import { FacadeField, MeshBuilder, type FamilyInput, type FamilyPlan, type FloorLayout, type Layout, type Point } from '../../api.ts';
import { family } from '../index.ts';
import { reservations, subtract } from '../reservations.ts';

function input(floorHeights = [4.1, 3.2, 4.8], fixedFaces = false): FamilyInput {
  return { rectangle: [[0, 0], [20, 0], [20, 18], [0, 18]], floorHeights, seed: 'storage-contract', fixedFaces };
}

describe('service-storage public family contract', () => {
  it('fits the minimum parcel with 1–3 floors and shared, complete solid and opening divisions', () => {
    for (const floorHeights of [[3], [4.5, 3], [3.3, 4.2, 3.7]]) {
      const request = { ...input(floorHeights), rectangle: [[0, 0], [16, 0], [16, 16], [0, 16]] as FamilyInput['rectangle'] };
      const assembly = family.plan(request);
      expect(assembly).toEqual(family.plan(request));
      expect(assembly.extent).toEqual({ width: 15, depth: 15 });
      expect(assembly.floors).toHaveLength(floorHeights.length);
      expect(assembly.groups).toEqual([{ id: 0, fromFloor: 0, toFloor: floorHeights.length - 1, width: 15, depth: 15 }]);
      for (const floor of assembly.floors) {
        expect(floor.balconySections).toEqual([]);
        for (let edge = 0; edge < 4; edge++) {
          const sections = floor.sections.filter(s => s.edge === edge);
          let cursor = 0;
          for (const section of sections) {
            expect(section.offset).toBeCloseTo(cursor);
            cursor += section.width;
            expect(section.width).toBeGreaterThan(0);
            for (const window of section.windows ?? []) {
              expect(window.offset).toBeGreaterThan(0);
              expect(window.offset + window.width).toBeLessThan(section.width);
              expect(window.sill + window.height).toBeCloseTo(floorHeights[floor.floor]! - section.border.top);
            }
          }
          expect(cursor).toBeCloseTo(15);
          if (floor.floor === 0) {
            const shutters = sections.filter(s => s.id.endsWith(':sealed-shutter'));
            expect(shutters).toHaveLength(2);
            expect(shutters.every(s => s.technique === 'paired-solid' && s.windows?.length === 0 && s.width > 4)).toBe(true);
            const eligible = sections.filter(s => s.technique === 'paired-glass');
            expect(eligible).toHaveLength(1);
            expect(eligible[0]!.id).toMatch(/:entrance$/);
            expect(eligible[0]!.width - 2 * eligible[0]!.border.side).toBeGreaterThanOrEqual(2);
            expect(eligible[0]!.windows).toEqual([]);
          } else {
            expect(sections.filter(s => s.windows?.length)).toHaveLength(3);
            expect(sections.map(s => [s.offset, s.width])).toEqual(assembly.floors[0]!.sections.filter(s => s.edge === edge).map(s => [s.offset, s.width]));
          }
        }
      }
    }
  });

  it('keeps rotated fixed faces exact and rejects invalid floor counts, heights and footprints', () => {
    const request = input([3.6, 4.3], true);
    request.rectangle = request.rectangle.map(([x, z]) => [7 + 0.8 * x - 0.6 * z, -3 + 0.6 * x + 0.8 * z]) as FamilyInput['rectangle'];
    const assembly = family.plan(request);
    expect(assembly.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(request.rectangle))).toBe(true);
    expect(assembly.floors.every(f => f.sections.every(s => s.border.depth === 0))).toBe(true);
    for (const floorHeights of [[], [3, 3, 3, 3], [2.99], [Infinity], [NaN]]) {
      expect(() => family.plan({ ...input(), floorHeights })).toThrow(RangeError);
    }
    for (const rectangle of [
      [[0, 0], [15.99, 0], [15.99, 16], [0, 16]],
      [[0, 0], [16, 0], [18, 16], [2, 16]],
      [[0, 0], [16, 0], [17, 16], [0, 16]],
      [[0, 0], [0, 16], [16, 16], [16, 0]],
      [[0, 0], [Infinity, 0], [16, 16], [0, 16]],
    ]) expect(() => family.plan({ ...input(), rectangle: rectangle as FamilyInput['rectangle'] })).toThrow(RangeError);
  });

  it('builds sealed shutters and concrete with dynamic elevations, and stays within free and fixed rotated parcels', () => {
    for (const fixedFaces of [false, true]) {
      const request = input([3, 4.6, 3.4], fixedFaces);
      request.rectangle = request.rectangle.map(([x, z]) => [5 + 0.8 * x - 0.6 * z, -7 + 0.6 * x + 0.8 * z]) as FamilyInput['rectangle'];
      const assembly = family.plan(request), layout = host(request, assembly);
      const builder = new MeshBuilder();
      builder.floor = -7;
      family.decorate!({ builder, layout, material: role => family.materials![role]! });
      expect(builder.floor).toBe(-7);
      expect(builder.parts.some(p => p.name.endsWith('nonfunctional-panel') && p.prims.has(family.materials!.shutter!))).toBe(true);
      expect(builder.parts.filter(p => p.name.endsWith('nonfunctional-panel')).every(p => p.floor === 0 && !p.pivot)).toBe(true);
      expect(builder.materialSlots()).toContain(family.materials!['service-light']);
      for (const part of builder.parts) for (const primitive of part.prims.values()) {
        expect(primitive.positions.every(Number.isFinite)).toBe(true);
        expect(primitive.normals.every(Number.isFinite)).toBe(true);
        expect(primitive.uvs.every(Number.isFinite)).toBe(true);
        const floor = layout.floors.find(f => f.index === part.floor)!;
        for (let i = 0; i < primitive.positions.length; i += 3) {
          const [x, y, z] = primitive.positions.slice(i, i + 3) as [number, number, number];
          expect(y).toBeGreaterThanOrEqual(floor.elevation - 1e-8);
          expect(y).toBeLessThanOrEqual(floor.elevation + floor.height + 1e-8);
          for (let edge = 0; edge < 4; edge++) {
            const a = request.rectangle[edge]!, b = request.rectangle[(edge + 1) % 4]!;
            expect((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])).toBeGreaterThanOrEqual(-1e-7);
          }
        }
      }
    }
  });

  it('leaves windows, door frames, pocket travel, approaches, transoms and multi-storey cuts clear', () => {
    const request = input(), assembly = family.plan(request), layout = host(request, assembly);
    const ground = layout.floors[0]!, entrance = ground.openings[0]!;
    entrance.transom = 1.35;
    entrance.door = { set: 'industrial-ribbed', frameWidth: 0.11, frameDepth: 0.08, recessDepth: 0.12, thresholdHeight: 0.02,
      cassette: { offset: entrance.offset - 1, sill: 0, width: entrance.width + 1.4, height: 2.85, backDepth: 0.2 },
      clearance: { offset: entrance.offset - 0.1, sill: 0, width: entrance.width + 0.2, height: 2.75, backDepth: 0.22 },
      motion: { kind: 'pocket', maxTravel: 1.5, clearDepth: 0, leaves: [{ leaf: 0, travelU: -1.5,
        pocket: { offset: entrance.offset - 2.1, sill: 0.02, width: 1.8, height: 2.8, backDepth: 0.2, frontDepth: 0.12 } }] } };
    const field = new FacadeField(ground.outline, 1);
    layout.anchors = [{ id: 'wire', edge: 1, position: field.point(1.2, 2, 0), normal: [...field.normal], size: 0.35, standoff: 0.02 }];
    layout.carved.push({ aperture: { id: 'cross-floor', buildingId: 'storage', floor: 0, face: 0, kind: 'bridge', u: 2,
      base: 3.6, width: 2.2, height: 2, shape: 'rect', linkId: 'link', cut: { polygon: [], axisDir: [0, 0, 1] } },
      facePoly: [[2, 3.6], [4.2, 3.6], [4.2, 5.6], [2, 5.6]] });
    const reserved = reservations(layout, ground, 0);
    expect(reserved.some(r => r.left < entrance.offset - 2.1 && r.right > entrance.offset + entrance.width + 0.4 && r.top > ground.height)).toBe(true);
    expect(subtract({ left: 0, right: 7, bottom: 0, top: 7 }, [{ left: 2, right: 5, bottom: 2, top: 5 }])
      .reduce((sum, r) => sum + (r.right - r.left) * (r.top - r.bottom), 0)).toBe(40);
    const builder = new MeshBuilder();
    family.decorate!({ builder, layout, material: role => `test/${role}/mid` });
    for (const part of builder.parts) {
      const edge = Number(part.name.split(':')[2]);
      const floor = layout.floors.find(f => f.index === part.floor)!;
      const face = new FacadeField(floor.outline, edge), origin = floor.outline[edge]!;
      const holes = reservations(layout, floor, edge);
      for (const primitive of part.prims.values()) for (let i = 0; i < primitive.indices.length; i += 3) {
        const vertices = primitive.indices.slice(i, i + 3).map(index => primitive.positions.slice(index * 3, index * 3 + 3));
        const us = vertices.map(p => (p[0]! - origin[0]) * face.dir[0] + (p[2]! - origin[1]) * face.dir[1]);
        const ys = vertices.map(p => p[1]!);
        for (const hole of holes) {
          const crosses = Math.min(...us) < hole.right - 1e-7 && Math.max(...us) > hole.left + 1e-7
            && Math.min(...ys) < hole.top - 1e-7 && Math.max(...ys) > hole.bottom + 1e-7;
          expect(crosses, `${part.name} crosses a protected face-plane volume`).toBe(false);
        }
      }
    }
  });
});

function host(request: FamilyInput, assembly: FamilyPlan): Layout {
  let elevation = 0;
  const floors: FloorLayout[] = assembly.floors.map(plan => {
    const floor: FloorLayout = { index: plan.floor, kind: plan.floor ? 'office' : 'service', elevation,
      height: request.floorHeights[plan.floor]!, outline: plan.outline.map(p => [...p] as Point), assembly: plan, openings: [] };
    for (const section of plan.sections) for (const window of section.windows ?? []) floor.openings.push({
      id: `${floor.index}:${section.id}`, kind: 'window', sectionId: section.id, edge: section.edge,
      offset: section.offset + window.offset, width: window.width, sill: window.sill, height: window.height,
    });
    if (plan.floor === 0) {
      const entry = plan.sections.find(s => s.edge === 0 && s.id.endsWith(':entrance'))!;
      floor.openings.push({ id: 'entry', sectionId: entry.id, kind: 'door', doorRole: 'main', edge: 0,
        offset: entry.offset + entry.border.side, width: entry.width - entry.border.side * 2, sill: 0, height: 2.7 });
    }
    elevation += floor.height;
    return floor;
  });
  return { assembly: { ...assembly, architecture: 'paired-rectangular' }, request: { parcel: { footprint: request.rectangle } },
    floors, carved: [], lights: [], signage: [], screens: [], anchors: [], balconyBands: [], fireEscape: null } as unknown as Layout;
}
