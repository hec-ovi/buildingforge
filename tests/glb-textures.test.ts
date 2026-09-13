import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import catalog from '../public/native-materials/themes/cyberpunk/theme.json' with { type: 'json' };

it('packs original native image bytes beside external maps in one GLB', async () => {
  const request = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
  const { glb, textures } = await generate(request, { textures: { baseUrl: '/shared/' } });
  expect(textures.mode).toBe('external');

  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
  const bin = glb.subarray(28 + jsonLength);
  expect(json.buffers).toHaveLength(1);
  expect(json.buffers[0].uri).toBeUndefined();
  expect(json.buffers[0].byteLength).toBe(bin.byteLength);

  const external = json.images.filter((image: any) => image.uri);
  expect(external.length).toBeGreaterThan(0);
  for (const image of external) {
    expect(image.uri).toMatch(/^\/shared\/themes\/cyberpunk\/assets\//);
    expect(image.bufferView).toBeUndefined();
  }

  const embedded = new Set<number>();
  for (const material of json.materials) {
    const native = material.extras?.nativeMaterial;
    if (!native) continue;
    const maps = catalog.entries[native.key as keyof typeof catalog.entries].variants[0]!.maps;
    const infos = [
      [maps.basecolor, material.pbrMetallicRoughness.baseColorTexture],
      [maps.metallicRoughness, material.pbrMetallicRoughness.metallicRoughnessTexture],
      [maps.normal, material.normalTexture],
      [maps.ao, material.occlusionTexture],
    ] as const;
    for (const [path, info] of infos) {
      const index = json.textures[info.index].source;
      const image = json.images[index];
      expect(image.uri).toBeUndefined();
      expect(image.mimeType).toBe('image/png');
      const bufferView = json.bufferViews[image.bufferView];
      expect(bufferView.buffer).toBe(0);
      expect(bufferView.byteOffset % 4).toBe(0);
      const bytes = bin.subarray(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);
      const original = readFileSync(new URL(`../public/native-materials/themes/cyberpunk/${path}`, import.meta.url));
      expect(original.equals(bytes), path).toBe(true);
      embedded.add(index);
    }
  }
  expect(embedded.size).toBeGreaterThan(0);
  expect(embedded.size + external.length).toBe(json.images.length);
});

it('embeds catalog maps or explicitly reports the keys fallback', async () => {
  const request = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
  const embedded = await generate(request, { textures: { mode: 'embed', nativeFinishes: false } });
  const view = new DataView(embedded.glb.buffer, embedded.glb.byteOffset, embedded.glb.byteLength);
  const json = JSON.parse(new TextDecoder().decode(embedded.glb.subarray(20, 20 + view.getUint32(12, true))));
  expect(embedded.textures.mode).toBe('embed');
  expect(json.images.every((image: any) => image.uri === undefined && image.bufferView >= 0)).toBe(true);
  const fallback = await generate(request, { textures: { source: null } });
  expect(fallback.textures).toMatchObject({ mode: 'keys', reason: expect.stringContaining(request.theme) });
});
