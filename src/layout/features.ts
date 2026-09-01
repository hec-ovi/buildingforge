// Facade and roof features: signage, ad screens, lights, fire escape, roof artifacts.

import { ExteriorError } from '../core/errors.ts';
import { Rng } from '../core/rng.ts';
import { SIGNAGE, AD_SCREEN, FACADE, LIGHTING, FIRE_ESCAPE, ROOF_ARTIFACTS, OPENING } from '../rules/tables.ts';
import { edgeLength, edgeDir, edgeNormal, pointInPolygon, centroid, quant, type P2 } from '../core/polygon.ts';
import type { Blueprint, BuildingRequest, P3, RoofArtifact } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Massing } from './massing.ts';
import type { FloorLayout, Style } from './model.ts';

export interface Features {
  signage: Blueprint['signage'];
  screens: Blueprint['screens'];
  lights: Blueprint['lights'];
  facadeArtifacts: Blueprint['facadeArtifacts'];
  fireEscape: Blueprint['fireEscape'];
  roof: Blueprint['roof'];
}

export function buildFeatures(
  req: BuildingRequest, family: Family, tier: Tier, style: Style,
  massing: Massing, top: number, floors: FloorLayout[], streetEdge: number,
): Features {
  const ground = massing.groundOutline;
  const groundFloor = floors.find((f) => f.index === 0)!;
  const signage: Blueprint['signage'] = [];
  const screens: Blueprint['screens'] = [];
  const lights: Blueprint['lights'] = [];

  const blockedU = blockedIntervalsByFace(req, ground);

  placeSignage(req, ground, streetEdge, groundFloor.height, top, signage, blockedU);
  placeScreens(req, family, tier, ground, streetEdge, groundFloor.height, top, signage.length > 0, screens, blockedU);
  placeLights(req, family, ground, streetEdge, groundFloor, lights);
  const facadeArtifacts = placeFacadeArtifacts(req, style, floors);
  const fireEscape = placeFireEscape(req, family, tier, massing, floors, streetEdge);
  const roof = buildRoof(req, family, massing, top, style, floors);

  return { signage, screens, lights, facadeArtifacts, fireEscape, roof };
}

/**
 * Surface-mounted utility boxes: one roll per panel cell of each above-ground
 * floor, placed on wall clear of every opening. Dense on the megablock tier,
 * sparse on the panel tier, absent on glass.
 */
function placeFacadeArtifacts(req: BuildingRequest, style: Style, floors: FloorLayout[]): Blueprint['facadeArtifacts'] {
  const out: Blueprint['facadeArtifacts'] = [];
  if (style.facade.utilityChance <= 0) return out;
  const module = style.facade.panelModule;
  const box = FACADE.utilityBox;

  for (const floor of floors) {
    if (floor.index < 1) continue; // the ground floor belongs to the street
    for (let e = 0; e < floor.outline.length; e++) {
      const L = edgeLength(floor.outline, e);
      const onEdge = floor.openings.filter((o) => o.edge === e);
      for (let c = 0; c < Math.floor(L / module); c++) {
        const rng = new Rng(req.seed, `utility:${floor.index}:${e}:${c}`);
        if (!rng.chance(style.facade.utilityChance)) continue;
        const w = quant(rng.range(...box.width));
        const h = quant(rng.range(...box.height));
        const d = quant(rng.range(...box.depth));
        const offset = quant(c * module + 0.2 + rng.next() * Math.max(0, module - 0.4 - w));
        const sill = quant(0.6 + rng.next() * Math.max(0, floor.height - h - 1.2));
        if (offset + w > L - 0.2) continue;
        const clear = onEdge.every((o) => offset + w <= o.offset - 0.15 || offset >= o.offset + o.width + 0.15
          || sill + h <= o.sill - 0.15 || sill >= o.sill + o.height + 0.15);
        if (!clear) continue;
        out.push({ kind: 'utility-box', floor: floor.index, edge: e, offset, sill, size: [w, h, d] });
      }
    }
  }
  return out;
}

/** u-intervals per parcel face that apertures demand kept clear (whole building height matters for overlays). */
function blockedIntervalsByFace(req: BuildingRequest, ground: P2[]): Map<number, [number, number, number, number][]> {
  const map = new Map<number, [number, number, number, number][]>();
  for (const a of req.apertures ?? []) {
    if (a.face >= ground.length) continue;
    const [vx, vz] = ground[a.face] as P2;
    const d = edgeDir(ground, a.face);
    let minU = Infinity, maxU = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py, pz] of a.cut.polygon) {
      const u = (px - vx) * d[0] + (pz - vz) * d[1];
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const list = map.get(a.face) ?? [];
    list.push([minU - 0.3, maxU + 0.3, minY - 0.3, maxY + 0.3]);
    map.set(a.face, list);
  }
  return map;
}

function rectClear(blocked: Map<number, [number, number, number, number][]>, face: number, u0: number, u1: number, y0: number, y1: number): boolean {
  for (const [bu0, bu1, by0, by1] of blocked.get(face) ?? []) {
    if (u0 < bu1 && u1 > bu0 && y0 < by1 && y1 > by0) return false;
  }
  return true;
}

function facePoint(outline: P2[], edge: number, u: number, y: number): P3 {
  const [vx, vz] = outline[edge] as P2;
  const d = edgeDir(outline, edge);
  return [vx + d[0] * u, y, vz + d[1] * u];
}

function placeSignage(
  req: BuildingRequest, ground: P2[], streetEdge: number, groundHeight: number, top: number,
  out: Blueprint['signage'], blocked: Map<number, [number, number, number, number][]>,
): void {
  const spec = req.options?.signage;
  if (!spec) return;
  const e = streetEdge;
  const L = edgeLength(ground, e);
  const usable = L - 2 * OPENING.cornerMargin;
  const normal = edgeNormal(ground, e);
  const rng = new Rng(req.seed, 'signage');

  if (spec.mode === 'marquee') {
    // Legibility floor 0.2 m (USSC: letter height ~ distance / 120, storefront read at ~25 m).
    let letterH = quant(rng.range(...SIGNAGE.bandHeight) * 0.55);
    let width = spec.text.length * SIGNAGE.letterAdvance * letterH;
    while (width > usable * 0.9 && letterH > 0.2) {
      letterH = quant(letterH - 0.05);
      width = spec.text.length * SIGNAGE.letterAdvance * letterH;
    }
    if (width > usable * 0.9) {
      throw new ExteriorError('E_SIGNAGE_TEXT_TOO_LONG', `"${spec.text}" needs ${width.toFixed(1)} m, facade offers ${(usable * 0.9).toFixed(1)}`);
    }
    const bandH = quant(letterH / 0.55);
    const y = Math.min(Math.max(2.6, groundHeight - bandH * 0.5), Math.max(2.6, top - bandH));
    const uc = L / 2;
    if (!rectClear(blocked, e, uc - width / 2, uc + width / 2, y, y + bandH)) return;
    out.push({
      mode: 'marquee', text: spec.text, letterHeight: letterH,
      center: facePoint(ground, e, uc, y + bandH / 2),
      width: quant(width), height: bandH, normal,
    });
    return;
  }

  const ratio = SIGNAGE.logoRatios[spec.ratio] as number;
  const width = quant(Math.min(Math.max(L * 0.3, 1.5), 8));
  const height = quant(width / ratio);
  const tall = top > groundHeight * 4;
  const y = tall ? top - height - 2 : groundHeight + 0.3;
  const uc = L / 2;
  if (y < groundHeight * 0.5 || y + height > top) return;
  if (!rectClear(blocked, e, uc - width / 2, uc + width / 2, y, y + height)) return;
  out.push({ mode: 'logo', ratio: spec.ratio, center: facePoint(ground, e, uc, y + height / 2), width, height, normal });
}

function placeScreens(
  req: BuildingRequest, family: Family, tier: Tier, ground: P2[], streetEdge: number,
  groundHeight: number, top: number, signagePresent: boolean,
  out: Blueprint['screens'], blocked: Map<number, [number, number, number, number][]>,
): void {
  const opt = req.options?.adScreens ?? 'auto';
  if (opt === 'off') return;
  const floorsTall = top / 3.5;
  const eligible = AD_SCREEN.families.includes(family) && AD_SCREEN.tiers.includes(tier) && floorsTall >= 6;
  const rng = new Rng(req.seed, 'ad-screen');
  if (opt === 'auto' && (!eligible || !rng.chance(0.5))) return;

  // Street facade unless signage sits there; then the longest other face.
  let e = streetEdge;
  if (signagePresent) {
    let len = 0;
    for (let i = 0; i < ground.length; i++) {
      if (i === streetEdge) continue;
      const L = edgeLength(ground, i);
      if (L > len) { len = L; e = i; }
    }
  }
  const L = edgeLength(ground, e);
  const width = quant(Math.min(L - 2, L * rng.range(...AD_SCREEN.widthFraction)));
  if (width < 2) return;
  const ratio = rng.pick(AD_SCREEN.ratios);
  const height = quant(width / ratio);
  const yc = Math.min(Math.max(top * 0.55, groundHeight + 2 + height / 2), top - 2 - height / 2);
  if (yc - height / 2 < groundHeight) return;
  const uc = L / 2;
  if (!rectClear(blocked, e, uc - width / 2, uc + width / 2, yc - height / 2, yc + height / 2)) return;
  out.push({ center: facePoint(ground, e, uc, yc), width, height, normal: edgeNormal(ground, e) });
}

function placeLights(
  req: BuildingRequest, family: Family, ground: P2[], streetEdge: number,
  groundFloor: FloorLayout, out: Blueprint['lights'],
): void {
  // Entrance fixtures flank every ground door.
  for (const o of groundFloor.openings) {
    if (o.kind !== 'door') continue;
    const normal = edgeNormal(ground, o.edge);
    const y = Math.min(o.height + 0.4, groundFloor.height - 0.2);
    out.push({ kind: 'entrance', position: facePoint(ground, o.edge, o.offset - 0.3, y), normal });
    out.push({ kind: 'entrance', position: facePoint(ground, o.edge, o.offset + o.width + 0.3, y), normal });
  }
  if (!LIGHTING.accentFamilies.includes(family)) return;

  // Accent fixtures on clear wall along the street edge, one per bay-ish spacing.
  const rng = new Rng(req.seed, 'lights');
  const e = streetEdge;
  const L = edgeLength(ground, e);
  const spacing = rng.range(...LIGHTING.accentSpacing);
  const y = groundFloor.height * 0.8;
  const openingsOnEdge = groundFloor.openings.filter((o) => o.edge === e);
  for (let u = OPENING.cornerMargin + spacing / 2; u < L - OPENING.cornerMargin; u += spacing) {
    const overOpening = openingsOnEdge.some((o) => u > o.offset - 0.3 && u < o.offset + o.width + 0.3 && y > o.sill && y < o.sill + o.height + 0.5);
    if (overOpening) continue;
    out.push({ kind: 'accent', position: facePoint(ground, e, quant(u), quant(y)), normal: edgeNormal(ground, e) });
  }
}

function placeFireEscape(
  req: BuildingRequest, family: Family, tier: Tier, massing: Massing,
  floors: FloorLayout[], streetEdge: number,
): Blueprint['fireEscape'] {
  if (!req.options?.fireEscape) return null;
  const above = floors.filter((f) => f.index >= 0);
  if (above.length < 2 || above.length > FIRE_ESCAPE.maxFloors) return null;
  if (!FIRE_ESCAPE.allowedFamilies.includes(family) || !FIRE_ESCAPE.allowedTiers.includes(tier)) return null;
  // Constant outline only (no setbacks): every floor must share the ground ring.
  if (above.some((f) => f.outline !== massing.groundOutline)) return null;
  const ground = massing.groundOutline;
  let e = -1, len = 0;
  for (let i = 0; i < ground.length; i++) {
    if (i === streetEdge) continue;
    const L = edgeLength(ground, i);
    if (L > len) { len = L; e = i; }
  }
  if (e < 0 || len < FIRE_ESCAPE.platformLength + 1) return null;
  return { edge: e, fromFloor: 1, toFloor: above.length - 1 };
}

function buildRoof(
  req: BuildingRequest, family: Family, massing: Massing, top: number,
  style: Style, floors: FloorLayout[],
): Blueprint['roof'] {
  const topFloor = floors[floors.length - 1]!;
  const outline = topFloor.outline;
  const artifacts: RoofArtifact[] = [];
  if ((req.options?.roofArtifacts ?? 'auto') !== 'off') {
    const rng = new Rng(req.seed, 'roof');
    const placed: { cx: number; cz: number; hw: number; hd: number }[] = [];
    const [cx0, cz0] = centroid(outline);
    for (const rule of ROOF_ARTIFACTS[family]) {
      if (!rng.chance(rule.chance)) continue;
      const w = quant(rng.range(...rule.size[0]));
      const d = quant(rng.range(...rule.size[1]));
      const h = quant(rng.range(...rule.size[2]));
      // rotationDeg 90 means the box occupies [d, w] on the ground; size stays [w, d, h].
      const rotationDeg = rng.chance(0.5) ? 90 : 0;
      const ww = rotationDeg === 90 ? d : w;
      const dd = rotationDeg === 90 ? w : d;
      const spot = findRoofSpot(outline, placed, ww, dd, cx0, cz0, rng, rule.kind === 'helipad' || rule.kind === 'penthouse-screen' || rule.kind === 'bulkhead');
      if (!spot) continue;
      placed.push({ cx: spot[0], cz: spot[1], hw: ww / 2 + 0.4, hd: dd / 2 + 0.4 });
      artifacts.push({ kind: rule.kind, center: [quant(spot[0]), quant(spot[1])], size: [w, d, h], rotationDeg });
    }
  }
  return { elevation: quant(top), outline, parapetHeight: style.parapetHeight, artifacts };
}

function findRoofSpot(
  outline: P2[], placed: { cx: number; cz: number; hw: number; hd: number }[],
  w: number, d: number, cx0: number, cz0: number, rng: Rng, preferCenter: boolean,
): P2 | null {
  const candidates: P2[] = preferCenter ? [[cx0, cz0]] : [];
  for (let i = 0; i < 8; i++) {
    candidates.push([cx0 + rng.range(-0.4, 0.4) * spanX(outline), cz0 + rng.range(-0.4, 0.4) * spanZ(outline)]);
  }
  for (const [cx, cz] of candidates) {
    const corners: P2[] = [
      [cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2],
    ];
    if (!corners.every((p) => pointInPolygon(outline, p))) continue;
    const clash = placed.some((q) => Math.abs(cx - q.cx) < w / 2 + q.hw && Math.abs(cz - q.cz) < d / 2 + q.hd);
    if (clash) continue;
    return [cx, cz];
  }
  return null;
}

function spanX(outline: P2[]): number {
  let min = Infinity, max = -Infinity;
  for (const [x] of outline) { if (x < min) min = x; if (x > max) max = x; }
  return max - min;
}

function spanZ(outline: P2[]): number {
  let min = Infinity, max = -Infinity;
  for (const [, z] of outline) { if (z < min) min = z; if (z > max) max = z; }
  return max - min;
}
