// Facade layout: split-grammar bays per floor band and edge, entrance on the
// street face, aperture cuts reserved first, openings never overlapping.

import { Rng } from '../core/rng.ts';
import { RULES, DOORS, FACADE, OPENING, CURTAINS, type CurtainDist } from '../rules/tables.ts';
import { edgeLength, edgeDir, edgeNormal, quant, type P2 } from '../core/polygon.ts';
import { paneGrid } from './glazing.ts';
import type { Aperture, BuildingRequest, CurtainState, Opening } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Massing } from './massing.ts';
import type { Stack } from './floorStack.ts';
import type { CarvedAperture, FloorLayout, Style } from './model.ts';

// Sun azimuth quantized to 8 compass vectors: no runtime trig, identical output on every JS engine.
const COMPASS: P2[] = [
  [0, -1], [0.7071067811865476, -0.7071067811865476], [1, 0], [0.7071067811865476, 0.7071067811865476],
  [0, 1], [-0.7071067811865476, 0.7071067811865476], [-1, 0], [-0.7071067811865476, -0.7071067811865476],
];

interface Taken { start: number; end: number }

export interface FacadeResult {
  floors: FloorLayout[];
  carved: CarvedAperture[];
  anchors: { id: string; position: [number, number, number]; normal: P2 }[];
}

export function buildFacades(
  req: BuildingRequest, family: Family, tier: Tier, style: Style,
  massing: Massing, stack: Stack, streetEdges: number[],
): FacadeResult {
  const streetEdge = streetEdges[0] as number;
  const seed = req.seed;
  const rules = RULES[family];
  const noWindows = req.options?.windows === 'none';
  const balconiesOpt = req.options?.balconies ?? 'auto';
  const balconiesOn = rules.balconies && balconiesOpt !== 'off' && (balconiesOpt === 'on' || family === 'residential' || family === 'hotel');
  const profile = req.options?.curtains?.profile ?? 'day';
  const sun = COMPASS[Math.round(((req.options?.curtains?.sunAzimuthDeg ?? 180) % 360) / 45) % 8] as P2;

  const apertures = req.apertures ?? [];
  const carved: CarvedAperture[] = [];
  const anchors: FacadeResult['anchors'] = [];
  const floors: FloorLayout[] = [];
  const apertureAnchored = new Set<string>();

  // Balcony stacks: chosen once per edge on the ground outline, frozen for the whole building.
  const balconyStacks = new Map<number, Set<number>>();
  if (balconiesOn && style.balconyDepth >= 0) {
    const ground = massing.groundOutline;
    for (let e = 0; e < ground.length; e++) {
      const L = edgeLength(ground, e);
      const usable = L - 2 * OPENING.cornerMargin;
      if (usable < 2) continue;
      const n = Math.max(1, Math.round(usable / style.bayModule));
      const rng = new Rng(seed, `balcony-stacks:${e}`);
      const density = tier === 'poor' ? 0.35 : tier === 'mid' ? 0.5 : 0.65;
      const set = new Set<number>();
      for (let b = 0; b < n; b++) if (rng.chance(density)) set.add(b);
      if (set.size > 0) balconyStacks.set(e, set);
    }
  }

  // Resolve each aperture to its owning floor once.
  const apertureFloor = new Map<string, number>();
  for (const a of apertures) {
    if (a.kind === 'wire-anchor') continue;
    let best = stack.levels[0]!;
    for (const lv of stack.levels) {
      if (Math.abs(lv.elevation - a.base) < Math.abs(best.elevation - a.base)) best = lv;
    }
    apertureFloor.set(a.id, best.index);
  }

  for (const level of stack.levels) {
    const outline = massing.outlineOf(Math.max(0, level.index));
    const openings: Opening[] = [];
    const isGround = level.index === 0;
    const isBasement = level.index < 0;
    const takenByEdge = new Map<number, Taken[]>();
    const y0 = level.elevation;
    const y1 = level.elevation + level.height;

    // 1. Apertures first: they are constraints, everything else avoids them.
    for (const a of apertures) {
      if (a.face >= outline.length) continue;
      const top = a.base + a.height;
      if (top <= y0 + 1e-9 || a.base >= y1 - 1e-9) continue; // no vertical overlap with this band
      const [vx, vz] = outline[a.face] as P2;
      const d = edgeDir(outline, a.face);
      let minU = Infinity, maxU = -Infinity;
      for (const [px, , pz] of a.cut.polygon) {
        const u = (px - vx) * d[0] + (pz - vz) * d[1];
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
      }
      take(takenByEdge, a.face, minU - OPENING.minPier, maxU + OPENING.minPier);
      if (a.kind === 'wire-anchor') {
        if (apertureAnchored.has(a.id)) continue;
        apertureAnchored.add(a.id);
        const n = edgeNormal(outline, a.face);
        const uc = (minU + maxU) / 2;
        anchors.push({
          id: a.id,
          position: [vx + d[0] * uc, a.base + a.height / 2, vz + d[1] * uc],
          normal: n,
        });
        continue;
      }
      if (apertureFloor.get(a.id) === level.index) {
        openings.push({
          id: a.id, kind: 'aperture', edge: a.face, offset: quantOff(minU),
          width: a.width, height: a.height, sill: Math.max(0, a.base - level.elevation),
          apertureKind: a.kind, material: `${req.theme}/aperture-frame/${tier}`,
        });
        carved.push({ aperture: a, facePoly: a.cut.polygon.map(([px, py, pz]) => [(px - vx) * d[0] + (pz - vz) * d[1], py] as P2) });
      }
      // A cut crossing this band without owning it is already carved via the owning
      // floor's entry; the mesh clips it per band. Only the reservation matters here.
    }

    if (isBasement) { floors.push({ index: level.index, kind: level.kind, elevation: level.elevation, height: level.height, outline, openings }); continue; }

    // 2. Entrance and service doors on the ground floor (doors exist even window-less),
    // reserved before any window fill so the facade always keeps its entrance zone.
    if (isGround) {
      placeEntrance(req, family, tier, outline, streetEdges, level.height, openings, takenByEdge);
      if (family === 'industrial') placeLoadingDoors(seed, req.theme, tier, outline, streetEdge, level.height, openings, takenByEdge);
    }

    // 3. Windows and balcony doors: megablock scatters small openings inside the
    // panel grid, every other style fills bays.
    if (!noWindows && style.facade.kind === 'megablock') {
      for (let e = 0; e < outline.length; e++) {
        const normal = edgeNormal(outline, e);
        const sunFacing = normal[0] * sun[0] + normal[1] * sun[1] > 0;
        const dist = (CURTAINS[profile] as { sunFacing: CurtainDist; shaded: CurtainDist })[sunFacing ? 'sunFacing' : 'shaded'];
        const stacked = balconiesOn && !isGround && outline === massing.groundOutline;
        placeMegablockCells(seed, req.theme, tier, style, outline, e, level, openings, takenByEdge, dist, stacked);
      }
    } else if (!noWindows) {
      for (let e = 0; e < outline.length; e++) {
        const L = edgeLength(outline, e);
        const usable = L - 2 * OPENING.cornerMargin;
        if (usable < 0.9) continue;
        const n = Math.max(1, Math.round(usable / style.bayModule));
        const bayW = usable / n;
        const onGroundOutline = outline === massing.groundOutline;
        const stacks = onGroundOutline ? balconyStacks.get(e) : undefined;
        const normal = edgeNormal(outline, e);
        const sunFacing = normal[0] * sun[0] + normal[1] * sun[1] > 0;
        const dist = (CURTAINS[profile] as { sunFacing: CurtainDist; shaded: CurtainDist })[sunFacing ? 'sunFacing' : 'shaded'];

        for (let b = 0; b < n; b++) {
          const bayStart = OPENING.cornerMargin + b * bayW;
          const bayCenter = bayStart + bayW / 2;
          const isBalcony = !isGround && stacks?.has(b) === true;

          if (isBalcony) {
            const doorW = 0.95;
            const doorH = Math.min(2.05, level.height - 0.5);
            if (!fits(takenByEdge, e, bayCenter - doorW / 2, bayCenter + doorW / 2)) continue;
            const balconyW = quant(Math.max(doorW + 0.4, Math.min(bayW - 0.4, style.balconyWidth)));
            take(takenByEdge, e, bayCenter - doorW / 2, bayCenter + doorW / 2);
            openings.push({
              id: `bd:${level.index}:${e}:${b}`, kind: 'balconyDoor', edge: e,
              offset: quantOff(bayCenter - doorW / 2), width: doorW, height: quant(doorH), sill: 0,
              state: curtainState(seed, level.index, e, b, dist),
              balcony: { depth: style.balconyDepth, width: balconyW },
              material: `${req.theme}/door-glass/${tier}`,
            });
            continue;
          }

          // Window bay. Curtain-wall styles glaze every bay wide; punched windows roll density.
          let w: number, h: number, sill: number, always: boolean;
          if (style.curtainWall && !isGround) {
            w = quant(Math.max(0.6, bayW - 0.15));
            h = quant(Math.max(1.2, level.height - 0.45));
            sill = 0.25;
            always = true;
          } else {
            w = Math.min(style.windowWidth, bayW - OPENING.minPier);
            h = Math.min(style.windowHeight, level.height - 0.6);
            sill = isGround && family === 'commerce' ? 0.35 : style.sill;
            if (sill + h > level.height - 0.2) h = quant(level.height - 0.2 - sill);
            always = false;
          }
          if (w < 0.4 || h < 0.5) continue;
          const p = always ? 1 : Math.min(1, Math.max(0.05, (style.wwr * bayW * level.height) / (w * h)));
          const rng = new Rng(seed, `win:${level.index}:${e}:${b}`);
          if (!rng.chance(p)) continue;
          if (!fits(takenByEdge, e, bayCenter - w / 2, bayCenter + w / 2)) continue;
          take(takenByEdge, e, bayCenter - w / 2, bayCenter + w / 2);
          const width = quant(w), height = quant(h);
          openings.push({
            id: `w:${level.index}:${e}:${b}`, kind: 'window', edge: e,
            offset: quantOff(bayCenter - w / 2), width, height, sill: quant(sill),
            state: curtainState(seed, level.index, e, b, dist),
            panes: paneGrid(width, height, style.glazing),
            material: `${req.theme}/window-glass/${tier}`,
          });
        }
      }
    }

    floors.push({ index: level.index, kind: level.kind, elevation: level.elevation, height: level.height, outline, openings });
  }

  return { floors, carved, anchors };
}

function quantOff(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Megablock facade: the panel grid runs from the face origin in whole modules,
 * the same grid the wall material tiles on. Each cell rolls for a small window,
 * placed with a seeded jitter inside the cell so the field reads scattered
 * rather than a regular office lattice.
 */
function placeMegablockCells(
  seed: string, theme: string, tier: Tier, style: Style, outline: P2[], e: number,
  level: { index: number; elevation: number; height: number },
  openings: Opening[], taken: Map<number, Taken[]>, dist: CurtainDist, balconies: boolean,
): void {
  const L = edgeLength(outline, e);
  const module = style.facade.panelModule;
  const inset = style.facade.ribWidth / 2 + 0.2;
  const cells = Math.floor(L / module);
  const w = FACADE.megablockWindow.width;
  const h = FACADE.megablockWindow.height;

  for (let c = 0; c < cells; c++) {
    const start = c * module + inset;
    const end = (c + 1) * module - inset;
    if (start < OPENING.cornerMargin || end > L - OPENING.cornerMargin || end - start < w[0]) continue;

    // Balcony cells are chosen per stack, not per floor, so they line up vertically.
    if (balconies && new Rng(seed, `mega-balcony:${e}:${c}`).chance(0.35)) {
      const doorW = 0.95;
      const doorH = quant(Math.min(2.05, level.height - 0.5));
      const uc = (start + end) / 2;
      if (doorH >= 1.8 && fits(taken, e, uc - doorW / 2, uc + doorW / 2)) {
        take(taken, e, uc - doorW / 2, uc + doorW / 2);
        openings.push({
          id: `bd:${level.index}:${e}:${c}`, kind: 'balconyDoor', edge: e,
          offset: quantOff(uc - doorW / 2), width: doorW, height: doorH, sill: 0,
          state: curtainState(seed, level.index, e, c, dist),
          balcony: { depth: style.balconyDepth, width: quant(Math.max(doorW + 0.4, Math.min(module - 0.4, style.balconyWidth))) },
          material: `${theme}/door-glass/${tier}`,
        });
        continue;
      }
    }

    const rng = new Rng(seed, `mega:${level.index}:${e}:${c}`);
    if (!rng.chance(FACADE.megablockWindow.density)) continue;
    const width = quant(Math.min(rng.range(...w), end - start));
    const height = quant(Math.min(rng.range(...h), level.height - 1.1));
    if (width < 0.4 || height < 0.4) continue;
    const u = quantOff(start + rng.next() * (end - start - width));
    const sill = quant(0.8 + rng.next() * Math.max(0, level.height - height - 1.4));
    if (!fits(taken, e, u, u + width)) continue;
    take(taken, e, u, u + width);
    openings.push({
      id: `w:${level.index}:${e}:${c}`, kind: 'window', edge: e,
      offset: u, width, height, sill,
      state: curtainState(seed, level.index, e, c, dist),
      panes: paneGrid(width, height, style.glazing),
      material: `${theme}/window-glass/${tier}`,
    });
  }
}

function take(map: Map<number, Taken[]>, edge: number, start: number, end: number): void {
  const list = map.get(edge) ?? [];
  list.push({ start, end });
  map.set(edge, list);
}

function fits(map: Map<number, Taken[]>, edge: number, start: number, end: number): boolean {
  for (const t of map.get(edge) ?? []) {
    if (start < t.end + OPENING.minPier && end > t.start - OPENING.minPier) return false;
  }
  return true;
}

function placeEntrance(
  req: BuildingRequest, family: Family, tier: Tier,
  outline: P2[], candidates: number[], groundHeight: number,
  openings: Opening[], taken: Map<number, Taken[]>,
): void {
  const rng = new Rng(req.seed, 'entrance');
  const rules = RULES[family];

  let wWant: number, h: number;
  const grand = (family === 'corpo' || family === 'hotel') && (tier === 'rich' || tier === 'high_rich');
  if (grand) {
    wWant = quant(rng.range(...DOORS.grandPortal.width));
    h = quant(rng.range(...DOORS.grandPortal.height));
  } else if (family === 'residential' && tier === 'poor') {
    wWant = DOORS.single.width; h = DOORS.single.height;
  } else {
    wWant = DOORS.double.width; h = DOORS.double.height;
  }
  h = Math.min(h, groundHeight - 0.3);

  for (const e of candidates) {
    if (e >= outline.length) continue;
    const L = edgeLength(outline, e);
    const w = Math.min(wWant, L - 0.3);
    if (w < 0.6) continue; // too small even for a narrow door, try the next edge
    const margin = Math.min(OPENING.cornerMargin, (L - w) / 2);
    const tMin = margin + w / 2;
    const tMax = L - margin - w / 2;

    // Preferred position: the access point projected onto the edge; scan outward from it.
    const [vx, vz] = outline[e] as P2;
    const d = edgeDir(outline, e);
    const [ax, az] = req.parcel.accessPoint;
    const t0 = Math.min(Math.max((ax - vx) * d[0] + (az - vz) * d[1], tMin), tMax);
    for (let step = 0; step * 0.5 <= L; step++) {
      const t = step % 2 === 0 ? t0 + (step / 2) * 0.5 : t0 - ((step + 1) / 2) * 0.5;
      if (t < tMin - 1e-9 || t > tMax + 1e-9) continue;
      if (!fits(taken, e, t - w / 2, t + w / 2)) continue;
      take(taken, e, t - w / 2, t + w / 2);
      openings.push({
        id: 'entrance', kind: 'door', edge: e, offset: quantOff(t - w / 2),
        width: quant(w), height: quant(h), sill: 0,
        material: `${req.theme}/${rules.entranceGlass ? 'door-glass' : 'door'}/${tier}`,
      });
      return;
    }
  }
  // No edge can host a door (degenerate parcel): better no entrance than a broken one.
}

function placeLoadingDoors(
  seed: string, theme: string, tier: Tier,
  outline: P2[], streetEdge: number, groundHeight: number,
  openings: Opening[], taken: Map<number, Taken[]>,
): void {
  const rng = new Rng(seed, 'loading');
  // Longest edge that is not the street edge.
  let e = -1, len = 0;
  for (let i = 0; i < outline.length; i++) {
    if (i === streetEdge) continue;
    const L = edgeLength(outline, i);
    if (L > len) { len = L; e = i; }
  }
  if (e < 0 || len < 8) return;
  const w = quant(rng.range(...DOORS.rollerDrive.width));
  const h = quant(Math.min(rng.range(...DOORS.rollerDrive.height), groundHeight - 0.4));
  const count = len > 20 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const t = (len * (i + 1)) / (count + 1);
    if (!fits(taken, e, t - w / 2, t + w / 2)) continue;
    take(taken, e, t - w / 2, t + w / 2);
    openings.push({
      id: `loading:${i}`, kind: 'door', edge: e, offset: quantOff(t - w / 2),
      width: w, height: h, sill: 0, material: `${theme}/door/${tier}`,
    });
  }
}

function curtainState(seed: string, floor: number, edge: number, bay: number, dist: CurtainDist): CurtainState {
  // 2x2 clustering: neighbours share a draw, states arrive in soft patches.
  const rng = new Rng(seed, `curtain:${floor >> 1}:${edge}:${bay >> 1}`);
  return rng.pick(['open', 'half', 'closed80'] as CurtainState[], [dist.open, dist.half, dist.closed80]);
}
