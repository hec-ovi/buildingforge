import { expect, it } from 'vitest';
import { NodeIO, type Node } from '@gltf-transform/core';
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { generate, type BuildingRequest } from '../src/index.ts';
import { keys } from './support.ts';

function surfaces(node: Node): Mesh[] {
  return node.getMesh()!.listPrimitives().map(primitive => {
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION')!.getArray()!), 3));
    geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!));
    return new Mesh(geometry, new MeshBasicMaterial());
  });
}

it('miters deep fixed-face wall surfaces while retaining exact connection cuts and floor approaches', async () => {
  const input: BuildingRequest = {
    seed: 'fixed-face-shell', buildingId: 'fixed-face-shell', theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [47, 0], [47, 37.5], [0, 37.5]], accessPoint: [47, 19], maxHeight: 80 },
    building: { type: 'offices', tier: 'rich', floors: 12 },
    options: { architecture: 'corporate-sectors', glb: 'named', facadeServices: 'off', roofArtifacts: 'off', signage: null },
    apertures: [{ id: 'bridge', buildingId: 'fixed-face-shell', kind: 'bridge', face: 1, floor: 4,
      base: 18, u: 18.75, width: 4, height: 3.2, shape: 'rect', linkId: 'bridge-link',
      cut: { polygon: [[47, 18, 16.75], [47, 18, 20.75], [47, 21.2, 20.75], [47, 21.2, 16.75]], axisDir: [1, 0, 0] } }],
  };
  const { blueprint, glb } = await generate(input, keys);
  expect(blueprint.facade.wallDepth).toBeGreaterThan(4);
  const doc = await new NodeIO().readBinary(glb);
  for (const floor of blueprint.floors) {
    expect(floor.outline).toEqual(input.parcel.footprint);
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      const wall = doc.getRoot().listNodes().find(node => node.getName() === `wall:${floor.index}/${edge}`)!;
      for (const primitive of wall.getMesh()!.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!;
        for (let i = 0; i < positions.getCount(); i++) {
          const [x, , z] = positions.getElement(i, [] as number[]);
          const u = (x! - a[0]) * dx + (z! - a[1]) * dz;
          const inward = -(x! - a[0]) * dz + (z! - a[1]) * dx;
          expect(u, `floor ${floor.index}, edge ${edge}, start miter`).toBeGreaterThanOrEqual(inward - 1e-5);
          expect(u, `floor ${floor.index}, edge ${edge}, end miter`).toBeLessThanOrEqual(length - inward + 1e-5);
        }
      }
    }
  }
  const connected = blueprint.floors.find(floor => floor.openings.some(opening => opening.id === 'bridge'))!;
  const opening = connected.openings.find(opening => opening.id === 'bridge')!;
  expect({ edge: opening.edge, offset: opening.offset, width: opening.width, height: opening.height,
    base: connected.elevation + opening.sill }).toEqual({ edge: 1, offset: 16.75, width: 4, height: 3.2, base: 18 });
  const slab = doc.getRoot().listNodes().find(node => node.getName() === `floor:${connected.index}/slab`)!;
  const positions = slab.getMesh()!.listPrimitives()[0]!.getAttribute('POSITION')!;
  const approach = Array.from({ length: positions.getCount() }, (_, i) => positions.getElement(i, [] as number[]))
    .filter(([x, y]) => Math.abs(x! - 47) < 1e-5 && Math.abs(y! - 18) < 1e-5);
  expect(approach.some(([, , z]) => z! < opening.offset)).toBe(true);
  expect(approach.some(([, , z]) => z! > opening.offset + opening.width)).toBe(true);
  const slabMeshes = surfaces(slab);
  for (const inset of [0.1, 1.75, 3.45]) {
    expect(new Raycaster(new Vector3(47 - inset, 18.01, 18.71), new Vector3(0, -1, 0), 0, 0.02)
      .intersectObjects(slabMeshes, false)).toHaveLength(1);
  }
  const wallMeshes = surfaces(doc.getRoot().listNodes().find(node => node.getName() === `wall:${connected.index}/1`)!);
  expect(new Raycaster(new Vector3(47.01, 19.17, 18.71), new Vector3(-1, 0, 0), 0, blueprint.facade.wallDepth + 0.02)
    .intersectObjects(wallMeshes, false)).toHaveLength(0);
  for (const mesh of [...slabMeshes, ...wallMeshes]) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
});
