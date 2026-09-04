import bindings from '../../../materials/bindings/exterior-styles.json' with { type: 'json' };
import type { Blueprint, ExteriorStyleId } from '../types.ts';
import type { Tier } from '../rules/families.ts';
import { materialKey } from './model.ts';

type Surfaces = typeof bindings.styles[number]['surfaces'];
const byId = new Map(bindings.styles.map((style) => [style.id, style.surfaces]));
const patterns = new Map(bindings.styles.map((style) => [style.id, style.facadePattern]));
const roles: Record<string, keyof Surfaces> = {
  concrete: 'facade', column: 'border', 'window-frame': 'frame', 'wall-trim': 'trim',
  'window-glass': 'glass', curtain: 'curtain', door: 'door', metal: 'service',
  roof: 'roof', 'floor-slab': 'slab', 'balcony-slab': 'slab',
  'balcony-rail': 'rail', 'door-glass': 'doorGlass', 'ac-unit': 'ac',
  ground: 'ground', 'exterior-louvre': 'louvre',
};

export function styleSurfaces(style: ExteriorStyleId): Surfaces {
  return byId.get(style)!;
}

export function facadeSurfacePattern(style: ExteriorStyleId): Blueprint['facade']['surfacePattern'] {
  return patterns.get(style)! as Blueprint['facade']['surfacePattern'];
}

/** Semantic alias keys remain distinct when their authored variants differ. */
export function selectedMaterialKey(theme: string, tier: Tier, style: ExteriorStyleId, kind: string): string {
  const surfaces = styleSurfaces(style);
  const preserveAlias = ['door-glass', 'balcony-rail', 'balcony-slab'].includes(kind);
  const role = roles[kind];
  const selectedKind = kind === 'parapet' ? surfaces.border.kind
    : role && !preserveAlias ? surfaces[role].kind : kind;
  return materialKey(theme, selectedKind, tier);
}

export function facadeMaterialPlan(theme: string, tier: Tier, style: ExteriorStyleId): Blueprint['facade']['materialPlan'] {
  const surfaces = styleSurfaces(style);
  const binding = (role: keyof Surfaces) => ({ key: materialKey(theme, surfaces[role].kind, tier), variantId: surfaces[role].variant });
  return { palette: 'neutral-dystopian', field: binding('facade'), border: binding('border'), trim: binding('trim') };
}

export function buildingMaterialVariants(theme: string, tier: Tier, style: ExteriorStyleId): Record<string, string> {
  const surfaces = styleSurfaces(style);
  return Object.fromEntries(Object.entries(roles).map(([kind, role]) =>
    [selectedMaterialKey(theme, tier, style, kind), surfaces[role].variant]));
}
