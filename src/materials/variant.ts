import { Rng } from '../core/rng.ts';
import { ExteriorError } from '../core/errors.ts';
import type { MaterialEntry, MaterialVariant } from './theme.ts';

/** Geometry-bound surfaces require stable named variants. */
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

/** Named variants are required; all other selection is seeded by canonical key. */
export function selectMaterialVariant(entry: MaterialEntry, key: string, seed: string, preferred?: string): MaterialVariant {
  const id = preferred ?? preferredVariantForKey(key);
  const variant = id ? entry.variants.find((candidate) => candidate.id === id)
    : entry.variants[new Rng(seed, `material:${key}`).int(0, entry.variants.length - 1)];
  if (!variant) throw new ExteriorError('E_MATERIAL_UNRESOLVED',
    `material key ${key} has no required variant "${id}"`, { key, variant: id });
  return variant;
}
