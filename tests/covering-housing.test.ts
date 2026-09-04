import { readFileSync } from 'node:fs';
import { NodeIO, type Primitive } from '@gltf-transform/core';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));

it('encloses upper covering edges and removable ground backing at oblique viewing angles', async () => {
  for (const exteriorStyle of ['residential-weathered', 'residential-modest']) {
    const request = { ...fixture, options: { exteriorStyle, shape: 'box' } };
    const options = { textures: { mode: 'keys' as const } };
    const initial = await generate(request, options);
    const overrides = initial.blueprint.floors.filter((floor) => floor.index === 0 || floor.index === 1)
      .map((floor) => ({ openingId: floor.openings.find((opening) => opening.kind === 'window')!.id, openPercent: 100 }));
    const { glb, blueprint } = await generate({ ...request, options: { ...request.options, curtains: { overrides } } }, options);
    const doc = await new NodeIO().readBinary(glb);
    for (const floor of blueprint.floors.filter((floor) => floor.index === 0 || floor.index === 1)) {
      const opening = floor.openings.find((opening) => opening.kind === 'window')!;
      expect(opening.curtain?.closurePercent).toBe(0);
      const node = doc.getRoot().listNodes().find((node) => node.getName() === `window:${opening.id}`)!;
      const primitives = node.getMesh()!.listPrimitives();
      const a = floor.outline[opening.edge]!, b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      const local = (point: number[]) => new Vector3(
        (point[0]! - a[0]) * dx + (point[2]! - a[1]) * dz, point[1],
        (point[0]! - a[0]) * dz - (point[2]! - a[1]) * dx,
      );
      const glass = primitives.find((primitive) => primitive.getMaterial()!.getName().includes('/window-glass/'))!;
      const positions = glass.getAttribute('POSITION')!;
      const points = Array.from({ length: positions.getCount() }, (_, index) => local(positions.getElement(index, [0, 0, 0])));
      const x0 = Math.min(...points.map((point) => point.x)), x1 = Math.max(...points.map((point) => point.x));
      const y0 = Math.min(...points.map((point) => point.y)), y1 = Math.max(...points.map((point) => point.y));
      const z = points[0]!.z;
      const privacy = doc.getRoot().listNodes().find((node) => node.getName() === opening.windowTreatment?.nodeId)?.getMesh();
      if (privacy) {
        // One closed sheet behind the authored blind, with no duplicate slat bank.
        const backing = privacy.listPrimitives().find((primitive) => primitive.getMaterial()!.getName().includes('/curtain/'))!;
        expect(backing.getAttribute('POSITION')!.getCount()).toBe(4);
      }
      const housing = [...primitives, ...(privacy?.listPrimitives() ?? [])].filter((primitive) => primitive.getMaterial()!.getName().includes('/window-frame/'));
      for (const behind of privacy ? [0.002, 0.06, 0.12] : [0.002, 0.06]) {
        const rays = [
          new Ray(new Vector3(x0 + 0.01, (y0 + y1) / 2, z - behind), new Vector3(-1, 0, -1).normalize()),
          new Ray(new Vector3(x1 - 0.01, (y0 + y1) / 2, z - behind), new Vector3(1, 0, -1).normalize()),
          new Ray(new Vector3((x0 + x1) / 2, y0 + 0.01, z - behind), new Vector3(0, -1, -1).normalize()),
          new Ray(new Vector3((x0 + x1) / 2, y1 - 0.01, z - behind), new Vector3(0, 1, -1).normalize()),
        ];
        for (const ray of rays) expect(firstHit(ray, housing, local)).toBeLessThan(0.025);
      }
    }
  }
});

function firstHit(ray: Ray, primitives: Primitive[], local: (point: number[]) => Vector3): number {
  let distance = Infinity;
  for (const primitive of primitives) {
    const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!.getArray()!;
    for (let index = 0; index < indices.length; index += 3) {
      const vertices = [0, 1, 2].map((offset) => local(positions.getElement(indices[index + offset]!, [0, 0, 0])));
      // Tangent/up/outward is left-handed, so projection reverses triangle winding.
      const hit = ray.intersectTriangle(vertices[0]!, vertices[2]!, vertices[1]!, true, new Vector3());
      if (hit) distance = Math.min(distance, hit.distanceTo(ray.origin));
    }
  }
  return distance;
}
