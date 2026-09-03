// Facade layout: split-grammar bays per floor band and edge, entrance on the
// street face, aperture cuts reserved first, openings never overlapping.

import { Rng } from '../core/rng.ts';
import { RULES, DOORS, FACADE, OPENING, CURTAINS, CURTAINS_VISION, type CurtainDist, MODULE, MODULE_U, SLAB_BAND } from '../rules/tables.ts';
import { moduleWithin, onGrid, onModule } from './module.ts';
import {
  clearHeight, entranceHeight, fitStorefront, fitWindow, isStorefrontFloor, proportionsOf, type WindowFit,
} from '../rules/proportions.ts';
import { edgeLength, edgeDir, edgeNormal, ringInsidePolygon, quant, type P2 } from '../core/polygon.ts';
import { modulePanes } from './glazing.ts';
import { anchorSeat, type AnchorSeat } from './anchors.ts';
import type { Aperture, BuildingRequest, CurtainState, DoorAssembly, DoorSet, Opening } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Massing } from './massing.ts';
import type { Stack } from './floorStack.ts';
import type { CarvedAperture, FloorLayout, Style } from './model.ts';

// Sun azimuth quantized to 8 compass vectors: no runtime trig, identical output on every JS engine.
const COMPASS: P2[] = [
  [0, -1], [0.7071067811865476, -0.7071067811865476], [1, 0], [0.7071067811865476, 0.7071067811865476],
  [0, 1], [-0.7071067811865476, 0.7071067811865476], [-1, 0], [-0.7071067811865476, -0.7071067811865476],
];

interface Taken { start: number; end: number; anchor: boolean }

export interface FacadeResult {
  floors: FloorLayout[];
  carved: CarvedAperture[];
  anchors: AnchorSeat[];
}

export function buildFacades(
  req: BuildingRequest, family: Family, tier: Tier, style: Style,
  massing: Massing, stack: Stack, streetEdges: number[],
): FacadeResult {
  const streetEdge = streetEdges[0] as number;
  const seed = req.seed;
  const rules = RULES[family];
  const prop = proportionsOf(family);
  const noWindows = req.options?.windows === 'none';
  const balconiesOpt = req.options?.balconies ?? 'auto';
  const officeAuto = family === 'office' && (tier === 'rich' || tier === 'high_rich')
    && new Rng(seed, 'office-balconies').chance(0.45);
  const balconiesOn = rules.balconies && balconiesOpt !== 'off'
    && (balconiesOpt === 'on' || family === 'residential' || family === 'hotel' || officeAuto);
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
      take(takenByEdge, a.face, minU - OPENING.minPier, maxU + OPENING.minPier, a.kind === 'wire-anchor');
      if (a.kind === 'wire-anchor') {
        if (!apertureAnchored.has(a.id)) anchors.push(anchorSeat(a, outline, minU, maxU));
        apertureAnchored.add(a.id);
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
      const entrance = placeEntrance(req, family, tier, style, outline, streetEdges, level.height, openings, takenByEdge);
      if (entrance) placeRepeatedEntrances(family, outline, entrance, openings, takenByEdge);
      if (family === 'industrial') placeLoadingDoors(seed, req.theme, tier, outline, streetEdge, level.height, openings, takenByEdge);
    }

    // 3. Windows and balcony doors, sized by the proportion table and fitted
    // once to this floor's clear height: a storefront ground floor glazes from
    // its sill to the head band, a curtain wall glazes each face whole, a
    // megablock scatters small openings inside its panel grid, every other
    // style fills bays.
    const clear = clearHeight(level.height);
    const storefront = isGround && isStorefrontFloor(family, level.kind);
    const rawFit = storefront ? fitStorefront(style.storefrontSill, clear) : fitWindow(prop, style.windowFraction, style.sill, clear);
    // A storey the envelope kept off the module keeps proportional windows; a module storey takes module windows.
    const fit = onGrid(level.height) ? moduleFit(rawFit, clear, storefront) : rawFit;
    if (!noWindows && style.facade.kind === 'curtain-wall') {
      for (let e = 0; e < outline.length; e++) {
        const normal = edgeNormal(outline, e);
        const sunFacing = normal[0] * sun[0] + normal[1] * sun[1] > 0;
        placeCurtainWallBays(seed, req.theme, tier, style, outline, e, level, openings, takenByEdge,
          CURTAINS_VISION[sunFacing ? 'sunFacing' : 'shaded'], req.parcel.footprint,
          balconiesOn && family === 'office');
      }
    } else if (!noWindows && style.facade.kind === 'megablock') {
      for (let e = 0; e < outline.length; e++) {
        const normal = edgeNormal(outline, e);
        const sunFacing = normal[0] * sun[0] + normal[1] * sun[1] > 0;
        const dist = (CURTAINS[profile] as { sunFacing: CurtainDist; shaded: CurtainDist })[sunFacing ? 'sunFacing' : 'shaded'];
        const stacked = balconiesOn && !isGround && outline === massing.groundOutline;
        placeMegablockCells(seed, req.theme, tier, style, req.parcel.footprint, outline, e, level, openings, takenByEdge, dist, stacked,
          storefront ? fit : null);
      }
    } else if (!noWindows) {
      for (let e = 0; e < outline.length; e++) {
        const L = edgeLength(outline, e);
        const usable = L - 2 * OPENING.cornerMargin;
        if (usable < 0.9) continue;
        // Bays are whole modules wide; what does not divide stays at the far corner as pier.
        const perBay = Math.max(2, Math.round(style.bayModule / MODULE_U));
        const n = Math.max(1, Math.floor(usable / (perBay * MODULE_U)));
        const bayW = n * perBay * MODULE_U <= usable ? perBay * MODULE_U : onModule(usable / n, 'down', MODULE_U);
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
            // The balcony door rises to the window head, so the floor reads as one glazed line.
            const doorW = 2 * MODULE_U; // a balcony door is a double door
            const doorH = onModule(Math.min(clear, Math.max(2.05, fit ? fit.sill + fit.height : 0)), 'down');
            const doorStart = bayStart + onModule((bayW - doorW) / 2, 'down', MODULE_U);
            const balconyW = quant(Math.max(doorW + 0.4, Math.min(bayW - 0.4, style.balconyWidth)));
            if (fits(takenByEdge, e, doorStart, doorStart + doorW)
              && balconyFits(req.parcel.footprint, outline, e, doorStart, doorW, balconyW, style.balconyDepth)) {
              take(takenByEdge, e, doorStart, doorStart + doorW);
              openings.push({
                id: `bd:${level.index}:${e}:${b}`, kind: 'balconyDoor', edge: e,
                offset: quantOff(doorStart), width: doorW, height: doorH, sill: 0,
                leaves: leafCount(doorW), state: curtainState(seed, level.index, e, b, dist),
                door: doorAssembly('glazed-grid', doorW, doorH),
                balcony: { depth: style.balconyDepth, width: balconyW },
                material: `${req.theme}/door-glass/${tier}`,
              });
              continue;
            }
          }

          // Window bay: a storefront takes the bay whole, a punched window its
          // family width, rolled by the window-to-wall density.
          if (!fit) continue;
          // a window is whole metres wide, to the nearest, never wider than its bay leaves for a pier
          const w = Math.min(onModule(storefront ? bayW - OPENING.minPier : style.windowWidth, 'near', MODULE_U), bayW - OPENING.minPier);
          if (w < MODULE_U) continue;
          if (!storefront) {
            const p = Math.min(1, Math.max(0.05, (style.wwr * bayW * level.height) / (w * fit.height)));
            if (!new Rng(seed, `win:${level.index}:${e}:${b}`).chance(p)) continue;
          }
          // The window sits on the module grid inside its bay, the spare modules split to its sides.
          const start = bayStart + onModule((bayW - w) / 2, 'down', MODULE_U);
          if (!fits(takenByEdge, e, start, start + w)) continue;
          take(takenByEdge, e, start, start + w);
          const width = w;
          openings.push({
            id: `w:${level.index}:${e}:${b}`, kind: 'window', edge: e,
            offset: quantOff(start), width, height: fit.height, sill: fit.sill,
            state: curtainState(seed, level.index, e, b, dist),
            panes: modulePanes(width, fit.height, style.glazing),
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
 * The farthest point past `from` that keeps whole metres between them. A
 * curtain-wall run starts on its face's centred origin, so the end is left
 * unquantized: rounding it onto the 0.05 grid would widen one corner pier.
 */
function runEnd(from: number, to: number): number {
  return from + Math.floor((to - from) / MODULE_U + 1e-9) * MODULE_U;
}

/**
 * A window on the module grid: sill to the nearest module, height in whole
 * modules under the clear height; a storefront always reaches the clear height
 * from its sill. None when not even one module fits.
 */
function moduleFit(fit: WindowFit | null, clear: number, storefront: boolean): WindowFit | null {
  if (fit === null) return null;
  // a storefront sill only ever drops to the grid: it stays a low sill
  const sill = Math.max(0, onModule(fit.sill, storefront ? 'down' : 'near'));
  const height = storefront ? quant(clear - sill) : Math.min(onModule(fit.height, 'near'), onModule(clear - sill, 'down'));
  return height >= MODULE ? { height, sill } : null;
}



/** Swinging leaves: one per person-width of opening, four at the widest portal. */
function leafCount(width: number): number {
  return Math.min(4, Math.max(1, Math.ceil(width / DOORS.maxLeafWidth - 1e-9)));
}

/**
 * Megablock facade: the panel grid runs from the face origin in whole modules,
 * the same grid the wall material tiles on. Each cell rolls for a small window,
 * placed with a seeded jitter inside the cell so the field reads scattered
 * rather than a regular office lattice. A storefront ground floor glazes each
 * cell whole instead, rib to rib.
 */
function placeMegablockCells(
  seed: string, theme: string, tier: Tier, style: Style, parcel: P2[], outline: P2[], e: number,
  level: { index: number; elevation: number; height: number },
  openings: Opening[], taken: Map<number, Taken[]>, dist: CurtainDist, balconies: boolean,
  storefront: WindowFit | null,
): void {
  const L = edgeLength(outline, e);
  // cells are whole metres, ribs stand on their seams, and every window edge inside a cell is on the
  // metre grid; a window may start on the seam itself, where the rib then gives way
  const module = Math.max(2 * MODULE_U, onModule(style.facade.panelModule, 'near', MODULE_U));
  const inset = 0;
  const cells = Math.floor(L / module);
  const w = FACADE.megablockWindow.width;
  const h = FACADE.megablockWindow.height;

  for (let c = 0; c < cells; c++) {
    const start = c * module + inset;
    const end = (c + 1) * module - inset;
    if (start < OPENING.cornerMargin || end > L - OPENING.cornerMargin || end - start < w[0]) continue;

    if (storefront) {
      const width = quant(end - start);
      if (!fits(taken, e, start, start + width)) continue;
      take(taken, e, start, start + width);
      openings.push({
        id: `w:${level.index}:${e}:${c}`, kind: 'window', edge: e,
        offset: quantOff(start), width, height: storefront.height, sill: storefront.sill,
        state: curtainState(seed, level.index, e, c, dist),
        panes: modulePanes(width, storefront.height, style.glazing),
        material: `${theme}/window-glass/${tier}`,
      });
      continue;
    }

    // Balcony cells are chosen per stack, not per floor, so they line up vertically.
    if (balconies && new Rng(seed, `mega-balcony:${e}:${c}`).chance(0.35)) {
      const doorW = 2 * MODULE_U; // a balcony door is a double door
      const doorH = onModule(Math.min(2.05, level.height - 0.5), 'down');
      const doorStart = start + onModule((end - start - doorW) / 2, 'down', MODULE_U);
      const balconyW = quant(Math.max(doorW + 0.4, Math.min(module - 0.4, style.balconyWidth)));
      if (doorH >= 1.5 && fits(taken, e, doorStart, doorStart + doorW)
        && balconyFits(parcel, outline, e, doorStart, doorW, balconyW, style.balconyDepth)) {
        take(taken, e, doorStart, doorStart + doorW);
        openings.push({
          id: `bd:${level.index}:${e}:${c}`, kind: 'balconyDoor', edge: e,
          offset: quantOff(doorStart), width: doorW, height: doorH, sill: 0,
          leaves: leafCount(doorW), state: curtainState(seed, level.index, e, c, dist),
          door: doorAssembly('glazed-grid', doorW, doorH),
          balcony: { depth: style.balconyDepth, width: balconyW },
          material: `${theme}/door-glass/${tier}`,
        });
        continue;
      }
    }

    const rng = new Rng(seed, `mega:${level.index}:${e}:${c}`);
    if (!rng.chance(FACADE.megablockWindow.density)) continue;
    const width = Math.min(onModule(rng.range(...w), 'near', MODULE_U), onModule(end - start, 'down', MODULE_U));
    const height = onModule(Math.min(rng.range(...h), level.height - 1.0), 'near');
    if (width < MODULE_U || height < MODULE) continue;
    // the seeded scatter picks a whole-metre slot inside the cell and a half-metre sill
    const slots = Math.floor((end - start - width) / MODULE_U + 1e-9) + 1;
    const u = quantOff(start + Math.floor(rng.next() * slots) * MODULE_U);
    const minSill = onModule(FACADE.megablockWindow.minSill, 'near');
    const room = Math.max(0, level.height - height - minSill - MODULE);
    const sill = quant(minSill + Math.floor(rng.next() * (Math.floor(room / MODULE + 1e-9) + 1)) * MODULE);
    if (!fits(taken, e, u, u + width)) continue;
    take(taken, e, u, u + width);
    openings.push({
      id: `w:${level.index}:${e}:${c}`, kind: 'window', edge: e,
      offset: u, width, height, sill,
      state: curtainState(seed, level.index, e, c, dist),
      panes: modulePanes(width, height, style.glazing),
      material: `${theme}/window-glass/${tier}`,
    });
  }
}

/** The whole balcony slab stays inside the parcel, including concave edges. */
function balconyFits(
  parcel: P2[], outline: P2[], edge: number, offset: number,
  openingWidth: number, balconyWidth: number, depth: number,
): boolean {
  if (depth <= 0) return true;
  const at = outline[edge] as P2;
  const along = edgeDir(outline, edge);
  const outward = edgeNormal(outline, edge);
  const center = offset + openingWidth / 2;
  const u0 = center - balconyWidth / 2;
  const u1 = center + balconyWidth / 2;
  const p = (u: number, d: number): P2 => [
    at[0] + along[0] * u + outward[0] * d,
    at[1] + along[1] * u + outward[1] * d,
  ];
  return ringInsidePolygon(parcel, [p(u0, 0), p(u1, 0), p(u1, depth), p(u0, depth)]);
}

/**
 * Curtain wall: the face is glazed corner to corner in whatever strips the
 * entrance and the apertures leave free, each strip one bay running the full
 * floor height. An opaque band straddles every slab line, the spandrel over it
 * and the head band of the bay below under it; between them the bay is vision
 * glass on a mullion grid, so the glazing reads continuous from floor to floor
 * and the interior shows through without its slab showing with it.
 */
function placeCurtainWallBays(
  seed: string, theme: string, tier: Tier, style: Style, outline: P2[], e: number,
  level: { index: number; elevation: number; height: number },
  openings: Opening[], taken: Map<number, Taken[]>, dist: CurtainDist,
  parcel: P2[], officeBalconies: boolean,
): void {
  const cw = FACADE.curtainWall;
  const L = edgeLength(outline, e);
  // The opaque band straddles the slab line: `head` covers the slab of the floor
  // above from under it, `spandrel` the raised floor zone over the slab below.
  const band = Math.max(2 * MODULE, onModule(Math.min(style.facade.spandrelHeight, level.height * 0.35), 'near'));
  const head = SLAB_BAND.below;
  const spandrel = quant(band - head);
  // The bay spans its floor exactly: quantizing here would leave a wall sliver
  // under every slab and break the continuity a curtain wall reads by.
  const height = level.height;
  if (height - spandrel - head < 1.2) return;

  // A wire anchor mounts on the skin, so the glazing runs straight across it.
  const blocks = blockedSpans((taken.get(e) ?? []).filter((t) => !t.anchor), openings, e).sort((a, b) => a.start - b.start);
  // Equal piers at both corners: the metre that does not divide the face is
  // split between them, so two faces never meet on a wide band of bare wall.
  const usable = L - 2 * cw.cornerInset;
  const origin = cw.cornerInset + (usable - Math.floor(usable)) / 2;
  let u = origin;
  const bays: { start: number; end: number }[] = [];
  for (const b of blocks) {
    // a bay is whole metres of panes from its start; what does not divide widens the pier after it
    const stop = runEnd(u, Math.min(b.start - OPENING.minPier, L - origin));
    if (stop - u >= cw.minBay) bays.push({ start: u, end: stop });
    // The skin runs on over a door as that door's transom light, so the entrance
    // never punches a blank panel through the glass. It belongs to the door
    // opening: one opening owns one stretch of an edge.
    if (b.door) {
      const sill = b.door.sill + b.door.height + cw.transomGap;
      // Rounded down onto the grid, and stopping under the band that hides the
      // slab above, the way every bay on the face does.
      const room = height - SLAB_BAND.below - sill;
      if (room >= cw.minTransom) b.door.transom = Math.floor(room * 20 + 1e-9) / 20;
    }
    u = Math.max(u, b.end + OPENING.minPier);
  }
  const last = runEnd(u, L - origin);
  if (last - u >= cw.minBay) bays.push({ start: u, end: last });

  const balconyPhase = new Rng(seed, 'office-balcony-phase').int(0, 1);
  bays.forEach(({ start, end }, i) => {
    // never past the edge: the last bay's width rounds down
    const width = Math.floor((end - start) * 20 + 1e-9) / 20;
    if (width < cw.minBay) return;
    const state = curtainState(seed, level.index, e, i, dist);
    const doorWidth = 2 * MODULE_U;
    const doorStart = onModule(start + (width - doorWidth) / 2, 'near', MODULE_U);
    const balconyFloor = level.index > 0 && (level.index + balconyPhase) % 2 === 1;
    const carriesBalcony = officeBalconies && balconyFloor && width >= 4
      && doorStart >= start + MODULE / 2
      && doorStart + doorWidth <= start + width - MODULE / 2
      && new Rng(seed, `office-balcony:${level.index}:${e}:${i}`).chance(0.55)
      && balconyFits(parcel, outline, e, doorStart, doorWidth, style.balconyWidth, style.balconyDepth);

    const window = (id: string, offset: number, span: number): void => {
      if (span < MODULE - 1e-9) return;
      take(taken, e, offset, offset + span);
      openings.push({
        id, kind: 'window', edge: e, offset: quantOff(offset), width: quantOff(span),
        height, sill: 0, spandrel, head, state,
        panes: modulePanes(span, height - spandrel - head, style.glazing),
        material: `${theme}/window-glass/${tier}`,
      });
    };

    if (!carriesBalcony) {
      window(`w:${level.index}:${e}:${i}`, start, width);
      return;
    }

    window(`w:${level.index}:${e}:${i}:left`, start, doorStart - start);
    take(taken, e, doorStart, doorStart + doorWidth);
    const doorHeight = quantOff(height - head);
    openings.push({
      id: `bd:${level.index}:${e}:cw:${i}`, kind: 'balconyDoor', edge: e,
      offset: quantOff(doorStart), width: doorWidth, height: doorHeight, sill: 0,
      leaves: leafCount(doorWidth), state,
      door: doorAssembly('glazed-grid', doorWidth, doorHeight),
      balcony: { depth: style.balconyDepth, width: style.balconyWidth },
      material: `${theme}/door-glass/${tier}`,
    });
    window(`w:${level.index}:${e}:${i}:right`, doorStart + doorWidth,
      start + width - doorStart - doorWidth);
  });
}

/** Reserved u-ranges, with the door that reserved one when a door did. */
function blockedSpans(taken: Taken[], openings: Opening[], e: number): { start: number; end: number; door?: Opening }[] {
  return taken.map((t) => {
    let door: Opening | undefined;
    for (const o of openings) {
      if (o.edge !== e || (o.kind !== 'door' && o.kind !== 'balconyDoor')) continue;
      if (o.offset < t.end && o.offset + o.width > t.start) door = o;
    }
    return { start: t.start, end: t.end, ...(door ? { door } : {}) };
  });
}

function take(map: Map<number, Taken[]>, edge: number, start: number, end: number, anchor = false): void {
  const list = map.get(edge) ?? [];
  list.push({ start, end, anchor });
  map.set(edge, list);
}

function fits(map: Map<number, Taken[]>, edge: number, start: number, end: number): boolean {
  for (const t of map.get(edge) ?? []) {
    if (start < t.end + OPENING.minPier && end > t.start - OPENING.minPier) return false;
  }
  return true;
}

/**
 * The entrance: as tall as the family's row in the proportion table says
 * (residential lowest, venues and lobbies tall, corpo a double-height lobby
 * door), capped only by a ground floor too short to hold it, and at least the
 * standard width, grand on rich hotels, corpo and venues.
 */
function placeEntrance(
  req: BuildingRequest, family: Family, tier: Tier, style: Style,
  outline: P2[], candidates: number[], groundHeight: number,
  openings: Opening[], taken: Map<number, Taken[]>,
): Opening | undefined {
  const rng = new Rng(req.seed, 'entrance');
  const rules = RULES[family];
  const prop = proportionsOf(family);

  const grand = (family === 'corpo' || family === 'hotel' || family === 'commerce')
    && (tier === 'rich' || tier === 'high_rich');
  const wWant = quant(rng.range(...(grand ? DOORS.width.grand : DOORS.width.standard)));
  // whole modules tall, inside the family's range; a range too narrow for a module keeps the exact height
  const clear = clearHeight(groundHeight);
  const h = moduleWithin(entranceHeight(prop, style.entrancePick, clear), prop.entrance[0], Math.min(prop.entrance[1], clear));

  for (const e of candidates) {
    if (e >= outline.length) continue;
    const L = edgeLength(outline, e);
    // an entrance is whole metres wide and starts on a panel seam
    const w = onModule(Math.min(wWant, L - 2 * OPENING.cornerMargin), 'near', MODULE_U);
    if (w < 2 * MODULE_U) continue; // too small even for a narrow door, try the next edge
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
      const start = onModule(t - w / 2, 'near', MODULE_U);
      if (start < margin - 1e-9 || start + w > L - margin + 1e-9) continue;
      if (!fits(taken, e, start, start + w)) continue;
      take(taken, e, start, start + w);
      const entrance: Opening = {
        id: 'entrance', kind: 'door', doorRole: 'main', edge: e, offset: start,
        width: w, height: quant(h), sill: 0, leaves: leafCount(w),
        door: doorAssembly(entranceDoorSet(req.seed, family, tier, rules.entranceGlass), w, h),
        material: `${req.theme}/${rules.entranceGlass ? 'door-glass' : 'door'}/${tier}`,
      };
      openings.push(entrance);
      return entrance;
    }
  }
  // No edge can host a door (degenerate parcel): better no entrance than a broken one.
  return undefined;
}

/**
 * A long public frontage repeats the accepted main entrance at stable human
 * scale. Uniform frontage cells supply the target centres; the actual starts
 * stay on metre seams and retain a full pier from every other opening.
 */
function placeRepeatedEntrances(
  family: Family, outline: P2[], main: Opening,
  openings: Opening[], taken: Map<number, Taken[]>,
): void {
  if (!(['hotel', 'office', 'corpo', 'commerce'] as Family[]).includes(family)) return;
  const length = edgeLength(outline, main.edge);
  const usable = length - 2 * OPENING.cornerMargin;
  const total = Math.min(DOORS.repeatedFrontage.maxDoors,
    Math.floor(usable / DOORS.repeatedFrontage.minPitch));
  if (total < 2) return;

  const mainCenter = main.offset + main.width / 2;
  const targets = Array.from({ length: total }, (_, i) => ((i + 0.5) * length) / total)
    .sort((a, b) => Math.abs(b - mainCenter) - Math.abs(a - mainCenter));
  let placed = 0;
  for (const target of targets) {
    if (placed >= total - 1) break;
    const wanted = onModule(target - main.width / 2, 'near', MODULE_U);
    const maxSteps = Math.floor(length / (2 * MODULE_U));
    for (let step = 0; step <= maxSteps; step++) {
      const shift = step === 0 ? 0 : Math.ceil(step / 2) * (step % 2 === 1 ? MODULE_U : -MODULE_U);
      const start = wanted + shift;
      if (start < OPENING.cornerMargin - 1e-9
        || start + main.width > length - OPENING.cornerMargin + 1e-9) continue;
      if (!fits(taken, main.edge, start, start + main.width)) continue;
      take(taken, main.edge, start, start + main.width);
      openings.push({
        ...main,
        id: `entrance:secondary:${placed}`,
        doorRole: 'secondary',
        offset: start,
        door: { ...main.door!, motion: { ...main.door!.motion } },
      });
      placed++;
      break;
    }
  }
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
      id: `loading:${i}`, kind: 'door', doorRole: 'service', edge: e, offset: quantOff(t - w / 2),
      width: w, height: h, sill: 0, leaves: 1, material: `${theme}/door/${tier}`,
      door: doorAssembly('industrial-ribbed', w, h, 'roller'),
    });
  }
}

/** One coordinated door set per building role; dimensions always come from the accepted opening. */
function entranceDoorSet(seed: string, family: Family, tier: Tier, glazed: boolean): DoorSet {
  if (family === 'industrial' || family === 'security') return 'industrial-ribbed';
  if ((family === 'corpo' || family === 'hotel' || family === 'commerce')
    && (tier === 'rich' || tier === 'high_rich')) return 'illuminated';
  if (glazed && (tier === 'rich' || tier === 'high_rich')) return 'glazed-grid';
  return new Rng(seed, 'door-set').chance(0.55) ? 'layered' : 'plain';
}

function doorAssembly(
  set: DoorSet, width: number, height: number, motion: 'swing' | 'roller' = 'swing',
): DoorAssembly {
  const rule = DOORS.sets[set];
  const leaves = leafCount(width);
  const leafWidth = width / leaves;
  return {
    set,
    frameWidth: rule.frameWidth,
    frameDepth: rule.frameDepth,
    recessDepth: rule.recessDepth,
    thresholdHeight: 0,
    motion: motion === 'roller'
      ? { kind: 'roller', maxTravel: height, clearDepth: 0 }
      : { kind: 'swing', maxTravel: 90, clearDepth: quant(leafWidth) },
  };
}

function curtainState(seed: string, floor: number, edge: number, bay: number, dist: CurtainDist): CurtainState {
  // 2x2 clustering: neighbours share a draw, states arrive in soft patches.
  const rng = new Rng(seed, `curtain:${floor >> 1}:${edge}:${bay >> 1}`);
  return rng.pick(['open', 'half', 'closed80'] as CurtainState[], [dist.open, dist.half, dist.closed80]);
}
