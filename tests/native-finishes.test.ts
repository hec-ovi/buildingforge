import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import bindings from '../../materials/bindings/exterior-styles.json' with { type: 'json' };
import catalog from '../public/native-materials/themes/cyberpunk/theme.json' with { type: 'json' };
import finishes from '../assets/native/bindings.json' with { type: 'json' };

const request = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
const jsonOf = (glb: Uint8Array) => JSON.parse(new TextDecoder().decode(glb.subarray(20,
  20 + new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(12, true))));

it('ships seeded image palettes in all nine styles with packed PBR maps and canonical keys', async () => {
  const used = new Set<string>();
  const palettes = new Set<string>();
  for (const seed of [request.seed, 'native-variety-001']) for (const style of bindings.styles) {
    const { glb, blueprint } = await generate({ ...request, seed, options: { ...request.options, exteriorStyle: style.id } });
    const json = jsonOf(glb);
    const buildingPalettes = new Set<string>();
    for (const material of json.materials) {
      expect(blueprint.materials).toContain(material.name);
      const native = material.extras?.nativeMaterial;
      if (!native) continue;
      used.add(native.key);
      palettes.add(native.paletteId);
      buildingPalettes.add(native.paletteId);
      expect(finishes.styles[style.id as keyof typeof finishes.styles]).toContain(native.paletteId);
      const entry = catalog.entries[native.key as keyof typeof catalog.entries];
      expect(entry.variants[0]!.class).toBe('image');
      expect(native.variantId).toBe('native');
      const pbr = material.pbrMetallicRoughness;
      expect(pbr.metallicFactor ?? 1).toBe(1);
      expect(pbr.roughnessFactor ?? 1).toBe(1);
      const infos = [pbr.baseColorTexture, pbr.metallicRoughnessTexture, material.normalTexture, material.occlusionTexture];
      for (const info of infos) {
        expect(info).toBeDefined();
        const texture = json.textures[info.index];
        const image = json.images[texture.source];
        expect(image.uri).toBeUndefined();
        expect(image.bufferView).toBeGreaterThanOrEqual(0);
        if ('tiling' in entry) {
          expect((info.extensions?.KHR_texture_transform?.scale ?? [1, 1])).toEqual(entry.tiling.worldSize.map((n) => 1 / n));
        } else {
          expect(info.extensions?.KHR_texture_transform).toBeUndefined();
          expect(json.samplers[texture.sampler]).toMatchObject({ wrapS: 33071, wrapT: 33071 });
        }
      }
    }
    expect(buildingPalettes.size).toBe(1);
    const ac = json.nodes.find((node: any) => node.name === 'facade-ac');
    if (ac?.mesh !== undefined) {
      const finishes = json.meshes[ac.mesh].primitives.map((p: any) => json.materials[p.material].extras?.nativeMaterial?.key);
      expect(finishes).toContain('cyberpunk/exterior-ac-coil/mid');
      expect(finishes).toContain('cyberpunk/exterior-ac-enamel/mid');
    }
  }
  expect([...used].sort()).toEqual(Object.keys(catalog.entries).sort());
  expect([...palettes].sort()).toEqual(Object.keys(finishes.palettes).sort());
}, 60000);

it('allows callers to resolve shared catalog finishes with nativeFinishes disabled', async () => {
  const { glb } = await generate(request, { textures: { nativeFinishes: false, baseUrl: '/shared/' } });
  const json = jsonOf(glb);
  expect(json.materials.every((material: any) => !material.extras?.nativeMaterial)).toBe(true);
  expect(json.images.every((image: any) => image.uri.startsWith('/shared/themes/') && image.bufferView === undefined)).toBe(true);
  const metal = json.materials.find((material: any) => material.name.includes('/metal/'));
  expect(metal.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
  expect(metal.pbrMetallicRoughness.roughnessFactor ?? 1).toBe(1);
});
