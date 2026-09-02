// Facade and roof features: signage, ad screens, lights, fire escape, roof artifacts.

import { readFileSync } from 'node:fs';
import { ExteriorError } from '../core/errors.ts';
import { cellCentre } from './module.ts';
import { Rng } from '../core/rng.ts';
import { SIGNAGE, AD_SCREEN, FACADE, LIGHTING, FIRE_ESCAPE, ROOF_ACCESS, ROOF_ARTIFACTS, OPENING, MODULE, MODULE_U } from '../rules/tables.ts';
import { edgeLength, edgeDir, edgeNormal, pointInPolygon, centroid, quant, type P2 } from '../core/polygon.ts';
import { crossed, edgeU, findClearRect, type Rect } from './obstructions.ts';
import { placeAcUnits } from './acUnits.ts';
import { coreAxis } from './plate.ts';
import type { Blueprint, BuildingRequest, P3, RoofArtifact, Signage } from '../types.ts';
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
  massing: Massing, top: number, floors: FloorLayout[], faces: number[],
  obstacles: Map<number, Rect[]>,
): Features {
  const streetEdge = faces[0] as number;
  const ground = massing.groundOutline;
  const groundFloor = floors.find((f) => f.index === 0)!;
  const signage: Blueprint['signage'] = [];
  const screens: Blueprint['screens'] = [];
  const lights: Blueprint['lights'] = [];

  // Fixtures first: they are facade obstacles like ribs and anchors, so the
  // sign and screen scans land clear of them and the overlay invariant proves it.
  placeLights(req, family, ground, streetEdge, groundFloor, lights, obstacles);
  const acUnits = placeAcUnits(req, family, tier, floors, obstacles);
  placeSignage(req, family, ground, faces, groundFloor, top, signage, obstacles);
  placeScreens(req, family, tier, ground, faces, groundFloor.height, top, signage, screens, obstacles);
  const facadeArtifacts = [
    ...acUnits,
    ...placeFacadeArtifacts(req, style, floors, signage, screens, obstacles),
  ];
  const fireEscape = placeFireEscape(req, family, tier, massing, floors, streetEdge);
  const roof = buildRoof(req, family, massing, top, style, floors);

  return { signage, screens, lights, facadeArtifacts, fireEscape, roof };
}

/** The rectangle a placed sign or screen occupies on its face. */
function placedRect(outline: P2[], edge: number, center: P3, width: number, height: number): Rect {
  const u = edgeU(outline, edge, center[0], center[2]);
  return {
    u0: u - width / 2, u1: u + width / 2, y0: center[1] - height / 2, y1: center[1] + height / 2,
    what: 'sign', kind: 'relief', depth: 0,
  };
}

/**
 * Surface-mounted utility boxes: one roll per panel cell of each above-ground
 * floor, landing only on bare wall. Dense on the megablock tier, sparse on the
 * panel tier, absent on glass.
 */
function placeFacadeArtifacts(
  req: BuildingRequest, style: Style, floors: FloorLayout[],
  signage: Blueprint['signage'], screens: Blueprint['screens'], obstacles: Map<number, Rect[]>,
): Blueprint['facadeArtifacts'] {
  const out: Blueprint['facadeArtifacts'] = [];
  if (style.facade.utilityChance <= 0) return out;
  const ground = floors.find((f) => f.index === 0)!.outline;
  const overlays: Rect[] = [
    ...signage.map((s) => placedRect(ground, s.edge, s.center, s.width, s.height)),
    ...screens.map((s) => placedRect(ground, s.edge, s.center, s.width, s.height)),
  ];
  const module = style.facade.panelModule;
  const box = FACADE.utilityBox;

  for (const floor of floors) {
    if (floor.index < 1) continue; // the ground floor belongs to the street
    for (let e = 0; e < floor.outline.length; e++) {
      const L = edgeLength(floor.outline, e);
      const rects = obstacles.get(e);
      for (let c = 0; c < Math.floor(L / module); c++) {
        const rng = new Rng(req.seed, `utility:${floor.index}:${e}:${c}`);
        if (!rng.chance(style.facade.utilityChance)) continue;
        const w = quant(rng.range(...box.width));
        const h = quant(rng.range(...box.height));
        const d = quant(rng.range(...box.depth));
        const offset = quant(c * module + 0.2 + rng.next() * Math.max(0, module - 0.4 - w));
        const sill = quant(0.6 + rng.next() * Math.max(0, floor.height - h - 1.2));
        if (offset + w > L - 0.2) continue;
        const y = floor.elevation + sill;
        // Bare wall only: a box never sits on an opening, a rib, a column or a band.
        const seat: Rect = { u0: offset, u1: offset + w, y0: y, y1: y + h, what: 'utility box', kind: 'relief', depth: 0 };
        if (crossed(rects, seat, 0.15).length > 0) continue;
        const onSign = overlays.some((r) => offset + w > r.u0 - 0.15 && offset < r.u1 + 0.15 && y + h > r.y0 - 0.15 && y < r.y1 + 0.15);
        if (onSign) continue;
        out.push({ kind: 'utility-box', floor: floor.index, edge: e, offset, sill, size: [w, h, d] });
      }
    }
  }
  return out;
}

function facePoint(outline: P2[], edge: number, u: number, y: number): P3 {
  const [vx, vz] = outline[edge] as P2;
  const d = edgeDir(outline, edge);
  return [vx + d[0] * u, y, vz + d[1] * u];
}

/**
 * Modular signage: the text takes one cell per letter and runs either as a
 * marquee band over the entrance or as a blade sign protruding edge-on from the
 * facade. Orientation is decided by what fits, then by building family and the
 * facade's own proportions, so the same building always gets the same sign.
 * Where it lands is a scan for clear wall: never on a column, a rib, a floor
 * band or an opening, shrinking and moving until it is clear or giving up.
 */
function placeSignage(
  req: BuildingRequest, family: Family, ground: P2[], faces: number[],
  groundFloor: FloorLayout, top: number,
  out: Blueprint['signage'], obstacles: Map<number, Rect[]>,
): void {
  const spec = req.options?.signage;
  if (!spec) return;
  const street = faces[0] as number;
  if (spec.mode === 'marquee') capacityCheck(spec.text, ground, street, groundFloor.height, top);
  // The street face first; when nothing clear fits there the sign relocates to
  // the next face the entrance ranking prefers.
  for (const face of faces) {
    if (signOnFace(req, spec, family, ground, face, groundFloor, top, out, obstacles)) return;
  }
}

/** A text longer than the street facade holds either way round is a request error. */
function capacityCheck(text: string, ground: P2[], e: number, groundHeight: number, top: number): void {
  const L = edgeLength(ground, e);
  const bandWidthLimit = (L - 2 * OPENING.cornerMargin) * 0.9;
  const bladeRoom = Math.max(0, top - 0.8 - (groundHeight + 0.6));
  const horizontalMax = Math.floor(bandWidthLimit / SIGNAGE.minCellSize);
  const verticalMax = Math.floor((bladeRoom - 2 * SIGNAGE.framePad) / SIGNAGE.minCellSize);
  if (text.length > Math.max(horizontalMax, verticalMax)) {
    throw new ExteriorError('E_SIGNAGE_TEXT_TOO_LONG',
      `"${text}" is ${text.length} letter cells; this facade holds ${horizontalMax} across or ${verticalMax} stacked`);
  }
}

function signOnFace(
  req: BuildingRequest, spec: NonNullable<Signage>, family: Family, ground: P2[], e: number,
  groundFloor: FloorLayout, top: number,
  out: Blueprint['signage'], obstacles: Map<number, Rect[]>,
): boolean {
  const L = edgeLength(ground, e);
  const usable = L - 2 * OPENING.cornerMargin;
  const normal = edgeNormal(ground, e);
  const rng = new Rng(req.seed, 'signage');
  const rects = obstacles.get(e);
  const groundHeight = groundFloor.height;
  // Over the entrance when there is one on this face: that is where a marquee belongs.
  const door = groundFloor.openings.find((o) => o.kind === 'door' && o.edge === e);
  const doorU = door ? door.offset + door.width / 2 : L / 2;
  const doorHead = door ? door.sill + door.height : 0;

  if (spec.mode === 'marquee') {
    const cells = spec.text.length;
    const bandWidthLimit = usable * 0.9;
    // A blade hangs from just above the entrance to just under the parapet.
    const bladeBottom = groundHeight + 0.6;
    const bladeRoom = Math.max(0, top - 0.8 - bladeBottom);
    let cell = quant(rng.range(...SIGNAGE.cellSize));
    const fitsWide = (c: number) => cells * c <= bandWidthLimit;
    const fitsTall = (c: number) => cells * c + 2 * SIGNAGE.framePad <= bladeRoom;
    const vertical = chooseVertical(rng, family, L, top, cells, cell, fitsWide, fitsTall);
    while (cell > SIGNAGE.minCellSize && !(vertical ? fitsTall(cell) : fitsWide(cell))) cell = quant(cell - 0.05);

    if (vertical) {
      const height = quant(cells * cell + 2 * SIGNAGE.framePad);
      const depth = quant(rng.range(...SIGNAGE.bladeDepth));
      // A blade only touches the wall on a thin strip, so that strip is what has to be clear.
      const spot = findClearRect(rects, {
        width: SIGNAGE.bladeThickness, height, u: L * 0.22, y: bladeBottom + height / 2,
        uMin: SIGNAGE.edgeMargin, uMax: L - SIGNAGE.edgeMargin,
        yMin: bladeBottom, yMax: Math.max(bladeBottom + height, top - 0.8),
        margin: SIGNAGE.clearance, minScale: 0.6,
      });
      if (!spot) return false;
      const cellSize = quant(Math.min(cell, (spot.height - 2 * SIGNAGE.framePad) / cells));
      out.push({
        mode: 'marquee', orientation: 'vertical', text: spec.text, edge: e,
        cellSize, letterHeight: quant(cellSize * SIGNAGE.glyphFill),
        center: facePoint(ground, e, quant(spot.u), quant(spot.y)),
        width: SIGNAGE.bladeThickness, height: quant(cells * cellSize + 2 * SIGNAGE.framePad),
        standoff: quant(spot.standoff), depth: quant(spot.standoff + depth), normal,
      });
      return true;
    }

    const wantWidth = cells * cell;
    const wantHeight = cell + 2 * SIGNAGE.framePad;
    const yWanted = doorHead > 0 ? doorHead + 0.35 + wantHeight / 2 : groundHeight * 0.75;
    const spot = findClearRect(rects, {
      width: wantWidth, height: wantHeight, u: doorU, y: yWanted,
      uMin: SIGNAGE.edgeMargin, uMax: L - SIGNAGE.edgeMargin,
      yMin: SIGNAGE.minMarqueeSill, yMax: Math.max(SIGNAGE.minMarqueeSill + wantHeight, Math.min(top - 0.5, groundHeight + 4)),
      margin: SIGNAGE.clearance, minScale: SIGNAGE.minCellSize / cell,
    });
    if (!spot) return false;
    const cellSize = quant(Math.max(SIGNAGE.minCellSize, spot.width / cells));
    out.push({
      mode: 'marquee', orientation: 'horizontal', text: spec.text, edge: e,
      cellSize, letterHeight: quant(cellSize * SIGNAGE.glyphFill),
      center: facePoint(ground, e, quant(spot.u), quant(spot.y)),
      width: quant(cells * cellSize), height: quant(cellSize + 2 * SIGNAGE.framePad),
      standoff: quant(spot.standoff), depth: quant(spot.standoff + SIGNAGE.marqueeProud), normal,
    });
    return true;
  }

  const ratio = SIGNAGE.logoRatios[spec.ratio] as number;
  const width = quant(Math.min(Math.max(L * 0.3, 1.5), 8));
  const height = quant(width / ratio);
  const tall = top > groundHeight * 4;
  const spot = findClearRect(rects, {
    width, height, u: L / 2, y: tall ? top - 2 - height / 2 : groundHeight + 0.3 + height / 2,
    uMin: SIGNAGE.edgeMargin, uMax: L - SIGNAGE.edgeMargin,
    yMin: Math.max(groundHeight * 0.5, height / 2), yMax: top - height / 2,
    margin: SIGNAGE.clearance, minScale: 0.6,
  });
  if (!spot) return false;
  out.push({
    mode: 'logo', ratio: spec.ratio, edge: e,
    center: facePoint(ground, e, quant(spot.u), quant(spot.y)),
    width: quant(spot.width), height: quant(spot.height),
    standoff: quant(spot.standoff), depth: quant(spot.standoff + SIGNAGE.marqueeProud), normal,
  });
  return true;
}

/**
 * Blade or marquee. Whatever only fits one way goes that way; when both fit, a
 * street-front family on a facade no wider than it is tall hangs a blade, the
 * way the reference hotel sign does.
 */
function chooseVertical(
  rng: Rng, family: Family, faceLength: number, top: number, cells: number, cell: number,
  fitsWide: (c: number) => boolean, fitsTall: (c: number) => boolean,
): boolean {
  const min = SIGNAGE.minCellSize;
  if (!fitsWide(min)) return true;
  if (!fitsTall(min)) return false;
  if (!SIGNAGE.bladeFamilies.includes(family)) return false;
  const slender = faceLength < top * 1.2;
  if (slender && fitsTall(cell)) return true;
  return cells >= 6 && fitsTall(cell) && rng.chance(0.5);
}

function placeScreens(
  req: BuildingRequest, family: Family, tier: Tier, ground: P2[], faces: number[],
  groundHeight: number, top: number, signage: Blueprint['signage'],
  out: Blueprint['screens'], obstacles: Map<number, Rect[]>,
): void {
  const streetEdge = faces[0] as number;
  const opt = req.options?.adScreens ?? 'auto';
  if (opt === 'off') return;
  const floorsTall = top / 3.5;
  const eligible = AD_SCREEN.families.includes(family) && AD_SCREEN.tiers.includes(tier) && floorsTall >= 6;
  const rng = new Rng(req.seed, 'ad-screen');
  if (opt === 'auto' && (!eligible || !rng.chance(0.5))) return;

  // Street facade unless signage sits there; then the longest other face, then
  // any face with clear wall for it.
  const preferred: number[] = [];
  if (signage.length === 0) preferred.push(streetEdge);
  const others = ground.map((_, i) => i).filter((i) => i !== streetEdge)
    .sort((a, b) => edgeLength(ground, b) - edgeLength(ground, a));
  preferred.push(...others, streetEdge);
  const ratio = rng.pick(AD_SCREEN.ratios);
  const fraction = rng.range(...AD_SCREEN.widthFraction);

  for (const e of preferred) {
    const L = edgeLength(ground, e);
    const width = quant(Math.min(L - 2, L * fraction));
    if (width < AD_SCREEN.minWidth) continue;
    const height = quant(width / ratio);
    const rects = [...(obstacles.get(e) ?? [])];
    for (const s of signage) if (s.edge === e) rects.push(placedRect(ground, e, s.center, s.width, s.height));

    const spot = findClearRect(rects, {
      width, height, u: L / 2, y: Math.max(top * 0.55, groundHeight + 2 + height / 2),
      uMin: 1, uMax: L - 1,
      yMin: groundHeight + height / 2, yMax: top - 1 - height / 2,
      margin: AD_SCREEN.clearance, minScale: AD_SCREEN.minWidth / width,
    });
    if (!spot) continue;
    out.push({
      edge: e, center: facePoint(ground, e, quant(spot.u), quant(spot.y)),
      width: quant(spot.width), height: quant(spot.height),
      standoff: quant(spot.standoff), normal: edgeNormal(ground, e),
    });
    return;
  }
}

/** The fixture box the mesher builds (0.16 wide, 0.28 tall) plus the clearance a plate keeps from it. */
const FIXTURE = { width: 0.16, height: 0.28, clearance: 0.05 };

function placeLights(
  req: BuildingRequest, family: Family, ground: P2[], streetEdge: number,
  groundFloor: FloorLayout, out: Blueprint['lights'], obstacles: Map<number, Rect[]>,
): void {
  // Entrance fixtures flank every ground door, and each one takes its place on
  // the face's obstacle map before any sign or screen is scanned in.
  for (const o of groundFloor.openings) {
    if (o.kind !== 'door') continue;
    const normal = edgeNormal(ground, o.edge);
    const y = cellCentre(Math.min(o.height + 0.4, groundFloor.height - 0.2), MODULE);
    // one lantern in the centre of the panel either side of the door, on the panel row over its head
    for (const u of [o.offset - MODULE_U / 2, o.offset + o.width + MODULE_U / 2]) {
      out.push({ kind: 'entrance', position: facePoint(ground, o.edge, u, y), normal });
      const list = obstacles.get(o.edge) ?? [];
      list.push({
        u0: u - FIXTURE.width / 2 - FIXTURE.clearance, u1: u + FIXTURE.width / 2 + FIXTURE.clearance,
        y0: y - FIXTURE.height / 2 - FIXTURE.clearance, y1: y + FIXTURE.height / 2 + FIXTURE.clearance,
        what: 'entrance fixture', kind: 'relief', depth: 0.16,
      });
      obstacles.set(o.edge, list);
    }
  }
  if (!LIGHTING.accentFamilies.includes(family)) return;

  // Accent fixtures on clear wall along the street edge, one per bay-ish spacing.
  const rng = new Rng(req.seed, 'lights');
  const e = streetEdge;
  const L = edgeLength(ground, e);
  const spacing = rng.range(...LIGHTING.accentSpacing);
  const y = cellCentre(groundFloor.height * 0.8, MODULE);
  const openingsOnEdge = groundFloor.openings.filter((o) => o.edge === e);
  for (let u = OPENING.cornerMargin + spacing / 2; u < L - OPENING.cornerMargin; u += spacing) {
    const overOpening = openingsOnEdge.some((o) => u > o.offset - 0.3 && u < o.offset + o.width + 0.3 && y > o.sill && y < o.sill + o.height + 0.5);
    if (overOpening) continue;
    out.push({ kind: 'accent', position: facePoint(ground, e, cellCentre(u, MODULE_U), y), normal: edgeNormal(ground, e) });
  }
}

function placeFireEscape(
  req: BuildingRequest, family: Family, tier: Tier, massing: Massing,
  floors: FloorLayout[], streetEdge: number,
): Blueprint['fireEscape'] {
  const want = req.options?.fireEscape ?? 'auto';
  if (want === false || want === 'off') return null;
  const above = floors.filter((f) => f.index >= 0);
  if (above.length < 2 || above.length > FIRE_ESCAPE.maxFloors) return null;
  if (!FIRE_ESCAPE.allowedFamilies.includes(family) || !FIRE_ESCAPE.allowedTiers.includes(tier)) return null;
  // Constant outline only (no setbacks): every floor must share the ground ring.
  if (above.some((f) => f.outline !== massing.groundOutline)) return null;
  // On `auto` only a seeded few of the eligible buildings wear one.
  if (want === 'auto' && !new Rng(req.seed, 'fire-escape').chance(FIRE_ESCAPE.chance[tier] ?? 0)) return null;

  const ground = massing.groundOutline;
  let e = -1, len = 0;
  for (let i = 0; i < ground.length; i++) {
    if (i === streetEdge) continue;
    const L = edgeLength(ground, i);
    if (L > len) { len = L; e = i; }
  }
  if (e < 0 || len < FIRE_ESCAPE.platformLength + 1) return null;

  const seat = servingSeat(above, e, len);
  if (!seat) return null;
  return { edge: e, fromFloor: 1, toFloor: seat.toFloor, offset: seat.u, width: FIRE_ESCAPE.platformLength };
}

/**
 * Where the stack of platforms stands on the face, and how far up it runs: the
 * module line whose platforms step out of a real opening on every floor they
 * pass, windows before balcony doors (a balcony carries its own rail). A run
 * stops at the first floor it could not serve, and a face that serves no two
 * floors in a row carries no escape at all.
 */
function servingSeat(above: FloorLayout[], edge: number, len: number): { u: number; toFloor: number } | null {
  const w = FIRE_ESCAPE.platformLength;
  const middle = (len - w) / 2;
  const serves = (floor: FloorLayout, u: number): number => {
    let best = 0;
    for (const o of floor.openings) {
      if (o.edge !== edge || (o.kind !== 'window' && o.kind !== 'balconyDoor')) continue;
      if (Math.min(o.offset + o.width, u + w) - Math.max(o.offset, u) < FIRE_ESCAPE.minServed) continue;
      best = Math.max(best, o.kind === 'window' ? 2 : 1);
    }
    return best;
  };

  let best: { u: number; toFloor: number; score: number } | null = null;
  for (let u = MODULE_U; u <= len - w - MODULE_U + 1e-9; u = quant(u + MODULE_U)) {
    let score = 0, top = 0;
    for (const floor of above) {
      if (floor.index < 1) continue;
      const hit = serves(floor, u);
      if (hit === 0) break;
      score += hit;
      top = floor.index;
    }
    if (top < 2) continue; // an escape has to join at least two floors
    const better = !best || top > best.toFloor
      || (top === best.toFloor && score > best.score)
      || (top === best.toFloor && score === best.score && Math.abs(u - middle) < Math.abs(best.u - middle));
    if (better) best = { u, toFloor: top, score };
  }
  return best ? { u: best.u, toFloor: best.toFloor } : null;
}

function buildRoof(
  req: BuildingRequest, family: Family, massing: Massing, top: number,
  style: Style, floors: FloorLayout[],
): Blueprint['roof'] {
  const topFloor = floors[floors.length - 1]!;
  const outline = topFloor.outline;
  const artifacts: RoofArtifact[] = [];
  const bulkhead = placeBulkhead(req, outline, massing.groundOutline, floors.map((f) => f.height));
  if ((req.options?.roofArtifacts ?? 'auto') !== 'off') {
    const rng = new Rng(req.seed, 'roof');
    const placed: { cx: number; cz: number; hw: number; hd: number }[] = [];
    // The stair head and the walk space around it are taken before anything lands.
    if (bulkhead) placed.push(bulkheadKeepOut(bulkhead));
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
      const spot = findRoofSpot(outline, placed, ww, dd, cx0, cz0, rng, rule.kind === 'helipad' || rule.kind === 'penthouse-screen');
      if (!spot) continue;
      placed.push({ cx: spot[0], cz: spot[1], hw: ww / 2 + 0.4, hd: dd / 2 + 0.4 });
      artifacts.push({ kind: rule.kind, center: [quant(spot[0]), quant(spot[1])], size: [w, d, h], rotationDeg });
    }
  }
  return { elevation: quant(top), outline, parapetHeight: style.parapetHeight, bulkhead, artifacts };
}

/**
 * The stair head lands in the middle of the plate, its rectangle aligned with
 * the plate's own long axis. Published so the interior can put its stair there
 * and the engine can walk the roof around it; null when the plate is too small
 * to hold the housing plus its walk space.
 */
function placeBulkhead(
  req: BuildingRequest, outline: P2[], ground: P2[], floorHeights: number[],
): Blueprint['roof']['bulkhead'] {
  const rng = new Rng(req.seed, 'roof-access');
  // The cutout is the interior stair head's own size, square so either stair orientation lands
  // in it, from the stair constants the interior publishes; without them the table's ranges.
  const side = stairHeadSide(floorHeights);
  const width = side ?? quant(rng.range(...ROOF_ACCESS.width));
  const depth = side ?? quant(rng.range(...ROOF_ACCESS.depth));
  const center = centroid(outline).map(quant) as P2;
  // The core's own axis, the longest ground edge, so the housing stands square
  // to the frame the interior lays its core in.
  const axis = coreAxis(ground);
  const cross: P2 = [-axis[1], axis[0]];
  const c = ROOF_ACCESS.clearance;
  const hw = width / 2 + c;
  const hd = depth / 2 + c;
  const corners: P2[] = ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as P2[]).map(([u, v]): P2 => [
    center[0] + axis[0] * u + cross[0] * v,
    center[1] + axis[1] * u + cross[1] * v,
  ]);
  if (!corners.every((p) => pointInPolygon(outline, p))) return null;
  return {
    center, axis, width, depth,
    housingHeight: quant(rng.range(...ROOF_ACCESS.housingHeight)),
    doorNormal: cross,
    doorWidth: ROOF_ACCESS.doorWidth,
    doorHeight: ROOF_ACCESS.doorHeight,
  };
}

/** Axis-aligned box the roof artifacts must stay out of: the housing plus its walk space. */
function bulkheadKeepOut(b: NonNullable<Blueprint['roof']['bulkhead']>): { cx: number; cz: number; hw: number; hd: number } {
  const cross: P2 = [-b.axis[1], b.axis[0]];
  const halfX = Math.abs(b.axis[0]) * b.width / 2 + Math.abs(cross[0]) * b.depth / 2;
  const halfZ = Math.abs(b.axis[1]) * b.width / 2 + Math.abs(cross[1]) * b.depth / 2;
  return {
    cx: b.center[0], cz: b.center[1],
    hw: halfX + ROOF_ACCESS.clearance, hd: halfZ + ROOF_ACCESS.clearance,
  };
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

/** The interior's stair constants, as it publishes them for consumers (../interior/schemas/core-feasibility.json). */
const STAIR_CONSTANTS = readStairConstants();

interface StairConstants {
  columnWidth: number;
  riserMin: number;
  riserIdeal: number;
  riserMax: number;
  tread: number;
  maxRisersPerFlight: number;
  landing: number;
  wallThickness: number;
}

function readStairConstants(): StairConstants | null {
  try {
    const c = JSON.parse(readFileSync(new URL('../../../interior/schemas/core-feasibility.json', import.meta.url), 'utf8')).constants;
    const values: StairConstants = {
      columnWidth: c.stairColumnWidth,
      riserMin: c.stairRiserMin,
      riserIdeal: c.stairRiserIdeal,
      riserMax: c.stairRiserMax,
      tread: c.stairTread,
      maxRisersPerFlight: c.maxRisersPerFlight,
      landing: c.stairLanding,
      wallThickness: c.wallThickness,
    };
    return Object.values(values).every((v) => Number.isFinite(v) && v > 0) ? values : null;
  } catch {
    return null;
  }
}

/**
 * The side of the square the stair head needs: the stair column width or the
 * shaft depth, whichever is longer, by the interior's own recipe (step 5 of
 * its core feasibility: the worst comfortable riser count per flight over
 * every one- or two-storey climb, times the tread, plus two landings and the
 * dividing wall, rounded up to a decimetre).
 */
function stairHeadSide(floorHeights: number[]): number | null {
  const c = STAIR_CONSTANTS;
  if (!c || floorHeights.length === 0) return null;
  const climbs = [...floorHeights];
  for (let i = 0; i + 1 < floorHeights.length; i++) climbs.push(floorHeights[i]! + floorHeights[i + 1]!);
  let worst = 0;
  for (const climb of climbs) {
    const idealRisers = climb / c.riserIdeal;
    const flights = 2 * Math.ceil(idealRisers / (2 * c.maxRisersPerFlight));
    const minTotal = Math.ceil(climb / c.riserMax - 1e-9);
    const maxTotal = Math.floor(climb / c.riserMin + 1e-9);
    const minMultiple = Math.ceil(minTotal / flights) * flights;
    const maxMultiple = Math.floor(maxTotal / flights) * flights;
    if (minMultiple > maxMultiple) return null;
    const nearest = Math.round(idealRisers / flights) * flights;
    const totalRisers = Math.max(minMultiple, Math.min(maxMultiple, nearest));
    worst = Math.max(worst, totalRisers / flights);
  }
  const depth = Math.ceil((worst * c.tread + 2 * c.landing + c.wallThickness) * 10 - 1e-9) / 10;
  return quant(Math.max(c.columnWidth, depth) + STAIR_HEAD_MARGIN);
}

/** Room around the stair head inside the housing, so a stair a little off the housing centre still lands in it. */
const STAIR_HEAD_MARGIN = 1.0;
