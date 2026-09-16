import { expect, it } from 'vitest';
import { NodeIO, type Document } from '@gltf-transform/core';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest, type Blueprint } from '../src/index.ts';
import { keys } from './support.ts';

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

it('joins window returns to one rectangular room surface ending one metre behind the glass', async () => {
  const { blueprint, glb } = await generate(request('garden-taper'), keys);
  expect(blueprint.floors.flatMap(f => f.openings).some(o => (o.glazing?.glassDepth ?? 0) > 1)).toBe(true);
  expect(blueprint.facade.wallDepth).toBeGreaterThan(1);
  const deepestGlass = Math.max(...blueprint.floors.flatMap(f => f.openings.map(o => o.glazing?.glassDepth ?? 0)));
  expect(blueprint.facade.wallDepth).toBeLessThanOrEqual(deepestGlass + 0.03);
  const floor = blueprint.floors.find(f => f.index > 0 && f.openings.some(o => o.edge === 1 && o.offset > 5 && o.scenery && o.glazing!.glassDepth < 0.3))!;
  const opening = floor.openings.find(o => o.edge === 1 && o.offset > 5 && o.scenery && o.glazing!.glassDepth < 0.3)!;
  const meshes = surfaces(await new NodeIO().readBinary(glb));
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
    if (depth > glass) {
      expect(hits[0]!.object.name).toBe(`scenery:${floor.index}`);
      expect(hits[0]!.object.userData.material).toContain('paired-room-ceiling');
    }
  }
  const middle = floor.elevation + opening.sill + opening.height * 0.41;
  for (const depth of [glass + 0.15, glass + 0.55, glass + 0.95]) {
    const target = eastPoint(floor, opening.offset, middle, depth);
    const hits = new Raycaster(target.clone().add(new Vector3(0, 0, 0.004)), new Vector3(0, 0, -1), 0, 0.008).intersectObjects(candidates, false);
    expect(hits, `side wall at depth ${depth}`).toHaveLength(1);
    expect(hits[0]!.object.name).toBe(`scenery:${floor.index}`);
    expect(hits[0]!.object.userData.material).toContain('paired-room-wall');
  }
  const rear = eastPoint(floor, opening.offset + opening.width * 0.413, middle, glass + 0.9);
  const rearHits = new Raycaster(rear, new Vector3(-1, 0, 0), 0, 0.2).intersectObjects(candidates, false);
  expect(rearHits).toHaveLength(1);
  expect(rearHits[0]!.object.userData.material).toBe(`cyberpunk/paired-room-${opening.scenery!.state}/mid`);
  expect(rearHits[0]!.distance).toBeCloseTo(0.1, 5);
  const beyond = eastPoint(floor, opening.offset + opening.width * 0.413, ceiling, glass + 1.15);
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
  const meshes = surfaces(await new NodeIO().readBinary(glb));
  const walls = meshes.filter(mesh => mesh.name === `wall:${floor.index}/1`);
  for (const window of [lower, upper]) {
    const origin = eastPoint(floor, window.offset + window.width * 0.41, floor.elevation + window.sill + window.height * 0.43, -0.4);
    expect(new Raycaster(origin, new Vector3(-1, 0, 0), 0, blueprint.facade.wallDepth + 0.8).intersectObjects(walls, false)).toHaveLength(0);
  }
  dispose(meshes);
});

it('reserves housing depth without counting the taper of a broad, short tower', async () => {
  const input = request('garden-taper');
  input.parcel = { ...input.parcel, footprint: [[0, 0], [182, 0], [182, 42], [0, 42]], accessPoint: [91, 0] };
  const { blueprint } = await generate(input, keys);
  const glass = blueprint.floors.flatMap(f => f.openings.flatMap(o => o.glazing ? [o.glazing.glassDepth] : []));
  const deepest = Math.max(...glass);
  expect(blueprint.floors.filter(f => f.index >= 0)).toHaveLength(4);
  expect(blueprint.facade.wallDepth).toBeGreaterThanOrEqual(deepest);
  expect(blueprint.facade.wallDepth).toBeLessThanOrEqual(deepest + 0.03);
  expect(blueprint.floors.every(f => f.roomEnvelope!.width > 0 && f.roomEnvelope!.depth > 0)).toBe(true);
});
