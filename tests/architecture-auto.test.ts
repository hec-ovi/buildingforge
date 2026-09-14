import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { generate } from '../src/index.ts';
import { fixture, keys, glbJson } from './support.ts';

const request = () => {
  const r = fixture('architecture-01-rounded-corner');
  r.seed = 'auto-7'; r.building.floors = 5; r.options!.architecture = 'auto';
  return r;
};
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

it('selects the reviewed rounded shell with identical inward/outward geometry and portable finish bytes', async () => {
  const r = request();
  const automatic = await generate(r, { textures: { mode: 'embed' } });
  const explicit = await generate({ ...r, options: { ...r.options, architecture: 'rounded-corner' } }, { textures: { mode: 'embed' } });
  const portable = await generate(r, keys);
  expect(automatic.blueprint.architectureSelection).toEqual({ requested: 'auto', selected: 'rounded-corner', reason: 'accepted-reference' });
  expect(portable.blueprint).toEqual(automatic.blueprint);
  const geometricFloors = (floors: unknown) => JSON.parse(JSON.stringify(floors, (key, value) => key === 'material' ? undefined : value));
  expect(geometricFloors(automatic.blueprint.floors)).toEqual(geometricFloors(explicit.blueprint.floors));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const [a, e] = await Promise.all([io.readBinary(automatic.glb), io.readBinary(explicit.glb)]);
  const geometry = (doc: typeof a) => doc.getRoot().listNodes().map(n => ({ name: n.getName(), triangles: n.getMesh()?.listPrimitives().flatMap(p => {
    const indices = p.getIndices()!.getArray()!, triangles: string[] = [];
    for (let i = 0; i < indices.length; i += 3) triangles.push(JSON.stringify(Array.from(indices.slice(i, i + 3)).map(index =>
      ['POSITION', 'NORMAL', 'TEXCOORD_0'].map(semantic => p.getAttribute(semantic)!.getElement(index, [])))));
    return triangles;
  }).sort() }));
  expect(geometry(a)).toEqual(geometry(e));
  const aj = glbJson(automatic.glb), ej = glbJson(explicit.glb), kj = glbJson(portable.glb);
  expect(kj.materials.map((m: any) => [m.name, m.extras.materialVariant])).toEqual(aj.materials.map((m: any) => [m.name, m.extras.materialVariant]));
  let nativeCount = 0, exactCount = 0;
  for (let i = 0; i < ej.materials.length; i++) {
    const old = ej.materials[i];
    const native = old.extras?.nativeMaterial;
    if (!native) { expect(aj.materials.some((m: any) => m.name === old.name)).toBe(true); continue; }
    nativeCount++;
    const exact = old.extras.textureMapping === 'exact';
    if (exact) exactCount++;
    const name = exact ? native.key.replace('/mid', '-exact/mid') : native.key;
    const next = aj.materials.find((m: any) => m.name === name);
    expect(next).toBeDefined();
    expect(next.extras.materialVariant).toBe('native');
    const oldMat = e.getRoot().listMaterials()[i]!, newMat = a.getRoot().listMaterials().find(m => m.getName() === name)!;
    expect(newMat.getBaseColorFactor()).toEqual(oldMat.getBaseColorFactor());
    expect(newMat.getRoughnessFactor()).toBe(oldMat.getRoughnessFactor());
    expect(newMat.getMetallicFactor()).toBe(oldMat.getMetallicFactor());
    for (const slot of ['BaseColor', 'Normal', 'MetallicRoughness', 'Occlusion'] as const) {
      const oldTexture = oldMat[`get${slot}Texture`](), newTexture = newMat[`get${slot}Texture`]();
      expect(hash(newTexture!.getImage()!)).toBe(hash(oldTexture!.getImage()!));
      const oldInfo = oldMat[`get${slot}TextureInfo`]()!, newInfo = newMat[`get${slot}TextureInfo`]()!;
      expect(newInfo.getWrapS()).toBe(oldInfo.getWrapS()); expect(newInfo.getWrapT()).toBe(oldInfo.getWrapT());
      expect(newInfo.getExtension<any>('KHR_texture_transform')?.getScale()).toEqual(oldInfo.getExtension<any>('KHR_texture_transform')?.getScale());
    }
  }
  expect(nativeCount).toBeGreaterThan(0); expect(exactCount).toBeGreaterThan(0);
}, 60000);

it('records ordinary selection and preserves fixed connection faces', async () => {
  const r = fixture('bridged-tower'); r.options!.architecture = 'auto';
  const result = await generate(r, keys);
  const original = await generate({ ...r, options: { ...r.options, architecture: undefined } }, keys);
  expect(result.blueprint.architectureSelection).toMatchObject({ selected: 'ordinary', reason: 'fixed-faces' });
  delete result.blueprint.architectureSelection;
  expect(result.blueprint).toEqual(original.blueprint);
});
