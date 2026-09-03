// Inspection look: one flat colour per material kind, for reading geometry when
// the textured building is too busy. Walls stay opaque and single sided, so a
// solid facade never reads as a hole.

import { MeshStandardMaterial } from 'three';

const KIND_COLORS: Record<string, { color: number; opacity?: number }> = {
  'wall': { color: 0x8a8a92 },
  'wall-trim': { color: 0x6a6a74 },
  'column': { color: 0x74747e },
  'window-glass': { color: 0x8f999b, opacity: 0.32 },
  'window-frame': { color: 0x3a3a44 },
  'curtain': { color: 0xd8cfa8 },
  'door': { color: 0x5a4a3a },
  'door-glass': { color: 0x9fd8ef, opacity: 0.5 },
  'balcony-slab': { color: 0x7e7e88 },
  'balcony-rail': { color: 0x4a4a54 },
  'roof': { color: 0x55555e },
  'floor-slab': { color: 0x63636d },
  'parapet': { color: 0x77777f },
  'signage': { color: 0xffcf5a },
  'letter-atlas': { color: 0xfff3c4 },
  'ad-screen': { color: 0x64e0ff },
  'light-fixture': { color: 0xfff0c0 },
  'fire-escape': { color: 0x40342c },
  'aperture-frame': { color: 0xc06040 },
  'roof-artifact': { color: 0x60606a },
};

/** `materialName` is the canonical theme/kind/tier key; unknown kinds shout magenta. */
export function flatMaterialFor(materialName: string): MeshStandardMaterial {
  const kind = materialName.split('/')[1] ?? 'wall';
  const spec = KIND_COLORS[kind] ?? { color: 0xff00ff };
  return new MeshStandardMaterial({
    color: spec.color,
    transparent: spec.opacity !== undefined,
    opacity: spec.opacity ?? 1,
    metalness: 0.1,
    roughness: 0.85,
  });
}
