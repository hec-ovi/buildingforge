import { NodeIO, type Node } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate, type BuildingRequest, type Blueprint } from '../src/index.ts';

type V3 = [number, number, number];
type Triangle = [V3, V3, V3];
type Floor = Blueprint['floors'][number];
type Opening = Floor['openings'][number];
type Bounds = { min: V3; max: V3 };
const keys = { textures: { mode: 'keys' as const } };
const residence: BuildingRequest = JSON.parse(readFileSync(new URL('../fixtures/pocket-paired.request.json', import.meta.url), 'utf8'));

function request(access = 15, angle = 0): BuildingRequest {
  const origin: [number, number] = angle ? [71.125, -42.375] : [0, 0];
  const rotate = ([x, z]: number[]): [number, number] => [origin[0] + x! * Math.cos(angle) - z! * Math.sin(angle),
    origin[1] + x! * Math.sin(angle) + z! * Math.cos(angle)];
  return {
    ...residence,
    parcel: { footprint: [[0, 0], [30, 0], [30, 24], [0, 24]].map(rotate), accessPoint: rotate([access, 0]),
      maxHeight: 16, buildingGrid: { origin, angle, spacing: 0.5 } },
    building: { ...residence.building },
    options: { ...residence.options },
  };
}

describe('ground pocket entrance contract', () => {
  it('authors complete textured moving leaves, collision-free travel and clear full-open passages in both GLB modes', async () => {
    for (const [access, angle, count] of [[15, 0, 2], [0, 0.61, 1]] as const) {
      let canonical: Blueprint | undefined;
      let leafGeometry: Triangle[][] | undefined;
      for (const mode of ['named', 'merged'] as const) {
        const req = request(access, angle);
        if (count === 1) { req.building.type = 'factory'; req.parcel.maxHeight = 21; }
        req.options!.glb = mode;
        const result = await generate(req, keys);
        const floor = result.blueprint.floors.find((item) => item.index === 0)!;
        const opening = floor.openings.find((item) => item.doorRole === 'main')!;
        const assembly = opening.door!, motion = assembly.motion;
        expect(motion.kind).toBe('pocket');
        if (motion.kind !== 'pocket') throw new Error('expected pocket');
        expect(opening.leaves).toBe(count);
        expect(motion.leaves.map((leaf) => leaf.leaf)).toEqual(Array.from({ length: count }, (_, i) => i));
        expect(motion.maxTravel).toBe(Math.max(...motion.leaves.map((leaf) => Math.abs(leaf.travelU))));
        expect(motion.clearDepth).toBe(0);
        expect(assembly.clearance).toEqual({ offset: opening.offset, sill: opening.sill, width: opening.width,
          height: opening.height, backDepth: assembly.cassette!.backDepth });
        expect(result.blueprint.facade.wallDepth).toBeGreaterThanOrEqual(assembly.cassette!.backDepth);
        expect(result.blueprint.coreFrame?.anglesDeg).toHaveLength(2);
        expect(result.blueprint.facade.coreAdjacency!.glazing).toEqual({ role: 'circulation', clearDepth: 1.2 });
        if (canonical) expect(result.blueprint).toEqual(canonical);
        canonical = result.blueprint;

        const doc = await new NodeIO().readBinary(result.glb);
        const nodes = doc.getRoot().listNodes();
        const leaves = motion.leaves.map((leaf) => nodes.find((node) => node.getName() === `door:${opening.id}/leaf:${leaf.leaf}`)!);
        const geometry = leaves.map((node) => triangles(node, floor, opening.edge));
        if (leafGeometry) expect(geometry).toEqual(leafGeometry);
        leafGeometry = geometry;
        const fixed = nodes.filter((node) => !leaves.includes(node)).flatMap((node) => triangles(node, floor, opening.edge));
        for (const node of leaves) {
          expect(node.getMesh()!.listPrimitives().every((primitive) => !primitive.getMaterial()!.getName().includes('glass')
            && !primitive.getMaterial()!.getName().includes('light-fixture'))).toBe(true);
          expect(node.getMesh()!.listPrimitives().some((primitive) => primitive.getMaterial()!.getName() === opening.material)).toBe(true);
          for (const primitive of node.getMesh()!.listPrimitives()) {
            expect(primitive.getAttribute('TEXCOORD_0')!.getCount()).toBe(primitive.getAttribute('POSITION')!.getCount());
          }
        }
        for (const fraction of [0, 0.5, 1]) {
          const moving = geometry.map((mesh, i) => mesh.map((triangle) => triangle.map(([u, y, depth]): V3 =>
            [u + motion.leaves[i]!.travelU * fraction, y, depth]) as Triangle));
          for (const [index, mesh] of moving.entries()) {
            const bounds = boundsOf(mesh);
            expect(fixed.some((triangle) => triangleInBox(triangle, bounds)), `static intersection at ${fraction}, leaf ${index}`).toBe(false);
            if (fraction === 1) {
              const pocket = motion.leaves[index]!.pocket;
              expect(bounds.min[0]).toBeGreaterThan(pocket.offset);
              expect(bounds.max[0]).toBeLessThan(pocket.offset + pocket.width);
              expect(bounds.min[1]).toBeGreaterThan(pocket.sill);
              expect(bounds.max[1]).toBeLessThan(pocket.sill + pocket.height);
              expect(bounds.min[2]).toBeGreaterThan(pocket.frontDepth);
              expect(bounds.max[2]).toBeLessThan(pocket.backDepth);
              // Both skins hide the complete retracted leaf, without opacity changes.
              for (const depth of [0, assembly.cassette!.backDepth]) {
                const center: V3 = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, depth];
                expect(fixed.some((triangle) => planarContains(triangle, center)), `missing opaque skin at ${depth}`).toBe(true);
              }
            }
          }
          const clear = assembly.clearance!;
          const passage: Bounds = { min: [clear.offset, clear.sill + 0.001, -assembly.frameDepth],
            max: [clear.offset + clear.width, clear.sill + clear.height, clear.backDepth] };
          const obstruction = [...fixed, ...moving.flat()].some((triangle) => triangleInBox(triangle, passage));
          expect(obstruction, `passage state at ${fraction}`).toBe(fraction !== 1);
        }
        if (mode === 'named') {
          const wall = nodes.find((node) => node.getName() === `wall:0/${opening.edge}`)!;
          const cassette = assembly.cassette!;
          expect(triangles(wall, floor, opening.edge).some((triangle) => triangleInBox(triangle, {
            min: [cassette.offset, cassette.sill, -0.001],
            max: [cassette.offset + cassette.width, cassette.sill + cassette.height, 0.001],
          }))).toBe(false);
          const again = await generate(req, keys);
          expect(again.glb).toEqual(result.glb);
          expect(again.blueprint).toEqual(result.blueprint);
        }
      }
    }
  }, 30_000);

  it('reserves repeated complete cassettes before display glazing, partition seats and facade services', async () => {
    const req = request();
    req.parcel.footprint = [[0, 0], [100, 0], [100, 28], [0, 28]];
    req.parcel.accessPoint = [50, 0];
    req.building = { type: 'commerce', tier: 'rich', floors: 3 };
    req.options = { ...req.options, entranceLayout: 'repeated', exteriorStyle: 'premium-office' };
    const { blueprint } = await generate(req, keys);
    const floor = blueprint.floors.find((item) => item.index === 0)!;
    const doors = floor.openings.filter((opening) => opening.door?.motion.kind === 'pocket');
    expect(doors.length).toBeGreaterThan(1);
    for (const opening of doors) {
      const cassette = opening.door!.cassette!;
      const start = cassette.offset, end = start + cassette.width;
      for (const other of floor.openings.filter((item) => item !== opening && item.edge === opening.edge)) {
        const field = other.door?.cassette ?? other;
        expect(field.offset >= end + 0.299 || field.offset + field.width <= start - 0.299).toBe(true);
      }
      const grid = blueprint.facade.grids.find((item) => item.floor === 0 && item.edge === opening.edge)!;
      expect(grid.solid.every(([a, b]) => b <= start + 0.001 || a >= end - 0.001)).toBe(true);
      expect(grid.partitionAnchors.every((anchor) => anchor.offset < start || anchor.offset > end)).toBe(true);
    }
    expect(floor.openings.some((opening) => opening.kind === 'openFront')).toBe(false);
    expect(floor.openings.filter((opening) => opening.kind === 'window').length).toBeGreaterThan(0);
  });

  it('rejects contradictory options and unfittable required motion while preserving legacy mechanisms', async () => {
    const badOption = request();
    badOption.options = { ...badOption.options, doorMotion: 'hinge' as never };
    await expect(generate(badOption, keys)).rejects.toMatchObject({ code: 'E_SCHEMA' });
    const conflict = request();
    conflict.options!.openFront = 'on';
    await expect(generate(conflict, keys)).rejects.toMatchObject({ code: 'E_SCHEMA' });
    const constrained = request();
    constrained.apertures = constrained.parcel.footprint.map((a, face, ring) => {
      const b = ring[(face + 1) % ring.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      const position = (u: number, y: number): V3 => [a[0] + dx * u, y, a[1] + dz * u];
      return { id: `bridge:${face}`, buildingId: constrained.buildingId, floor: 0, face, kind: 'bridge',
        u: length / 2, base: 0, width: length - 6, height: 2.5, shape: 'rect', linkId: `link:${face}`,
        cut: { polygon: [position(3, 0), position(length - 3, 0), position(length - 3, 2.5), position(3, 2.5)], axisDir: [dz, 0, -dx] } };
    });
    await expect(generate(constrained, keys)).rejects.toMatchObject({ code: 'E_DOOR_FIT' });
    const legacy = request();
    delete legacy.options!.doorMotion;
    legacy.building.type = 'factory';
    legacy.parcel.maxHeight = 21;
    const standard = await generate(legacy, keys);
    expect(standard.blueprint.floors[0]!.openings.find((opening) => opening.doorRole === 'main')!.door!.motion.kind).toBe('swing');
    expect(standard.blueprint.floors[0]!.openings.some((opening) => opening.doorRole === 'service' && opening.door!.motion.kind === 'roller')).toBe(true);
    legacy.options!.doorMotion = 'swing';
    expect((await generate(legacy, keys)).glb).toEqual(standard.glb);
    legacy.options!.doorMotion = 'pocket';
    const pocket = await generate(legacy, keys);
    expect(pocket.blueprint.floors[0]!.openings.find((opening) => opening.doorRole === 'main')!.door!.motion.kind).toBe('pocket');
    expect(pocket.blueprint.floors[0]!.openings.some((opening) => opening.doorRole === 'service' && opening.door!.motion.kind === 'roller')).toBe(true);
  });
});

function triangles(node: Node, floor: Floor, edge: number): Triangle[] {
  const origin = floor.outline[edge]!, end = floor.outline[(edge + 1) % floor.outline.length]!;
  const length = Math.hypot(end[0] - origin[0], end[1] - origin[1]);
  const dx = (end[0] - origin[0]) / length, dz = (end[1] - origin[1]) / length;
  const translation = node.getTranslation();
  return (node.getMesh()?.listPrimitives() ?? []).flatMap((primitive) => {
    const position = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!.getArray()!;
    const vertices = Array.from({ length: position.getCount() }, (_, i): V3 => {
      const p = position.getElement(i, [0, 0, 0]);
      const x = p[0]! + translation[0] - origin[0], z = p[2]! + translation[2] - origin[1];
      return [x * dx + z * dz, p[1]! + translation[1] - floor.elevation, -x * dz + z * dx];
    });
    return Array.from({ length: indices.length / 3 }, (_, i): Triangle =>
      [vertices[indices[i * 3]!]!, vertices[indices[i * 3 + 1]!]!, vertices[indices[i * 3 + 2]!]!]);
  });
}

function boundsOf(mesh: Triangle[]): Bounds {
  const points = mesh.flat();
  return { min: [0, 1, 2].map((axis) => Math.min(...points.map((p) => p[axis]!))) as V3,
    max: [0, 1, 2].map((axis) => Math.max(...points.map((p) => p[axis]!))) as V3 };
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Triangle/AABB separating axes, ignoring face contact within the GLB float tolerance. */
function triangleInBox(triangle: Triangle, bounds: Bounds): boolean {
  const center = bounds.min.map((lo, axis) => (lo + bounds.max[axis]!) / 2) as V3;
  const half = bounds.min.map((lo, axis) => Math.max(0, (bounds.max[axis]! - lo) / 2 - 0.00005)) as V3;
  const points = triangle.map((p) => sub(p, center));
  const edges = [sub(points[1]!, points[0]!), sub(points[2]!, points[1]!), sub(points[0]!, points[2]!)];
  const basis: V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const axes = [...basis, cross(edges[0]!, edges[1]!), ...edges.flatMap((edge) => basis.map((axis) => cross(edge, axis)))];
  return axes.every((axis) => {
    if (dot(axis, axis) < 1e-16) return true;
    const radius = Math.abs(axis[0]) * half[0] + Math.abs(axis[1]) * half[1] + Math.abs(axis[2]) * half[2];
    const projection = points.map((p) => dot(p, axis));
    return Math.min(...projection) <= radius && Math.max(...projection) >= -radius;
  });
}

function planarContains(triangle: Triangle, point: V3): boolean {
  if (triangle.some((vertex) => Math.abs(vertex[2] - point[2]) > 0.00005)) return false;
  const side = (a: V3, b: V3, p: V3) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (Math.abs(side(triangle[0], triangle[1], triangle[2])) < 1e-10) return false;
  const values = triangle.map((vertex, i) => side(vertex, triangle[(i + 1) % 3]!, point));
  return values.every((v) => v >= -0.00001) || values.every((v) => v <= 0.00001);
}
