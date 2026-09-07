// Turns the canonical material keys the mesh uses into real glTF materials:
// maps from the materials box, physical factors, and the UV transform that makes
// a tiled map cover its declared world size.

import { Document, type Material, type Texture, TextureInfo } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRTextureTransform,
} from '@gltf-transform/extensions';
import { ExteriorError } from '../core/errors.ts';
import { buildResolver, type MaterialEntry, type MaterialSource } from './theme.ts';
import { splitMaterialSlot } from './slot.ts';
import { MAP_SLOTS, type MapSlot } from './maps.ts';
import { selectMaterialVariant } from './variant.ts';
import type { NativeFinishes } from './native/NativeFinishes.ts';

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
  /** Bundled native-image finishes; defaults to the built-in source's choice. */
  nativeFinishes?: boolean;
  /** Browser asset prefix before themes/, default native-materials/ beside the page. */
  nativeBaseUrl?: string;
}

export interface MaterialPlan {
  mode: TextureMode;
  /** why the requested mode was not honoured, when it was not */
  reason?: string;
  bySlot: Map<string, Material>;
  /** external mode: the URI each image keeps instead of embedded bytes */
  imageUris: Map<Texture, string>;
}

/** Fabric shades are one fitted plane that must read from both sides of the glazing. */
function doubleSidedForKey(key: string): boolean {
  return key.split('/')[1] === 'curtain';
}

/** Untextured materials named by the canonical key: what a keys-only consumer resolves itself. */
function keysOnly(doc: Document, slots: string[], selected: Record<string, string>, reason?: string): MaterialPlan {
  const bySlot = new Map<string, Material>();
  for (const slot of slots) {
    const [key, variant] = splitMaterialSlot(slot);
    const material = doc.createMaterial(key)
      .setDoubleSided(doubleSidedForKey(key)).setMetallicFactor(0).setRoughnessFactor(1);
    const preferred = variant ?? selected[key];
    if (preferred) material.setExtras({ materialVariant: preferred });
    bySlot.set(slot, material);
  }
  return { mode: 'keys', reason, bySlot, imageUris: new Map() };
}

export function createMaterials(
  doc: Document, slots: string[], theme: string, seed: string, opts: TextureOptions, source: MaterialSource | null,
  selected: Record<string, string> = {},
  native?: NativeFinishes,
): MaterialPlan {
  const mode = opts.mode ?? 'external';
  if (mode === 'keys') return keysOnly(doc, slots, selected);
  if (!source) {
    if (mode === 'embed') {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED', `embedded textures need the materials database; theme "${theme}" was not found`);
    }
    return keysOnly(doc, slots, selected, `no materials database for theme "${theme}"`);
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
    const [key, authoredVariant, finish] = splitMaterialSlot(slot);
    let entry = resolve(key);
    if (!entry) {
      throw new ExteriorError('E_MATERIAL_UNRESOLVED', `theme "${theme}" has no entry for material key ${key}`, { key });
    }
    let variant = selectMaterialVariant(entry, key, seed, authoredVariant ?? selected[key]);
    const nativeEntry = native?.resolve(key, variant.id, finish);
    if (nativeEntry) {
      entry = nativeEntry;
      variant = nativeEntry.variants[0]!;
    }
    const p = entry.physical;
    const material = doc.createMaterial(key)
      .setDoubleSided(doubleSidedForKey(key))
      .setMetallicFactor(p.metallicFactor ?? 1)
      .setRoughnessFactor(p.roughnessFactor ?? 1)
      .setAlphaMode(p.alphaMode ?? 'OPAQUE');
    if (authoredVariant ?? selected[key]) material.setExtras({ materialVariant: authoredVariant ?? selected[key] });
    if (nativeEntry) material.setExtras({ ...material.getExtras(), nativeMaterial: {
      key: entry.key, variantId: variant.id, paletteId: native!.paletteId,
    } });

    const infos: TextureInfo[] = [];
    for (const slot of MAP_SLOTS) {
      const path = variant.maps[slot];
      if (!path) continue;
      const texture = textureFor(doc, textures, imageUris, nativeEntry ? native! : source,
        entry, variant.id, slot, path, theme, nativeEntry ? 'embed' : mode, opts.baseUrl ?? '');
      const info = attach(material, slot, texture);
      if (info) infos.push(info);
    }
    if (variant.maps.metallicRoughness) material.setMetallicFactor(1).setRoughnessFactor(1);

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
  doc: Document, cache: Map<string, Texture>, uris: Map<Texture, string>, source: Pick<MaterialSource, 'readMap'>,
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
  if (slot === 'metallicRoughness') return material.setMetallicRoughnessTexture(texture).getMetallicRoughnessTextureInfo();
  return material.setEmissiveTexture(texture).getEmissiveTextureInfo();
}
