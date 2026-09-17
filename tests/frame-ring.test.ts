import { expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { generate } from '../src/index.ts';
import { fixture, keys } from './support.ts';

/** One extruded ring: 8 mitred front corners, 8 back, and 16 per return skirt. */
const RING_VERTICES = 48;
/** Head cassette and bottom rail of a covering, one box each. */
const COVERING_RAILS = 48;

it('frames every opening with one welded extruded ring, wound outward', async () => {
  const request = fixture('ordinary-office');
  request.options = { ...request.options, glb: 'named' };
  const { glb, blueprint } = await generate(request, keys);
  const doc = await new NodeIO().readBinary(glb);
  const meshes = new Map(doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => [n.getName(), n.getMesh()!]));

  const windows = blueprint.floors.flatMap(f => f.openings.filter(o => o.kind === 'window' && o.glazing));
  const single = windows.filter(o => o.panes?.cols === 1 && o.panes.rows === 1 && (o.curtain?.closurePercent ?? 0) > 0);
  expect(single.length).toBeGreaterThan(0);

  for (const opening of single) {
    const frame = meshes.get(`window:${opening.id}`)!.listPrimitives()
      .find(p => p.getMaterial()!.getName().includes('window-frame'))!;
    // The opening ring plus the covering housing ring, each one welded profile.
    expect(frame.getAttribute('POSITION')!.getCount()).toBe(RING_VERTICES * 2 + COVERING_RAILS);

    const positions = frame.getAttribute('POSITION')!, normals = frame.getAttribute('NORMAL')!;
    const indices = Array.from(frame.getIndices()!.getArray()!);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
      const p0 = positions.getElement(a, []), p1 = positions.getElement(b, []), p2 = positions.getElement(c, []);
      const e1 = p1.map((v, k) => v - p0[k]!), e2 = p2.map((v, k) => v - p0[k]!);
      const face = [
        e1[1]! * e2[2]! - e1[2]! * e2[1]!,
        e1[2]! * e2[0]! - e1[0]! * e2[2]!,
        e1[0]! * e2[1]! - e1[1]! * e2[0]!,
      ];
      const length = Math.hypot(...face);
      expect(length).toBeGreaterThan(0);
      for (const vertex of [a, b, c]) {
        const n = normals.getElement(vertex, []);
        expect((face[0]! * n[0]! + face[1]! * n[1]! + face[2]! * n[2]!) / length).toBeGreaterThan(0.99);
      }
    }
  }
});
