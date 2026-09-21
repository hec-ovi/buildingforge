import { expect, it } from 'vitest';
import type { Document } from '@gltf-transform/core';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest, type Blueprint } from '../src/index.ts';
import { glbIO, keys } from './support.ts';
import { familyFixtures } from './family-fixtures.ts';
import { FacadeField } from '../src/mesh/facadeField.ts';

function request(architecture: 'garden-taper' | 'corporate-sectors'): BuildingRequest {
  return { seed: 'garden-reference', buildingId: 'lining', theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [52, 0], [52, 42], [0, 42]], accessPoint: [26, 0], maxHeight: architecture === 'garden-taper' ? 32 : 60 },
    building: { type: 'residential', tier: 'rich', floors: architecture === 'garden-taper' ? 4 : 12 },
    options: { architecture, glb: 'named', balconies: 'off', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', fireEscape: 'off', signage: null } };
}

function surfaces(document: Document): Mesh[] {
  return document.getRoot().listNodes().flatMap(node => node.getMesh()?.listPrimitives().map(primitive => {
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!), 3));
    geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    mesh.name = node.getName();
    mesh.userData.material = primitive.getMaterial()!.getName();
    mesh.position.fromArray(node.getTranslation());
    mesh.updateMatrixWorld();
    return mesh;
  }) ?? []);
}

/** Follow the published east face at a chosen height; its window offsets scale with that face. */
function eastPoint(floor: Blueprint['floors'][number], offset: number, y: number, depth: number): Vector3 {
  const t = (y - floor.elevation) / floor.height;
  const upper = floor.topOutline ?? floor.outline;
  const start = floor.outline[1]!, end = floor.outline[2]!;
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const u = offset / length;
  const a = start.map((value, i) => value + (upper[1]![i]! - value) * t);
  const b = end.map((value, i) => value + (upper[2]![i]! - value) * t);
  const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, span = Math.hypot(dx, dz);
  return new Vector3(a[0]! + dx * u - dz / span * depth, y, a[1]! + dz * u + dx / span * depth);
}

function dispose(meshes: Mesh[]): void { for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); } }

it('keeps balcony window jambs, heads and sills closed when real interiors remove the scenery', async () => {
  for (const [width, depth, floors] of [[20.5, 37.5, 3], [37.5, 20.5, 7]] as const) {
    const { blueprint, glb } = await generate({ seed: 'lining-clearance', buildingId: 'paired-reveals', theme: 'cyberpunk',
      parcel: { footprint: [[0, 0], [width, 0], [width, depth], [0, depth]], accessPoint: [0, depth / 2], maxHeight: floors * 4.5 },
      building: { type: 'corpo', tier: 'high_rich', floors }, options: { architecture: 'balcony-grid', glb: 'named' } }, keys);
    const all = surfaces(await glbIO().readBinary(glb));
    const permanent = all.filter(mesh => !mesh.name.startsWith('scenery:'));
    let checked = 0;
    for (const floor of [blueprint.floors[1]!, blueprint.floors.at(-1)!]) for (const o of floor.openings) {
      if (!o.scenery || !o.glazing) continue;
      const a = floor.outline[o.edge]!, b = floor.outline[(o.edge + 1) % floor.outline.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const along = new Vector3((b[0] - a[0]) / len, 0, (b[1] - a[1]) / len);
      const inset = o.glazing.glassDepth + (blueprint.facade.wallDepth - o.glazing.glassDepth) * .61;
      const point = (u: number, y: number) => new Vector3(a[0] + along.x * u - along.z * inset,
        floor.elevation + y, a[1] + along.z * u + along.x * inset);
      const probes: [Vector3, Vector3][] = [
        [point(o.offset + o.width * .413, o.sill), new Vector3(0, -1, 0)],
        [point(o.offset + o.width * .413, o.sill + o.height), new Vector3(0, 1, 0)],
      ];
      if (o.sectionSpan === undefined || o.sectionSpan === 0)
        probes.push([point(o.offset, o.sill + o.height * .413), along.clone().negate()]);
      // Curved glass fields span three segments; internal segment joins have no jamb.
      const section = blueprint.assembly!.floors.find(f => f.floor === floor.index)!.sections.find(s => s.id === o.sectionId)!;
      if (!section.spans || o.sectionSpan === section.spans.length - 1)
        probes.push([point(o.offset + o.width, o.sill + o.height * .413), along.clone()]);
      for (const [target, direction] of probes) {
        const ray = new Raycaster(target.clone().addScaledVector(direction, -.004), direction, 0, .008);
        expect(ray.intersectObjects(permanent, false), `${o.id}: permanent reveal`).toHaveLength(1);
        expect(ray.intersectObjects(all, false), `${o.id}: no overlapping scenery`).toHaveLength(1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
    dispose(all);
  }
});

it('keeps permanent finished returns on every reviewed straight family when scenery is removed', async () => {
  const variants: Record<string, [number, number, number]> = {
    'balcony-grid': [20.5, 37.5, 3], 'corporate-sectors': [51, 51, 16],
    'faceted-bays': [40.5, 28.5, 7], 'mirror-frame': [28, 44, 7],
    'mirror-shutters': [49, 34, 7], 'white-grid': [32.5, 47.5, 4],
  };
  const requests = familyFixtures().filter(request => request.options!.architecture !== 'garden-taper').flatMap(input => {
    const [width, depth, floors] = variants[input.buildingId]!;
    return [input, { ...input, buildingId: `${input.buildingId}-variant`,
      parcel: { footprint: [[0, 0], [width, 0], [width, depth], [0, depth]] as [number, number][],
        accessPoint: [width / 2, 0] as [number, number], maxHeight: floors * 4.5 + 3 },
      building: { ...input.building, floors } }];
  });
  for (const input of requests) {
    const { blueprint, glb } = await generate(input, keys);
    const all = surfaces(await glbIO().readBinary(glb));
    const permanent = all.filter(mesh => !mesh.name.startsWith('scenery:'));
    let checked = 0;
    for (const floor of [blueprint.floors[1]!, blueprint.floors.at(-1)!]) for (const o of floor.openings) {
      if (!o.scenery || !o.glazing) continue;
      const section = blueprint.assembly!.floors.find(f => f.floor === floor.index)!.sections.find(s => s.id === o.sectionId)!;
      if (section.spans) continue;
      const a = floor.outline[o.edge]!, b = floor.outline[(o.edge + 1) % floor.outline.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const along = new Vector3((b[0] - a[0]) / len, 0, (b[1] - a[1]) / len);
      const inset = o.glazing.glassDepth + (blueprint.facade.wallDepth - o.glazing.glassDepth) * .61;
      const point = (u: number, y: number) => new Vector3(a[0] + along.x * u - along.z * inset,
        floor.elevation + y, a[1] + along.z * u + along.x * inset);
      const field = new FacadeField(floor.outline, o.edge);
      const bound = (u: number) => {
        const p = field.point(u, 0, -inset);
        return (p[0] - a[0]) * along.x + (p[2] - a[1]) * along.z;
      };
      const start = bound(0), end = bound(len);
      const walls = permanent.filter(mesh => mesh.name === `wall:${floor.index}/${o.edge}`);
      const scenery = all.filter(mesh => mesh.name === o.scenery!.nodeId);
      const probes: [Vector3, Vector3][] = [
        [point(o.offset + o.width * .413, o.sill), new Vector3(0, -1, 0)],
        [point(o.offset + o.width * .413, o.sill + o.height), new Vector3(0, 1, 0)],
        [point(o.offset, o.sill + o.height * .413), along.clone().negate()],
        [point(o.offset + o.width, o.sill + o.height * .413), along.clone()],
      ];
      for (const [target, direction] of probes) {
        const ray = new Raycaster(target.clone().addScaledVector(direction, -.004), direction, 0, .008);
        const u = (target.x - a[0]) * along.x + (target.z - a[1]) * along.z;
        // Adjacent faces meet on their mitre; there is no duplicate return past it.
        if (u <= start + .005 || u >= end - .005) continue;
        expect(ray.intersectObjects(walls, false), `${input.buildingId}/${o.id}: permanent reveal ${direction.toArray()}`).toHaveLength(1);
        expect(ray.intersectObjects(scenery, false), `${input.buildingId}/${o.id}: scenery behind permanent reveal`).toHaveLength(0);
        checked++;
      }
    }
    expect(checked, input.buildingId).toBeGreaterThan(30);
    dispose(all);
  }
}, 30_000);

it('keeps tapered window returns permanent without overlapping its one-metre scenery', async () => {
  const { blueprint, glb } = await generate(request('garden-taper'), keys);
  expect(blueprint.floors.flatMap(f => f.openings).some(o => (o.glazing?.glassDepth ?? 0) > 1)).toBe(true);
  expect(blueprint.facade.wallDepth).toBeGreaterThan(1);
  const deepestGlass = Math.max(...blueprint.floors.flatMap(f => f.openings.map(o => o.glazing?.glassDepth ?? 0)));
  expect(blueprint.facade.wallDepth).toBeLessThanOrEqual(deepestGlass + 0.03);
  const floor = blueprint.floors.find(f => f.index > 0 && f.openings.some(o => o.edge === 1 && o.offset > 5 && o.scenery && o.glazing!.glassDepth < 0.3))!;
  const opening = floor.openings.find(o => o.edge === 1 && o.offset > 5 && o.scenery && o.glazing!.glassDepth < 0.3)!;
  const meshes = surfaces(await glbIO().readBinary(glb));
  const candidates = meshes.filter(mesh => mesh.name === `wall:${floor.index}/1` || mesh.name === `window:${opening.id}` || mesh.name === `scenery:${floor.index}`);
  const glass = opening.glazing!.glassDepth;
  expect(opening.scenery!.depth).toBe(1);
  const ceiling = floor.elevation + opening.sill + opening.height;
  // The ceiling-mounted blind rail reaches 0.22 m behind the glass.
  const depths = [glass * 0.47, glass + 0.25, glass + 0.55, glass + 0.95];
  for (const depth of depths) {
    const target = eastPoint(floor, opening.offset + opening.width * 0.413, ceiling, depth);
    const hits = new Raycaster(target.clone().add(new Vector3(0, -0.004, 0)), new Vector3(0, 1, 0), 0, 0.008).intersectObjects(candidates, false);
    expect(hits, `ceiling at depth ${depth}`).toHaveLength(1);
    expect(hits[0]!.object.name).toBe(`wall:${floor.index}/1`);
  }
  const middle = floor.elevation + opening.sill + opening.height * 0.41;
  for (const depth of [glass + 0.15, glass + 0.55, glass + 0.95]) {
    const target = eastPoint(floor, opening.offset, middle, depth);
    const hits = new Raycaster(target.clone().add(new Vector3(0, 0, 0.004)), new Vector3(0, 0, -1), 0, 0.008).intersectObjects(candidates, false);
    expect(hits, `side wall at depth ${depth}`).toHaveLength(1);
    expect(hits[0]!.object.name).toBe(`wall:${floor.index}/1`);
  }
  const rear = eastPoint(floor, opening.offset + opening.width * 0.413, middle, glass + 0.9);
  const rearHits = new Raycaster(rear, new Vector3(-1, 0, 0), 0, 0.2).intersectObjects(candidates, false);
  expect(rearHits).toHaveLength(1);
  expect(rearHits[0]!.object.userData.material).toBe(`cyberpunk/paired-room-${opening.scenery!.state}/mid`);
  expect(rearHits[0]!.distance).toBeCloseTo(0.1, 5);
  const beyond = eastPoint(floor, opening.offset + opening.width * 0.413, ceiling, blueprint.facade.wallDepth + 0.15);
  expect(new Raycaster(beyond.clone().add(new Vector3(0, -0.004, 0)), new Vector3(0, 1, 0), 0, 0.008).intersectObjects(candidates, false)).toHaveLength(0);
  const ground = blueprint.floors.find(f => f.index === 0)!;
  expect(ground.height).toBe(4.5);
  for (const y of [0.3, ground.height - 0.3]) {
    const target = eastPoint(ground, 16.37, y, -0.5);
    const hits = new Raycaster(target, new Vector3(-1, 0, 0), 0, 1).intersectObjects(meshes, false);
    expect(hits[0]!.object.userData.material).toBe('cyberpunk/garden-concrete/mid');
  }
  dispose(meshes);
});

it('cuts both corporate window rows through the full wall body', async () => {
  const { blueprint, glb } = await generate(request('corporate-sectors'), keys);
  const floor = blueprint.floors.find(f => f.index > 0 && f.openings.some(o => o.edge === 1 && f.openings.some(other =>
    other.id !== o.id && other.edge === 1 && Math.abs(other.offset - o.offset) < 1e-7 && other.sill !== o.sill)))!;
  const lower = floor.openings.find(o => o.edge === 1 && floor.openings.some(other => other.id !== o.id && other.edge === 1
    && Math.abs(other.offset - o.offset) < 1e-7 && other.sill > o.sill))!;
  const upper = floor.openings.find(o => o.id !== lower.id && o.edge === 1 && Math.abs(o.offset - lower.offset) < 1e-7)!;
  const meshes = surfaces(await glbIO().readBinary(glb));
  const walls = meshes.filter(mesh => mesh.name === `wall:${floor.index}/1`);
  for (const window of [lower, upper]) {
    const origin = eastPoint(floor, window.offset + window.width * 0.41, floor.elevation + window.sill + window.height * 0.43, -0.4);
    expect(new Raycaster(origin, new Vector3(-1, 0, 0), 0, blueprint.facade.wallDepth + 0.8).intersectObjects(walls, false)).toHaveLength(0);
  }
  dispose(meshes);
});
