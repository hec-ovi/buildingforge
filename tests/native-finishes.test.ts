import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import bindings from '../../materials/bindings/exterior-styles.json' with { type: 'json' };
import catalog from '../public/native-materials/themes/cyberpunk/theme.json' with { type: 'json' };
import finishes from '../assets/native/bindings.json' with { type: 'json' };

const request = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
// One roomy specimen accommodates every style's openings and shared core clearance.
const specimen = { ...request, parcel: { ...request.parcel,
  footprint: [[0, 0], [36, 0], [36, 30], [0, 30]], accessPoint: [18, -1] } };
const alternateSeeds: Record<string, string> = {
  'premium-office': 'native-variety-002', 'civic-industrial': 'native-variety-002',
  'civic-institutional': 'native-civic-slate',
};
const jsonOf = (glb: Uint8Array) => JSON.parse(new TextDecoder().decode(glb.subarray(20,
  20 + new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(12, true))));
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

it('ships seeded image palettes in all nine styles with packed PBR maps and canonical keys', async () => {
  const used = new Set<string>();
  const palettes = new Set<string>();
  const combinations = new Set<string>();
  const sourceDigests = new Map<string, string>();
  for (const style of bindings.styles) for (const seed of [request.seed, alternateSeeds[style.id] ?? 'native-variety-001']) {
    const { glb, blueprint } = await generate({ ...specimen, seed, options: { ...specimen.options, exteriorStyle: style.id } });
    expect(blueprint.facade.exteriorStyle).toBe(style.id);
    const json = jsonOf(glb);
    const binaryStart = 28 + new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(12, true);
    const imageDigests = new Map<number, string>();
    const buildingPalettes = new Set<string>();
    for (const material of json.materials) {
      expect(blueprint.materials).toContain(material.name);
      const native = material.extras?.nativeMaterial;
      if (!native) continue;
      used.add(native.key);
      palettes.add(native.paletteId);
      combinations.add(`${style.id}:${native.paletteId}`);
      buildingPalettes.add(native.paletteId);
      expect(finishes.styles[style.id as keyof typeof finishes.styles]).toContain(native.paletteId);
      const entry = catalog.entries[native.key as keyof typeof catalog.entries];
      expect(entry.variants[0]!.class).toBe('image');
      expect(native.variantId).toBe('native');
      const pbr = material.pbrMetallicRoughness;
      expect(pbr.metallicFactor ?? 1).toBe(1);
      expect(pbr.roughnessFactor ?? 1).toBe(1);
      const infos = [['basecolor', pbr.baseColorTexture], ['metallicRoughness', pbr.metallicRoughnessTexture],
        ['normal', material.normalTexture], ['ao', material.occlusionTexture]] as const;
      for (const [slot, info] of infos) {
        expect(info).toBeDefined();
        const texture = json.textures[info.index];
        const image = json.images[texture.source];
        expect(image.uri).toBeUndefined();
        expect(image.bufferView).toBeGreaterThanOrEqual(0);
        expect(image.mimeType).toBe('image/png');
        const view = json.bufferViews[image.bufferView];
        expect(view.byteLength).toBeGreaterThan(0);
        const start = binaryStart + (view.byteOffset ?? 0);
        expect(start + view.byteLength).toBeLessThanOrEqual(glb.byteLength);
        if (!imageDigests.has(texture.source)) imageDigests.set(texture.source, digest(glb.subarray(start, start + view.byteLength)));
        const path = entry.variants[0]!.maps[slot];
        if (!sourceDigests.has(path)) sourceDigests.set(path, digest(readFileSync(
          new URL(`../public/native-materials/themes/cyberpunk/${path}`, import.meta.url))));
        expect(imageDigests.get(texture.source), `${native.key} ${slot}`).toBe(sourceDigests.get(path));
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
  expect([...combinations].sort()).toEqual(Object.entries(finishes.styles)
    .flatMap(([style, choices]) => choices.map((palette) => `${style}:${palette}`)).sort());
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
