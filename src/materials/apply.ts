// Turns the canonical material keys the mesh uses into real glTF materials:
// maps from the materials box, physical factors, and the UV transform that makes
// a tiled map cover its declared world size.

import { Document, type Material, type Texture, TextureInfo } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRTextureTransform,
} from '@gltf-transform/extensions';
import { Rng } from '../core/rng.ts';
import { ExteriorError } from '../core/errors.ts';
import { buildResolver, type MaterialEntry, type MaterialSource } from './theme.ts';
import { splitMaterialSlot } from './slot.ts';

export type TextureMode = 'external' | 'embed' | 'keys';

export interface TextureOptions {
  /** external: map URIs against baseUrl. embed: maps packed into the GLB. keys: material names only. */
  mode?: TextureMode;
  /** materials box root; node only, ignored when `source` is given */
  dir?: string;
  /** URI prefix the external mode writes before `themes/<theme>/assets/...` */
  baseUrl?: string;
  /** preloaded source (browser preview, tests); null forces the keys fallback */
  source?: MaterialSource | null;
}

export interface MaterialPlan {
  mode: TextureMode;
  /** why the requested mode was not honoured, when it was not */
  reason?: string;
  bySlot: Map<string, Material>;
  /** external mode: the URI each image keeps instead of embedded bytes */
  imageUris: Map<Texture, string>;
}

const MAP_SLOTS = ['basecolor', 'normal', 'ao', 'emission'] as const;
type MapSlot = typeof MAP_SLOTS[number];

/**
 * Kinds that always take the canonical variant (variant 0), never a seeded one:
 * a frame section has to read as flat painted steel on every building, a deck as
 * a solid surface so a plate that is not a whole number of tiles shows no cut
 * joint, and an exterior lantern as the lamp its housing is shaped for, not a
 * ceiling strip or panel. Everything else varies from building to building.
 */
const NAMED_VARIANTS: Readonly<Record<string, string>> = {
  concrete: 'panel',
  column: 'plain',
  'wall-trim': 'paint',
  'window-frame': 'paint',
  door: 'paint',
  roof: 'plain',
  'floor-slab': 'plain',
  'light-fixture': 'lamp',
};

/** Stable named variant requested by the exterior contract for this key. */
export function preferredVariantForKey(key: string): string | undefined {
  return NAMED_VARIANTS[key.split('/')[1] ?? ''];
}

/** Untextured materials named by the canonical key: what a keys-only consumer resolves itself. */
function keysOnly(doc: Document, slots: string[], reason?: string): MaterialPlan {
  const bySlot = new Map<string, Material>();
  for (const slot of slots) {
    const [key, variant] = splitMaterialSlot(slot);
    const material = doc.createMaterial(key).setDoubleSided(false).setMetallicFactor(0).setRoughnessFactor(1);
    if (variant) material.setExtras({ materialVariant: variant });
    bySlot.set(slot, material);
  }
  return { mode: 'keys', reason, bySlot, imageUris: new Map() };
}

export function createMaterials(
  doc: Document, slots: string[], theme: string, seed: string, opts: TextureOptions, source: MaterialSource | null,
): MaterialPlan {
  const mode = opts.mode ?? 'external';
  if (mode === 'keys') return keysOnly(doc, slots);
  if (!source) {
    if (mode === 'embed') {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED', `embedded textures need the materials database; theme "${theme}" was not found`);
    }
    return keysOnly(doc, slots, `no materials database for theme "${theme}"`);
  }

  const resolve = buildResolver(source.index);
  const transform = doc.createExtension(KHRTextureTransform);
  const transmission = doc.createExtension(KHRMaterialsTransmission);
  const ior = doc.createExtension(KHRMaterialsIOR);
  const emissive = doc.createExtension(KHRMaterialsEmissiveStrength);
  const textures = new Map<string, Texture>();
  const imageUris = new Map<Texture, string>();
  const bySlot = new Map<string, Material>();

  for (const slot of slots) {
    const [key, authoredVariant] = splitMaterialSlot(slot);
    const entry = resolve(key);
    if (!entry) {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED', `theme "${theme}" has no entry for material key ${key}`, { key });
    }
    const preferred = authoredVariant ?? preferredVariantForKey(key);
    const variant = preferred
      ? entry.variants.find((candidate) => candidate.id === preferred)
      : entry.variants[new Rng(seed, `material:${key}`).int(0, entry.variants.length - 1)];
    if (!variant) {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED',
        `material key ${key} has no required variant "${preferred}"`, { key, variant: preferred });
    }
    const p = entry.physical;
    const material = doc.createMaterial(key)
      .setDoubleSided(false)
      .setMetallicFactor(p.metallicFactor ?? 1)
      .setRoughnessFactor(p.roughnessFactor ?? 1)
      .setAlphaMode(p.alphaMode ?? 'OPAQUE');
    if (authoredVariant) material.setExtras({ materialVariant: authoredVariant });

    const infos: TextureInfo[] = [];
    for (const slot of MAP_SLOTS) {
      const path = variant.maps[slot === 'basecolor' ? 'basecolor' : slot];
      if (!path) continue;
      const texture = textureFor(doc, textures, imageUris, source, entry, variant.id, slot, path, theme, mode, opts.baseUrl ?? '');
      const info = attach(material, slot, texture);
      if (info) infos.push(info);
    }

    if (entry.alignment === 'tile' && entry.tiling) {
      // 1 UV unit = 1 tile: world-meter UVs scaled by the tile's world size.
      const [wx, wy] = entry.tiling.worldSize;
      for (const info of infos) {
        info.setExtension('KHR_texture_transform', transform.createTransform().setScale([1 / wx, 1 / wy]));
      }
    } else {
      // Exact placement: 0..1 over the quad, clamped so no neighbouring tile bleeds in.
      const clamp = TextureInfo.WrapMode.CLAMP_TO_EDGE as 33071;
      for (const info of infos) info.setWrapS(clamp).setWrapT(clamp);
    }
    if (variant.maps.emission) {
      material.setEmissiveFactor([1, 1, 1]);
      material.setExtension('KHR_materials_emissive_strength',
        emissive.createEmissiveStrength().setEmissiveStrength(p.emissiveStrength ?? 1));
    }
    if (p.transmission) {
      material.setExtension('KHR_materials_transmission',
        transmission.createTransmission().setTransmissionFactor(p.transmission));
      material.setExtension('KHR_materials_ior', ior.createIOR().setIOR(p.ior ?? 1.5));
    }
    bySlot.set(slot, material);
  }

  return { mode, bySlot, imageUris };
}

function textureFor(
  doc: Document, cache: Map<string, Texture>, uris: Map<Texture, string>, source: MaterialSource,
  entry: MaterialEntry, variantId: string, slot: MapSlot, path: string,
  theme: string, mode: TextureMode, baseUrl: string,
): Texture {
  const id = `${entry.key}/${variantId}/${slot}`;
  const cached = cache.get(id);
  if (cached) return cached;

  const texture = doc.createTexture(id).setMimeType('image/png');
  const uri = `${baseUrl}themes/${theme}/${path}`;
  if (mode === 'embed') {
    const bytes = source.readMap(path);
    if (!bytes) {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED', `map ${path} of ${entry.key} is missing from the materials database`, { key: entry.key });
    }
    texture.setImage(bytes);
  } else {
    texture.setURI(uri);
    uris.set(texture, uri);
  }
  cache.set(id, texture);
  return texture;
}

function attach(material: Material, slot: MapSlot, texture: Texture): TextureInfo | null {
  if (slot === 'basecolor') return material.setBaseColorTexture(texture).getBaseColorTextureInfo();
  if (slot === 'normal') return material.setNormalTexture(texture).getNormalTextureInfo();
  if (slot === 'ao') return material.setOcclusionTexture(texture).getOcclusionTextureInfo();
  return material.setEmissiveTexture(texture).getEmissiveTextureInfo();
}
