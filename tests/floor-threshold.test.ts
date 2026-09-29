import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest } from '../src/index.ts';
import { edgeDir, edgeNormal, type P2 } from '../src/core/polygon.ts';
import { glbIO, keys } from './support.ts';

function request(angle: number): BuildingRequest {
  const turn = ([x, z]: P2): P2 => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
  return { seed: 'threshold-recess', buildingId: 'threshold', theme: 'cyberpunk',
    parcel: { footprint: ([[0, 0], [40, 0], [40, 40], [0, 40]] as P2[]).map(turn), accessPoint: turn([20, 0]), maxHeight: 31.5,
      buildingGrid: { origin: [0, 0], angle: angle * 180 / Math.PI, spacing: .5 } },
    building: { type: 'residential', tier: 'high_rich', floors: 6 },
    options: { architecture: 'mirror-frame', glb: 'named' } };
}

it.each([0, 37])('recesses the slab backing 20 mm under a floor-level entrance at %s degrees, and only there', async degrees => {
  const { blueprint, glb } = await generate(request(degrees * Math.PI / 180), keys);
  const floor = blueprint.floors.find(f => f.index === 0)!, door = floor.openings.find(o => o.doorRole === 'main')!;
  expect(door.sill).toBe(0);
  const document = await glbIO().readBinary(glb), material = new MeshBasicMaterial(), slabs: Mesh[] = [];
  for (const node of document.getRoot().listNodes().filter(node => node.getName() === 'floor:0/slab')) {
    for (const primitive of node.getMesh()!.listPrimitives()) {
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!), 3));
      geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
      geometry.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      slabs.push(new Mesh(geometry, material));
    }
  }
  expect(slabs.length).toBeGreaterThan(0);
  const origin = floor.outline[door.edge]!, [ux, uz] = edgeDir(floor.outline, door.edge), [nx, nz] = edgeNormal(floor.outline, door.edge);
  const depthOf = ([x, z]: P2) => -(x - origin[0]) * nx - (z - origin[1]) * nz;
  const envelope = Math.min(...floor.roomEnvelope!.corners.map(depthOf));
  const field = door.door!.clearance!, start = Math.max(field.backDepth, door.door!.recessDepth);
  expect(envelope).toBeGreaterThan(start + .1);
  // One upward receiving surface under each probe: the recess, or the unchanged walking plane beyond it.
  const top = (u: number, depth: number) => {
    const point = new Vector3(origin[0] + ux * u - nx * depth, floor.elevation + .05, origin[1] + uz * u - nz * depth);
    const hits = new Raycaster(point, new Vector3(0, -1, 0), 0, .1).intersectObjects(slabs, false);
    expect(hits, `u ${u} depth ${depth}`).toHaveLength(1);
    return hits[0]!.point.y - floor.elevation;
  };
  try {
    for (const across of [.1, .5, .9]) {
      const u = field.offset + field.width * across;
      for (const t of [.1, .5, .9]) expect(top(u, start + (envelope - start) * t)).toBeCloseTo(-.02, 5);
      expect(top(u, envelope + .5)).toBeCloseTo(0, 5);
    }
    expect(top(field.offset - 1.5, (start + envelope) / 2)).toBeCloseTo(0, 5);
  } finally { for (const mesh of slabs) mesh.geometry.dispose(); material.dispose(); }
}, 60_000);
