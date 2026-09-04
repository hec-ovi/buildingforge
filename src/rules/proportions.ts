// The proportion table (schemas/proportions.json) and the fit it defines:
// how tall a window is on a floor of a given height, how a storefront reaches
// its head band, and how tall an entrance door is. One module owns the
// arithmetic so the facade builder, the floor stack and the machine check can
// never drift apart.

import table from '../../schemas/proportions.json' with { type: 'json' };
import type { Family, Tier } from './families.ts';

export interface FamilyProportions {
  entrance: [number, number];
  /** window height as a fraction of the floor's clear height */
  windowHeight: [number, number];
  sill: [number, number];
  windowWidth: [number, number];
}

export const PROPORTIONS = table as unknown as {
  clearHeightAllowance: number;
  entranceRange: [number, number];
  standardFamilies: Family[];
  families: Record<Family, FamilyProportions>;
  storefront: { sill: [number, number] };
  podium: { families: Family[]; sill: number; height: number; width: number; bayStride: number };
  megablock: { tier: Tier; windowHeight: [number, number]; windowWidth: [number, number]; minSill: number };
  entranceWidth: { standard: [number, number]; grand: [number, number] };
};

/** Floor-to-floor minus the slab and ceiling zone: the height a person sees. */
export function clearHeight(floorHeight: number): number {
  return Math.max(0, floorHeight - PROPORTIONS.clearHeightAllowance);
}

export interface WindowFit { height: number; sill: number }

/**
 * The window a floor of this clear height gets from a building's frozen
 * fraction and sill. The sill drops to the family minimum before the height is
 * trimmed, so a short floor loses sill before it loses glass; null when even the
 * minimum window cannot stand in the floor.
 */
export function fitWindow(spec: FamilyProportions, fraction: number, sill: number, clear: number): WindowFit | null {
  const minH = Math.min(spec.windowHeight[0] * clear, clear - spec.sill[0]);
  let h = fraction * clear;
  let s = sill;
  if (s + h > clear) s = Math.max(spec.sill[0], clear - h);
  if (s + h > clear) h = clear - s;
  if (h < minH - 1e-9) h = minH;
  if (h < 0.5 || s < 0 || s + h > clear + 1e-9) return null;
  // Quantize the sill first, then trim the glass to it: rounding both up would
  // push the head into the band the facade keeps under the slab above.
  const sill2 = q(s);
  const height2 = Math.min(q(h), qDown(clear - sill2));
  return height2 >= 0.5 ? { height: height2, sill: sill2 } : null;
}

/** Storefront glazing: from its sill up to the clear height, the head band above. */
export function fitStorefront(sill: number, clear: number): WindowFit | null {
  const seat = q(sill);
  const height = qDown(clear - seat);
  if (height < 0.5) return null;
  return { height, sill: seat };
}

/** The smallest height fitWindow can return on this floor: what the invariant asserts. */
export function minWindowHeight(spec: FamilyProportions, clear: number): number {
  return Math.min(spec.windowHeight[0] * clear, clear - spec.sill[0]);
}

/**
 * Entrance door height for a family, capped by what the ground floor can hold.
 * The cap rounds down onto the 0.05 grid, so a short ground floor never gets a
 * door quantized taller than its clear height.
 */
export function entranceHeight(spec: FamilyProportions, pick: number, groundClear: number): number {
  const want = spec.entrance[0] + pick * (spec.entrance[1] - spec.entrance[0]);
  return Math.min(q(want), qDown(groundClear));
}

/** The shortest entrance this ground floor may carry: the family minimum, or all it can hold. */
export function minEntranceHeight(spec: FamilyProportions, groundClear: number): number {
  return Math.min(spec.entrance[0], qDown(groundClear));
}

/** The ground floor that holds the family's shortest entrance under its ceiling zone. */
export function groundFloorNeed(family: Family): number {
  return PROPORTIONS.families[family].entrance[0] + PROPORTIONS.clearHeightAllowance;
}

export function proportionsOf(family: Family): FamilyProportions {
  return PROPORTIONS.families[family];
}

/** A ground floor that sells or receives reads as a shopfront, not as a housing floor. */
export function isStorefrontFloor(family: Family, kind: string): boolean {
  if (family === 'industrial' || family === 'security') return false;
  if (isPodiumFloor(family, kind)) return false;
  return kind !== 'entry' && kind !== 'basement';
}

/** Solid street base, except when the floor explicitly carries a public shop. */
export function isPodiumFloor(family: Family, kind: string): boolean {
  return PROPORTIONS.podium.families.includes(family)
    && !['commerce', 'restaurant', 'coffee_shop', 'mall'].includes(kind);
}

export function fitPodiumWindow(clear: number): WindowFit | null {
  const sill = PROPORTIONS.podium.sill;
  const height = Math.min(PROPORTIONS.podium.height, qDown(clear - sill));
  return height >= 0.5 ? { sill, height } : null;
}

const q = (v: number): number => Math.round(v * 20) / 20;
const qDown = (v: number): number => Math.floor(v * 20 + 1e-9) / 20;
