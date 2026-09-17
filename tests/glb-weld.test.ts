import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import { fixture, glbIO, keys } from './support.ts';

it.each(['named', 'merged'] as const)('welds and indexes every %s primitive', async glb => {
  const request = fixture('corpo-tower');
  request.building.floors = 6;
  request.options = { ...request.options, glb };
  const doc = await glbIO().readBinary((await generate(request, keys)).glb);

  let checked = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const positions = prim.getAttribute('POSITION')!, normals = prim.getAttribute('NORMAL')!;
      const uvs = prim.getAttribute('TEXCOORD_0')!;
      const count = positions.getCount();
      const indices = prim.getIndices()!;
      expect(indices.getArray()!.constructor.name)
        .toBe(count < 65536 ? 'Uint16Array' : 'Uint32Array');

      const unique = new Set<string>();
      for (let i = 0; i < count; i++) {
        unique.add([...positions.getElement(i, []), ...normals.getElement(i, []), ...uvs.getElement(i, [])].join(','));
      }
      expect(unique.size).toBe(count);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
});
