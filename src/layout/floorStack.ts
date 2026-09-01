// Floor elevations and kinds. Every bridge/ac-tube/tunnel aperture pins the
// walking surface of one floor to exactly its base. Above ground this is a
// bounded allocation problem: between consecutive bases, any floor count whose
// uniform heights stay inside [minFloorHeight, maxFloorHeight] is legal, so the
// solver searches counts instead of failing on one packing.

import { ExteriorError } from '../core/errors.ts';
import { Rng } from '../core/rng.ts';
import { RULES } from '../rules/tables.ts';
import { quant } from '../core/polygon.ts';
import type { BuildingRequest } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Style } from './model.ts';

export interface Stack {
  /** ascending by index; index -basements..-1 then 0..floors-1 */
  levels: { index: number; elevation: number; height: number; kind: string }[];
  top: number;
}

const quantDown = (v: number): number => Math.floor(v * 20 + 1e-9) / 20;

export function buildFloorStack(req: BuildingRequest, family: Family, tier: Tier, style: Style): Stack {
  const rules = RULES[family];
  const floors = req.building.floors;
  const basements = req.building.basements ?? 0;
  const maxHeight = req.parcel.maxHeight;
  const basementHeight = quant(Math.min(3.5, Math.max(2.8, style.floorHeight)));

  const walkable = (req.apertures ?? []).filter((a) => a.kind !== 'wire-anchor');
  const basesPos = [...new Set(walkable.map((a) => a.base).filter((b) => b > 1e-9))].sort((a, b) => a - b);
  const basesNeg = [...new Set(walkable.map((a) => a.base).filter((b) => b < -1e-9))].sort((a, b) => a - b);
  // The floor pinned at a base must contain the tallest aperture there.
  const reqH = new Map<number, number>();
  for (const a of walkable) {
    const key = Math.abs(a.base) <= 1e-9 ? 0 : a.base;
    reqH.set(key, Math.max(reqH.get(key) ?? 0, a.height));
  }

  const elevAbove = basesPos.length === 0
    ? nominalStack(floors, style, rules.minFloorHeight, maxHeight, reqH.get(0) ?? 0)
    : solveSplit(floors, basesPos, rules.minFloorHeight, rules.maxFloorHeight, style.floorHeight, maxHeight, reqH);

  const elevBelow = basementElevations(basements, basesNeg, basementHeight, reqH);

  const kinds = floorKinds(req, family, tier, floors);
  const levels: Stack['levels'] = [];
  for (let b = basements; b >= 1; b--) {
    const e = elevBelow.get(-b) as number;
    const next = b === 1 ? 0 : (elevBelow.get(-b + 1) as number);
    levels.push({ index: -b, elevation: e, height: next - e, kind: 'basement' });
  }
  for (let i = 0; i < floors; i++) {
    const e = elevAbove[i] as number;
    const next = i + 1 < floors ? (elevAbove[i + 1] as number) : elevAbove[floors] as number;
    levels.push({ index: i, elevation: e, height: next - e, kind: kinds[i] as string });
  }
  return { levels, top: elevAbove[floors] as number };
}

/**
 * No pins: nominal heights (taller ground floor), scaled down to the envelope.
 * Scaling rounds DOWN to the 0.05 grid so quantization can never push the total
 * back over maxHeight; a deterministic shave absorbs clamp interactions.
 */
function nominalStack(floors: number, style: Style, minH: number, maxHeight: number, groundReq: number): number[] {
  const minOf = (i: number) => (i === 0 ? Math.max(minH, groundReq) : minH);
  const heights: number[] = [];
  for (let i = 0; i < floors; i++) {
    heights.push(Math.max(minOf(i), i === 0 ? style.groundFloorHeight : style.floorHeight));
  }
  let total = heights.reduce((a, b) => a + b, 0);
  if (total > maxHeight) {
    const scale = maxHeight / total;
    for (let i = 0; i < floors; i++) heights[i] = Math.max(minOf(i), quantDown((heights[i] as number) * scale));
    total = heights.reduce((a, b) => a + b, 0);
    while (total > maxHeight + 1e-9) {
      let pick = -1;
      for (let i = 0; i < floors; i++) {
        if ((heights[i] as number) >= minOf(i) + 0.05 - 1e-9 && (pick < 0 || (heights[i] as number) > (heights[pick] as number))) pick = i;
      }
      if (pick < 0) {
        throw new ExteriorError('E_ENVELOPE_TOO_LOW',
          `${floors} floors need at least ${(floors * minH + Math.max(0, groundReq - minH)).toFixed(2)} m at minimum floor height ${minH}${groundReq > minH ? ` with a ${groundReq} m ground floor for its aperture` : ''}, maxHeight is ${maxHeight}`);
      }
      heights[pick] = quant((heights[pick] as number) - 0.05);
      total -= 0.05;
    }
  }
  const elev: number[] = [0];
  for (let i = 0; i < floors; i++) elev.push((elev[i] as number) + (heights[i] as number));
  return elev; // length floors+1, last entry = roof top
}

/**
 * Pinned bases above ground: choose how many floors land between consecutive
 * bases, then a tail above the top base. The first floor of each segment starts
 * at a pinned base and must contain the tallest aperture there (height >= reqH),
 * so it goes tall and the rest of the segment splits uniformly. Returns
 * floors+1 elevations (last = roof top).
 */
function solveSplit(floors: number, bases: number[], minH: number, maxH: number, nominal: number, maxHeight: number, reqAll: Map<number, number>): number[] {
  const anchors = [0, ...bases];
  const k = bases.length;
  const req = anchors.map((a) => reqAll.get(a) ?? 0);
  const spans: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  for (let j = 0; j < k; j++) {
    const span = (anchors[j + 1] as number) - (anchors[j] as number);
    const r = req[j] as number;
    const l = Math.max(1, Math.ceil(span / maxH - 1e-9));
    const h = r > minH ? 1 + Math.floor((span - r) / minH + 1e-9) : Math.floor(span / minH + 1e-9);
    if (span < r - 1e-9 || l > h) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE',
        `gap of ${span.toFixed(2)} m from base ${anchors[j]} (which must hold a ${r.toFixed(2)} m aperture floor) to base ${anchors[j + 1]} admits no floor split with heights in [${minH}, ${maxH}]`);
    }
    spans.push(span); lo.push(l); hi.push(h);
  }
  const topBase = anchors[k] as number;
  const reqTop = req[k] as number;
  const tailRoom = maxHeight - topBase;
  const firstTailMin = Math.max(minH, reqTop);
  if (tailRoom < firstTailMin - 1e-9) {
    throw new ExteriorError('E_APERTURE_UNREACHABLE',
      `top aperture base ${topBase} leaves ${tailRoom.toFixed(2)} m below maxHeight ${maxHeight}, less than its ${firstTailMin.toFixed(2)} m aperture floor`);
  }
  const hiTail = 1 + Math.floor((tailRoom - firstTailMin) / minH + 1e-9);
  const loSum = lo.reduce((a, b) => a + b, 0) + 1;
  const hiSum = hi.reduce((a, b) => a + b, 0) + hiTail;
  if (floors < loSum || floors > hiSum) {
    throw new ExteriorError('E_APERTURE_UNREACHABLE',
      `floor count ${floors} incompatible with the aperture bases; feasible counts are ${loSum}..${hiSum}`);
  }

  // Allocation: start near nominal, then nudge deterministically to the exact total.
  const m: number[] = spans.map((s, j) => Math.min(hi[j] as number, Math.max(lo[j] as number, Math.round(s / nominal))));
  let mTail = Math.min(hiTail, Math.max(1, floors - m.reduce((a, b) => a + b, 0)));
  let diff = floors - (m.reduce((a, b) => a + b, 0) + mTail);
  while (diff !== 0) {
    if (diff > 0) {
      // Add a floor where the current average height is tallest (most room to split).
      let pick = -1;
      for (let j = 0; j < k; j++) {
        if ((m[j] as number) < (hi[j] as number) && (pick < 0 || (spans[j] as number) / (m[j] as number) > (spans[pick] as number) / (m[pick] as number))) pick = j;
      }
      if (pick >= 0) m[pick] = (m[pick] as number) + 1;
      else mTail++;
      diff--;
    } else {
      // Remove a floor where the current average height is shortest (most squeezed).
      let pick = -1;
      for (let j = 0; j < k; j++) {
        if ((m[j] as number) > (lo[j] as number) && (pick < 0 || (spans[j] as number) / (m[j] as number) < (spans[pick] as number) / (m[pick] as number))) pick = j;
      }
      if (pick >= 0) m[pick] = (m[pick] as number) - 1;
      else mTail--;
      diff++;
    }
  }

  const elev: number[] = [];
  for (let j = 0; j < k; j++) {
    const count = m[j] as number;
    const anchor = anchors[j] as number;
    const span = spans[j] as number;
    // First floor tall enough for its aperture, the rest uniform.
    const h1 = Math.max(req[j] as number, span / count);
    elev.push(anchor);
    for (let i = 1; i < count; i++) elev.push(anchor + h1 + ((span - h1) * (i - 1)) / (count - 1));
  }
  const h1Tail = Math.min(Math.max(firstTailMin, Math.min(nominal, tailRoom / mTail)), tailRoom - (mTail - 1) * minH);
  elev.push(topBase);
  if (mTail === 1) {
    elev.push(topBase + h1Tail); // roof top
  } else {
    const hRest = Math.max(minH, quantDown(Math.min(nominal, (tailRoom - h1Tail) / (mTail - 1))));
    for (let i = 1; i < mTail; i++) elev.push(topBase + h1Tail + hRest * (i - 1));
    elev.push(topBase + h1Tail + hRest * (mTail - 1)); // roof top
  }
  return elev;
}

/** Basements: nominal steps below ground, tunnel bases pinned to the nearest level, monotone. */
function basementElevations(basements: number, basesNeg: number[], basementHeight: number, reqAll: Map<number, number>): Map<number, number> {
  const elev = new Map<number, number>();
  for (let b = 1; b <= basements; b++) elev.set(-b, -b * basementHeight);
  if (basesNeg.length === 0) return elev;
  const pinned = new Map<number, number>();
  let ceilIdx = 0; // pins assigned deepest-first, each strictly below the previous
  for (const base of [...basesNeg].reverse()) { // shallowest first toward deepest? assign shallow bases to shallow basements
    let best: number | null = null;
    for (let b = ceilIdx + 1; b <= basements; b++) {
      if (best === null || Math.abs((elev.get(-b) as number) - base) < Math.abs((elev.get(-best) as number) - base)) best = b;
    }
    if (best === null) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `no basement level available for aperture base ${base}`);
    }
    pinned.set(-best, base);
    ceilIdx = best;
  }
  for (const [idx, base] of pinned) elev.set(idx, base);
  // Unpinned levels slide deeper to keep spacing; conflicting pins are a real error.
  let prev = 0;
  for (let b = 1; b <= basements; b++) {
    if (!pinned.has(-b)) elev.set(-b, Math.min(-b * basementHeight, prev - basementHeight));
    const e = elev.get(-b) as number;
    const need = Math.max(2.2, pinned.has(-b) ? reqAll.get(e) ?? 0 : 0);
    if (prev - e < need - 1e-9) {
      throw new ExteriorError('E_APERTURE_UNREACHABLE', `basement level ${-b} pinned at ${e.toFixed(2)} leaves ${(prev - e).toFixed(2)} m of headroom, its aperture needs ${need.toFixed(2)}`);
    }
    prev = e;
  }
  return elev;
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
