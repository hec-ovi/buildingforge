// Floor elevations and kinds. Every bridge/ac-tube/tunnel aperture pins the
// walking surface of one floor to exactly its base; heights between pins are
// redistributed within the family's sane range.

import { ExteriorError } from '../core/errors.ts';
import { Rng } from '../core/rng.ts';
import { RULES } from '../rules/tables.ts';
import { quant } from '../core/polygon.ts';
import type { BuildingRequest, Aperture } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Style } from './model.ts';

export interface Stack {
  /** ascending by index; index -basements..-1 then 0..floors-1 */
  levels: { index: number; elevation: number; height: number; kind: string; pinned: boolean }[];
  top: number;
}

export function buildFloorStack(req: BuildingRequest, family: Family, tier: Tier, style: Style): Stack {
  const rules = RULES[family];
  const floors = req.building.floors;
  const basements = req.building.basements ?? 0;
  const maxHeight = req.parcel.maxHeight;

  // Nominal heights, ground floor taller.
  const heights: number[] = [];
  for (let i = 0; i < floors; i++) heights.push(i === 0 ? style.groundFloorHeight : style.floorHeight);

  // Scale down to the envelope if needed.
  let total = heights.reduce((a, b) => a + b, 0);
  if (total > maxHeight) {
    const scale = maxHeight / total;
    for (let i = 0; i < floors; i++) {
      heights[i] = quant(Math.max(rules.minFloorHeight, (heights[i] as number) * scale));
    }
    total = heights.reduce((a, b) => a + b, 0);
    if (total > maxHeight + 0.001) {
      throw new ExteriorError('E_ENVELOPE_TOO_LOW', `${floors} floors cannot fit in ${maxHeight} m at min height ${rules.minFloorHeight}`);
    }
  }

  const basementHeight = quant(Math.min(3.5, Math.max(2.8, style.floorHeight)));

  // Elevations (walking surfaces): ground at 0.
  const elevations = new Map<number, number>();
  let y = 0;
  for (let i = 0; i < floors; i++) { elevations.set(i, y); y += heights[i] as number; }
  for (let b = 1; b <= basements; b++) elevations.set(-b, -b * basementHeight);

  const pinned = new Set<number>();
  pinApertures(req.apertures ?? [], elevations, pinned, basements, rules.minFloorHeight, basementHeight);

  // Rebuild heights from (possibly moved) elevations; the roof closes the last floor.
  const levels: Stack['levels'] = [];
  const kinds = floorKinds(req, family, tier, floors);
  const indices = [...elevations.keys()].sort((a, b) => a - b);
  for (const idx of indices) {
    const e = elevations.get(idx) as number;
    const next = elevations.get(idx + 1);
    const h = next !== undefined ? next - e : (idx >= 0 ? heights[idx] as number : basementHeight);
    if (h < rules.minFloorHeight - 0.001 && idx >= 0) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture pinning squeezes floor ${idx} to ${h.toFixed(2)} m, below min ${rules.minFloorHeight}`);
    }
    levels.push({ index: idx, elevation: e, height: h, kind: idx < 0 ? 'basement' : (kinds[idx] as string), pinned: pinned.has(idx) });
  }
  const last = levels[levels.length - 1]!;
  const top = last.elevation + last.height;
  if (top > maxHeight + 0.001) {
    throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture pinning pushes the roof to ${top.toFixed(2)} m, above maxHeight ${maxHeight}`);
  }
  return { levels, top };
}

function pinApertures(
  apertures: Aperture[],
  elevations: Map<number, number>,
  pinned: Set<number>,
  basements: number,
  minH: number,
  basementHeight: number,
): void {
  const walkable = apertures.filter((a) => a.kind !== 'wire-anchor');
  const bases = [...new Set(walkable.map((a) => a.base))].sort((a, b) => a - b);
  const original = new Map(elevations); // nominal stack, before any pin moves it
  pinned.add(0); // ground walking surface is 0 by contract
  let lastPinnedIndex = -basements - 1;
  for (const base of bases) {
    let already = false;
    for (const idx of pinned) if (elevations.get(idx) === base) { already = true; break; }
    if (already) continue;
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    for (const [idx, e] of elevations) {
      if (idx <= lastPinnedIndex || pinned.has(idx)) continue;
      const d = Math.abs(e - base);
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    }
    if (bestIdx === null) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `no floor available for aperture base ${base}`);
    }
    elevations.set(bestIdx, base);
    pinned.add(bestIdx);
    lastPinnedIndex = bestIdx;
  }
  // Redistribute unpinned elevations between pins so the stack stays monotone.
  const indices = [...elevations.keys()].sort((a, b) => a - b);
  const pins: number[] = indices.filter((i) => pinned.has(i));
  const segments: [number, number][] = [];
  let prev = indices[0] as number;
  for (const p of pins) { segments.push([prev, p]); prev = p; }
  segments.push([prev, indices[indices.length - 1] as number]);
  for (const [from, to] of segments) {
    if (to - from < 2) continue;
    const eFrom = elevations.get(from) as number;
    const eTo = pinned.has(to) ? (elevations.get(to) as number) : null;
    if (eTo === null) {
      // Open-ended tail: stack the original nominal heights upward from the pin.
      let e = eFrom;
      for (let i = from + 1; i <= to; i++) {
        const nominal = i <= 0 ? basementHeight
          : Math.max(minH, (original.get(i) as number) - (original.get(i - 1) as number));
        e = quant(e + nominal);
        elevations.set(i, e);
      }
      continue;
    }
    const span = eTo - eFrom;
    const n = to - from;
    if (span <= 0) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `aperture bases leave no room between floors ${from} and ${to}`);
    }
    for (let i = 1; i < n; i++) {
      elevations.set(from + i, quant(eFrom + (span * i) / n));
    }
  }
}

function floorKinds(req: BuildingRequest, family: Family, tier: Tier, floors: number): string[] {
  if (req.building.floorKinds) return req.building.floorKinds;
  const rng = new Rng(req.seed, 'floor-kinds');
  const kinds: string[] = [];
  const ground = family === 'commerce' ? 'shop'
    : family === 'industrial' ? 'hall'
    : family === 'residential' && tier === 'poor' ? 'entry'
    : 'lobby';
  for (let i = 0; i < floors; i++) {
    if (i === 0) { kinds.push(ground); continue; }
    kinds.push(familyKind(family));
  }
  // A tall rich hotel or corpo gets one special top floor.
  if (floors >= 10 && (family === 'hotel' || family === 'corpo') && (tier === 'rich' || tier === 'high_rich') && rng.chance(0.6)) {
    kinds[floors - 1] = family === 'hotel' ? 'bar' : 'executive';
  }
  return kinds;
}

function familyKind(family: Family): string {
  switch (family) {
    case 'residential': return 'residential';
    case 'hotel': return 'rooms';
    case 'office': case 'corpo': return 'office';
    case 'hospital': return 'ward';
    case 'security': return 'operations';
    case 'industrial': return 'hall';
    case 'commerce': return 'shop';
  }
}
