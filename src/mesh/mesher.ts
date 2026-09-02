// Turns a Layout into mesh parts. Every visible face goes through quadFacing or
// the cap winding check, so nothing can face inward.

import { MeshBuilder, type PartSink, type V3, add, scale } from './primitives.ts';
import { cutWall, rectHole, type Hole } from './wallcut.ts';
import { capUp, capDown, capFrame, type CapFrame } from './caps.ts';
import { meshAnchorMount } from './anchorMount.ts';
import { edgeDir, edgeNormal, edgeLength, type P2 } from '../core/polygon.ts';
import { AC_UNITS, BALCONY, FACADE, FIRE_ESCAPE, ROOF_ACCESS, SIGNAGE } from '../rules/tables.ts';
import { glyphKind, glyphUv, isBlank } from '../rules/glyphs.ts';
import { paneGrid } from '../layout/glazing.ts';
import type { Layout, FloorLayout, Style } from '../layout/model.ts';
import type { Blueprint, Opening } from '../types.ts';

const REVEAL = 0.12;
const APERTURE_REVEAL = 0.15;
/** A wall-mounted plate's back panel stands this far off the wall, so the two never share a plane. */
const PLATE_STANDOFF = 0.012;
/** The border a sign plate shows around its face. */
const SIGN_BORDER = 0.08;
/** How far a punched window's frame reaches behind the wall skin, so the two never share a plane. */
const FRAME_BITE = 0.01;


/** Door assembly sections: casing around the hole, then the swinging leaf itself. */
const DOOR = {
  casingWidth: 0.09,
  casingDepth: 0.05,
  leafThickness: 0.055,
  stile: 0.11,
  rail: 0.16,
  paneThickness: 0.02,
};

interface Frame { v: P2; dir: P2; n: P2; len: number }

export function buildMesh(layout: Layout): MeshBuilder {
  const mb = new MeshBuilder();
  const { theme, tier } = layout;
  const mat = (kind: string) => `${theme}/${kind}/${tier}`;
  const floors = layout.floors;
  const above = floors.filter((f) => f.index >= 0);
  const lowest = floors[0]!;
  const topFloor = floors[floors.length - 1]!;
  const top = topFloor.elevation + topFloor.height;
  // One tiling grid for every horizontal surface of the building.
  const caps = capFrame(floors.find((f) => f.index === 0)!.outline);

  // Floor separator planes, faced both ways: seen from below through the glazing
  // a one-sided slab is invisible and the shell reads hollow. Each keeps its node
  // in merged output, so the interior can swap it for the slab it furnishes.
  for (const f of floors) {
    const sink = mb.part(`floor:${f.index}/slab`, { keepNode: true });
    capUp(sink, mat('floor-slab'), caps, f.outline, f.elevation);
    capDown(sink, mat('floor-slab'), caps, f.outline, f.elevation);
  }

  // Terrace rings where the outline steps inward.
  for (let i = 1; i < above.length; i++) {
    const prev = above[i - 1]!, cur = above[i]!;
    if (prev.outline !== cur.outline) {
      capUp(mb.part(`terrace:${cur.index}`), mat('roof'), caps, prev.outline, cur.elevation, cur.outline);
    }
  }

  // Walls with holes, then per-opening geometry.
  for (const f of floors) {
    for (let e = 0; e < f.outline.length; e++) {
      const fr = frame(f.outline, e);
      const holes: Hole[] = [];
      for (const o of f.openings) {
        if (o.edge !== e) continue;
        if (o.kind === 'aperture') continue;
        holes.push(rectHole(o.offset, f.elevation + o.sill, o.width, o.height));
        if (o.transom) {
          holes.push(rectHole(o.offset, f.elevation + o.sill + o.height + FACADE.curtainWall.transomGap, o.width, o.transom));
        }
      }
      // Apertures force parcel-verbatim massing, so face index == edge index on every floor.
      for (const c of layout.carved) {
        if (c.aperture.face === e) holes.push({ poly: c.facePoly });
      }
      const sink = mb.part(`wall:${f.index}/${e}`);
      for (const piece of cutWall(fr.len, f.elevation, f.elevation + f.height, holes)) {
        const uvs = [piece.bl, piece.br, piece.tr, piece.tl].map(([u, y]) => [u, f.elevation - y] as [number, number]);
        sink.quadFacing(mat('wall'), at(fr, piece.bl), at(fr, piece.br), at(fr, piece.tr), at(fr, piece.tl), n3(fr), uvs);
      }
    }
    for (const o of f.openings) meshOpening(mb, layout, f, o, mat);
  }

  // Roof, parapet, bottom cap. The roof is the top floor's ceiling too, cut open
  // where the stair head comes up.
  const roofSink = mb.part('roof');
  const cutout = layout.roof.bulkhead ? bulkheadRect(layout.roof.bulkhead) : undefined;
  capUp(roofSink, mat('roof'), caps, topFloor.outline, top, cutout);
  capDown(roofSink, mat('floor-slab'), caps, topFloor.outline, top, cutout);
  if (layout.roof.bulkhead) meshBulkhead(mb, layout.roof.bulkhead, top, caps, mat);
  capDown(mb.part('base'), mat('floor-slab'), caps, lowest.outline, lowest.elevation);
  const parapet = mb.part('parapet');
  for (let e = 0; e < topFloor.outline.length; e++) {
    const fr = frame(topFloor.outline, e);
    const mid = at(fr, [fr.len / 2, top + layout.roof.parapetHeight / 2]);
    parapet.box(mat('parapet'), mid,
      [fr.dir[0] * fr.len / 2, 0, fr.dir[1] * fr.len / 2],
      [0, layout.roof.parapetHeight / 2, 0],
      [fr.n[0] * 0.075, 0, fr.n[1] * 0.075]);
  }

  meshFacadeRelief(mb, layout, above, top, mat);
  meshColumns(mb, layout, above, top, mat);
  meshRoofArtifacts(mb, layout, top, mat);
  meshFacadeArtifacts(mb, layout, mat);
  meshAcUnits(mb, layout, mat);
  for (const a of layout.anchors) meshAnchorMount(mb, a, mat('window-frame'));
  meshFeatures(mb, layout, mat);
  meshFireEscape(mb, layout, above, mat);

  return mb;
}

function frame(outline: P2[], e: number): Frame {
  return { v: outline[e] as P2, dir: edgeDir(outline, e), n: edgeNormal(outline, e), len: edgeLength(outline, e) };
}

function at(fr: Frame, [u, y]: [number, number], proud = 0): V3 {
  return [fr.v[0] + fr.dir[0] * u + fr.n[0] * proud, y, fr.v[1] + fr.dir[1] * u + fr.n[1] * proud];
}

function n3(fr: Frame): V3 {
  return [fr.n[0], 0, fr.n[1]];
}

function meshOpening(mb: MeshBuilder, layout: Layout, f: FloorLayout, o: Opening, mat: (k: string) => string): void {
  const fr = frame(f.outline, o.edge);
  const yb = f.elevation + o.sill;
  const yt = yb + o.height;
  const u0 = o.offset, u1 = o.offset + o.width;

  if (o.kind === 'window') {
    const sink = mb.part(`window:${o.id}`);
    windowUnit(sink, fr, u0, u1, yb, yt, o, layout.style, mat);
    return;
  }
  if (o.kind === 'door' || o.kind === 'balconyDoor') {
    const base = o.kind === 'door' ? `door:${o.id}` : `balcony:${o.id}`;
    mb.part(base); // the door as a whole: frame plus one node per leaf
    const frame = mb.part(`${base}/frame`, { parent: base });
    reveal(frame, fr, [[u0, yb], [u1, yb], [u1, yt], [u0, yt]], REVEAL, o.sill > 0.01, mat('door'));
    doorCasing(frame, fr, u0, u1, yb, yt, mat('door'));
    doorLeaves(mb, base, fr, u0, u1, yb, yt, o, mat);
    if (o.transom) {
      // The glazing carries on over the door head as this door's transom light.
      const tb = yt + FACADE.curtainWall.transomGap;
      const light: Opening = {
        ...o, kind: 'window', sill: o.sill + o.height + FACADE.curtainWall.transomGap, height: o.transom,
        panes: paneGrid(o.width, o.transom, layout.style.glazing),
        material: mat('window-glass'),
      };
      delete light.spandrel;
      windowUnit(frame, fr, u0, u1, tb, tb + o.transom, light, layout.style, mat);
    }
    if (o.kind === 'balconyDoor' && o.balcony) meshBalcony(frame, fr, o, f.elevation, mat);
    return;
  }
  // Aperture: reveal ring around the exact cut, mouth left open.
  const sink = mb.part(`aperture:${o.id}`);
  const carved = layout.carved.find((c) => c.aperture.id === o.id);
  if (carved) reveal(sink, fr, carved.facePoly, APERTURE_REVEAL, true, o.material ?? mat('aperture-frame'));
}

/**
 * The casing around a door: two jambs running the full height of the ring and a
 * head between them. The three members partition the ring, so no two plates ever
 * share a plane.
 */
function doorCasing(sink: PartSink, fr: Frame, u0: number, u1: number, yb: number, yt: number, material: string): void {
  const w = DOOR.casingWidth;
  const d = DOOR.casingDepth;
  const boxOn = (a: number, b: number, y0: number, y1: number) => {
    sink.box(material, at(fr, [(a + b) / 2, (y0 + y1) / 2], d / 2),
      [fr.dir[0] * (b - a) / 2, 0, fr.dir[1] * (b - a) / 2],
      [0, (y1 - y0) / 2, 0],
      [fr.n[0] * d / 2, 0, fr.n[1] * d / 2], true);
  };
  boxOn(u0 - w, u0, yb, yt + w);
  boxOn(u1, u1 + w, yb, yt + w);
  boxOn(u0, u1, yt, yt + w);
}

/**
 * The leaves. Each one is a single node subtree holding everything that swings
 * with it, its glass included, and the node sits on the hinge so the game turns
 * it about its own Y. A pair hinges on the outer jambs and meets in the middle.
 */
function doorLeaves(
  mb: MeshBuilder, base: string, fr: Frame, u0: number, u1: number, yb: number, yt: number,
  o: Opening, mat: (k: string) => string,
): void {
  const count = Math.max(1, o.leaves ?? 1);
  const leafW = (u1 - u0) / count;
  const t = DOOR.leafThickness;
  const back = -REVEAL - t;
  const glazed = (o.material ?? '').includes('door-glass');
  const frameMat = mat('door');
  const glassMat = o.material ?? mat('door-glass');
  const stile = Math.min(DOOR.stile, leafW / 3);
  const rail = Math.min(DOOR.rail, (yt - yb) / 4);

  for (let i = 0; i < count; i++) {
    const a = u0 + i * leafW;
    const b = a + leafW;
    const hinge = i < count / 2 ? a : b;
    const sink = mb.part(`${base}/leaf:${i}`, { parent: base, pivot: at(fr, [hinge, yb], back + t / 2) });
    const slab = (uA: number, uB: number, y0: number, y1: number, front: number, depth: number, material: string) => {
      if (uB - uA < 1e-6 || y1 - y0 < 1e-6) return;
      sink.box(material, at(fr, [(uA + uB) / 2, (y0 + y1) / 2], front - depth / 2),
        [fr.dir[0] * (uB - uA) / 2, 0, fr.dir[1] * (uB - uA) / 2],
        [0, (y1 - y0) / 2, 0],
        [fr.n[0] * depth / 2, 0, fr.n[1] * depth / 2]);
    };
    if (!glazed) {
      slab(a, b, yb, yt, -REVEAL, t, frameMat);
      continue;
    }
    // Stiles and rails carry the leaf; the pane sits inside them, thinner, so no
    // two faces of the leaf ever land on one plane.
    slab(a, a + stile, yb, yt, -REVEAL, t, frameMat);
    slab(b - stile, b, yb, yt, -REVEAL, t, frameMat);
    slab(a + stile, b - stile, yb, yb + rail, -REVEAL, t, frameMat);
    slab(a + stile, b - stile, yt - rail, yt, -REVEAL, t, frameMat);
    slab(a + stile, b - stile, yb + rail, yt - rail, -REVEAL - (t - DOOR.paneThickness) / 2, DOOR.paneThickness, glassMat);
  }
}

/**
 * A window unit: a frame profile standing proud of the wall with real reveal
 * depth, a mullion grid splitting the opening into panes no larger than the
 * tier's structural limit, and the glass recessed behind the profile. A
 * curtain-wall bay carries the spandrel panel that hides its slab edge at the
 * bottom, and its vision glass starts above that band.
 */
function windowUnit(
  sink: PartSink, fr: Frame, u0: number, u1: number, yb: number, yt: number,
  o: Opening, style: Style, mat: (k: string) => string,
): void {
  const g = style.glazing;
  const fw = Math.min(g.frameWidth, (u1 - u0) / 4, (yt - yb) / 4);
  const spandrel = o.spandrel ?? 0;
  const frameMat = mat('window-frame');
  const curtainWall = style.facade.kind === 'curtain-wall';

  // The wall is cut at the opening; the reveal ring lines it from the skin back
  // to the glass, so the hole never shows an open edge beside the frame.
  const recess = style.facade.windowRecess;
  const z = -recess;
  const lining = recess + g.glassInset;
  if (lining > 0.005) {
    reveal(sink, fr, [[u0, yb], [u1, yb], [u1, yt], [u0, yt]], lining, true, frameMat);
  }

  // A punched window: the frame ring straddles the hole edge, half over the wall
  // and half over the glass, its back on the wall skin, and the glass fills the
  // hole exactly. A curtain wall has no wall to sit on and its mullion is shared
  // with the bay next door, so its ring stays inside the bay and the glass is
  // the field the ring leaves.
  const sill = spandrel > 0 ? yb + spandrel : yb;
  const half = fw / 2;
  const down = Math.min(half, o.sill + spandrel);
  const outer = curtainWall
    ? { u0, u1, y0: sill, y1: yt }
    : { u0: u0 - half, u1: u1 + half, y0: sill - down, y1: yt + half };
  const inner = curtainWall
    ? { u0: u0 + fw, u1: u1 - fw, y0: sill + fw, y1: yt - fw }
    : { u0: u0 + half, u1: u1 - half, y0: sill + half, y1: yt - half };
  const field = curtainWall ? inner : { u0, u1, y0: sill, y1: yt };
  const proud = curtainWall ? g.frameProud + z : g.frameProud;
  const depth = curtainWall ? g.frameProud + g.glassInset : g.frameProud + FRAME_BITE;
  const { g0, g1, gb, gt } = { g0: field.u0, g1: field.u1, gb: field.y0, gt: field.y1 };

  if (spandrel > 0) {
    // the spandrel is an opaque matte panel, not a metal band: it hides the slab and never flares
    strip(sink, fr, u0, u1, yb, yb + spandrel, proud, mat('column'));
  }
  // Every outer member is a closed profile: both side faces, so nothing looks into it from the street.
  member(sink, fr, outer.u0, outer.u1, inner.y1, outer.y1, proud, depth, frameMat, { bottom: true, top: true });
  member(sink, fr, outer.u0, outer.u1, outer.y0, inner.y0, proud, depth, frameMat, { top: true, bottom: true });
  member(sink, fr, outer.u0, inner.u0, inner.y0, inner.y1, proud, depth, frameMat, { left: true, right: true });
  member(sink, fr, inner.u1, outer.u1, inner.y0, inner.y1, proud, depth, frameMat, { left: true, right: true });

  const { cols, rows } = o.panes ?? paneGrid(u1 - u0, gt - gb, g);
  const mw = Math.min(g.mullionWidth, (g1 - g0) / (cols * 2), (gt - gb) / (rows * 2));
  const mProud = g.frameProud * 0.7 + z;
  const mDepth = g.frameProud * 0.7 + g.glassInset;
  // mullions run inside the glazed field, standing on the glass
  for (let c = 1; c < cols; c++) {
    const u = g0 + ((g1 - g0) * c) / cols;
    member(sink, fr, u - mw / 2, u + mw / 2, gb, gt, mProud, mDepth, frameMat, { left: true, right: true });
  }
  for (let r = 1; r < rows; r++) {
    const y = gb + ((gt - gb) * r) / rows;
    member(sink, fr, g0, g1, y - mw / 2, y + mw / 2, mProud, mDepth, frameMat, { bottom: true, top: true });
  }

  // Glass recessed behind the wall face, exact 0..1 UVs over the pane field.
  const glassZ = z - g.glassInset;
  sink.quadFacing(o.material ?? mat('window-glass'),
    at(fr, [g0, gb], glassZ), at(fr, [g1, gb], glassZ), at(fr, [g1, gt], glassZ), at(fr, [g0, gt], glassZ),
    n3(fr), [[0, 1], [1, 1], [1, 0], [0, 0]]);

  // Curtain panel behind the glass, dropping from the top by state.
  const fraction = o.state === 'half' ? 0.5 : o.state === 'closed80' ? 0.8 : 0;
  if (fraction > 0) {
    const cb = gt - (gt - gb) * fraction;
    const z = glassZ - 0.02;
    sink.quadFacing(mat('curtain'), at(fr, [g0, cb], z), at(fr, [g1, cb], z), at(fr, [g1, gt], z), at(fr, [g0, gt], z),
      n3(fr), [[0, fraction], [1, fraction], [1, 0], [0, 0]]);
  }
}

interface Reveals { left?: boolean; right?: boolean; bottom?: boolean; top?: boolean }

/**
 * One frame or mullion section: the face plate standing `proud` of the wall plus
 * the reveal sides that reach `depth` back toward the glass. Sides that end up
 * buried in the wall or in a neighbouring member are not emitted.
 */
function member(
  sink: PartSink, fr: Frame, u0: number, u1: number, y0: number, y1: number,
  proud: number, depth: number, material: string, reveals: Reveals,
): void {
  if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
  strip(sink, fr, u0, u1, y0, y1, proud, material, true);
  const back = proud - depth;
  if (reveals.left) revealU(sink, fr, u0, y0, y1, proud, back, -1, depth, material);
  if (reveals.right) revealU(sink, fr, u1, y0, y1, proud, back, 1, depth, material);
  if (reveals.bottom) revealY(sink, fr, u0, u1, y0, proud, back, -1, depth, material);
  if (reveals.top) revealY(sink, fr, u0, u1, y1, proud, back, 1, depth, material);
}

/** Vertical reveal face at u, normal along the edge direction times s. */
function revealU(
  sink: PartSink, fr: Frame, u: number, y0: number, y1: number,
  proud: number, back: number, s: number, depth: number, material: string,
): void {
  const outward: V3 = [fr.dir[0] * s, 0, fr.dir[1] * s];
  const h = y1 - y0;
  sink.quadFacing(material,
    at(fr, [u, y0], proud), at(fr, [u, y0], back), at(fr, [u, y1], back), at(fr, [u, y1], proud),
    outward, faceUv(depth, h, true));
}

/** Horizontal reveal face at y, normal +Y or -Y by s. */
function revealY(
  sink: PartSink, fr: Frame, u0: number, u1: number, y: number,
  proud: number, back: number, s: number, depth: number, material: string,
): void {
  const w = u1 - u0;
  sink.quadFacing(material,
    at(fr, [u0, y], proud), at(fr, [u1, y], proud), at(fr, [u1, y], back), at(fr, [u0, y], back),
    [0, s, 0], faceUv(w, depth, true));
}

/**
 * World-scale UVs for a face, `along` turning the map a quarter so its U axis
 * runs down the long side. A frame member is a rolled section: the map has to
 * follow its length, or a jamb and the head it meets read as two materials.
 */
function faceUv(w: number, h: number, along = false): [number, number][] {
  if (along && h > w) return [[0, 0], [0, w], [h, w], [h, 0]];
  return [[0, 0], [w, 0], [w, h], [0, h]];
}

/** Proud flat plate on the wall plane (frames, trims), world-scale UVs so tiles never stretch. */
function strip(sink: PartSink, fr: Frame, u0: number, u1: number, y0: number, y1: number, proud: number, material: string, along = false): void {
  if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
  const w = u1 - u0, h = y1 - y0;
  sink.quadFacing(material, at(fr, [u0, y0], proud), at(fr, [u1, y0], proud), at(fr, [u1, y1], proud), at(fr, [u0, y1], proud), n3(fr), faceUv(w, h, along));
}

/** Quads bridging the wall plane to a recessed plane along a hole boundary, facing into the hole. */
function reveal(sink: PartSink, fr: Frame, poly: P2[], depth: number, includeBottom: boolean, material: string): void {
  let cu = 0, cy = 0;
  for (const [u, y] of poly) { cu += u; cy += y; }
  cu /= poly.length; cy /= poly.length;
  const minY = Math.min(...poly.map((p) => p[1]));
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [ua, ya] = poly[i] as P2;
    const [ub, yb2] = poly[(i + 1) % n] as P2;
    const isBottomEdge = Math.abs(ya - yb2) < 1e-9 && Math.abs(ya - minY) < 1e-9;
    if (!includeBottom && isBottomEdge) continue; // sill at floor level: the slab is the threshold
    const mu = (ua + ub) / 2, my = (ya + yb2) / 2;
    const inward2: [number, number] = [cu - mu, cy - my];
    const inward: V3 = [fr.dir[0] * inward2[0], inward2[1], fr.dir[1] * inward2[0]];
    const outerA = at(fr, [ua, ya]);
    const outerB = at(fr, [ub, yb2]);
    const innerB = at(fr, [ub, yb2], -depth);
    const innerA = at(fr, [ua, ya], -depth);
    const w = Math.sqrt((ub - ua) ** 2 + (yb2 - ya) ** 2);
    sink.quadFacing(material, outerA, outerB, innerB, innerA, inward, [[0, 0], [w, 0], [w, depth], [0, depth]]);
  }
}

function meshBalcony(sink: PartSink, fr: Frame, o: Opening, elevation: number, mat: (k: string) => string): void {
  const { depth, width } = o.balcony!;
  const uc = o.offset + o.width / 2;
  const railT = 0.05;
  const railH = BALCONY.railing;
  if (depth <= 0) {
    // Juliet: railing panel directly in front of the door.
    const w = o.width + 0.3;
    const c = at(fr, [uc, elevation + railH / 2], BALCONY.julietDepth);
    sink.box(mat('balcony-rail'), c, [fr.dir[0] * w / 2, 0, fr.dir[1] * w / 2], [0, railH / 2, 0], [fr.n[0] * railT / 2, 0, fr.n[1] * railT / 2]);
    return;
  }
  const slabT = 0.15;
  const slabC = at(fr, [uc, elevation + 0.02 - slabT / 2], depth / 2);
  sink.box(mat('balcony-slab'), slabC, [fr.dir[0] * width / 2, 0, fr.dir[1] * width / 2], [0, slabT / 2, 0], [fr.n[0] * depth / 2, 0, fr.n[1] * depth / 2]);
  const railY = elevation + 0.02 + railH / 2;
  // Front rail.
  sink.box(mat('balcony-rail'), at(fr, [uc, railY], depth - railT / 2), [fr.dir[0] * width / 2, 0, fr.dir[1] * width / 2], [0, railH / 2, 0], [fr.n[0] * railT / 2, 0, fr.n[1] * railT / 2]);
  // Side rails.
  for (const s of [-1, 1]) {
    sink.box(mat('balcony-rail'), at(fr, [uc + s * (width / 2 - railT / 2), railY], depth / 2), [fr.dir[0] * railT / 2, 0, fr.dir[1] * railT / 2], [0, railH / 2, 0], [fr.n[0] * depth / 2, 0, fr.n[1] * depth / 2]);
  }
}

/**
 * Panel relief: vertical ribs on the whole-tile grid the wall material tiles on,
 * and a band at each floor line. The megablock tier reads heavy, the panel tier
 * thin, glass facades get none.
 */
function meshFacadeRelief(mb: MeshBuilder, layout: Layout, above: FloorLayout[], top: number, mat: (k: string) => string): void {
  const f = layout.style.facade;
  const relief = layout.relief;
  if (f.ribWidth <= 0 || above.length === 0) return;
  const sink = mb.part('facade-relief');
  const material = mat('wall-trim');

  relief.byEdge.forEach((face, e) => {
    const fr = frame(relief.outline, e);
    for (const u of face.ribs) {
      sink.box(material, at(fr, [u, top / 2], f.ribDepth / 2),
        [fr.dir[0] * f.ribWidth / 2, 0, fr.dir[1] * f.ribWidth / 2],
        [0, top / 2, 0],
        [fr.n[0] * f.ribDepth / 2, 0, fr.n[1] * f.ribDepth / 2]);
    }
  });

  for (const fl of above) {
    if (fl.index === 0) continue; // the ground band would sit on the pavement
    for (let e = 0; e < fl.outline.length; e++) {
      const fr = frame(fl.outline, e);
      sink.box(material, at(fr, [fr.len / 2, fl.elevation], f.bandProud / 2),
        [fr.dir[0] * fr.len / 2, 0, fr.dir[1] * fr.len / 2],
        [0, f.bandHeight / 2, 0],
        [fr.n[0] * f.bandProud / 2, 0, fr.n[1] * f.bandProud / 2]);
    }
  }
}

/** Surface-mounted utility boxes, published in the blueprint and collidable. */
function meshFacadeArtifacts(mb: MeshBuilder, layout: Layout, mat: (k: string) => string): void {
  const boxes = layout.facadeArtifacts.filter((a) => a.kind === 'utility-box');
  if (boxes.length === 0) return;
  const sink = mb.part('facade-artifacts');
  const byFloor = new Map(layout.floors.map((f) => [f.index, f]));
  for (const a of boxes) {
    const floor = byFloor.get(a.floor);
    if (!floor) continue;
    const fr = frame(floor.outline, a.edge);
    const [w, h, d] = a.size;
    sink.box(mat('roof-artifact'), at(fr, [a.offset + w / 2, floor.elevation + a.sill + h / 2], d / 2),
      [fr.dir[0] * w / 2, 0, fr.dir[1] * w / 2],
      [0, h / 2, 0],
      [fr.n[0] * d / 2, 0, fr.n[1] * d / 2]);
  }
}

/**
 * Facade condenser units: a housing with a grille face standing on a bracket,
 * a shelf carried by two struts back to the wall. Every member is painted steel.
 */
function meshAcUnits(mb: MeshBuilder, layout: Layout, mat: (k: string) => string): void {
  const units = layout.facadeArtifacts.filter((a) => a.kind === 'ac-unit');
  if (units.length === 0) return;
  const sink = mb.part('facade-ac');
  const byFloor = new Map(layout.floors.map((f) => [f.index, f]));
  const metal = mat('metal');
  const { grille, bracket } = AC_UNITS;
  for (const a of units) {
    const floor = byFloor.get(a.floor);
    if (!floor) continue;
    const fr = frame(floor.outline, a.edge);
    const [w, h, d] = a.size;
    const back = a.standoff ?? 0;
    const uc = a.offset + w / 2;
    const base = floor.elevation + a.sill;
    const across = (half: number): V3 => [fr.dir[0] * half, 0, fr.dir[1] * half];
    const out = (half: number): V3 => [fr.n[0] * half, 0, fr.n[1] * half];

    sink.box(metal, at(fr, [uc, base + h / 2], back + d / 2), across(w / 2), [0, h / 2, 0], out(d / 2));
    sink.box(metal, at(fr, [uc, base + h / 2], back + d + grille.proud / 2),
      across(w / 2 - grille.inset), [0, h / 2 - grille.inset, 0], out(grille.proud / 2));
    sink.box(metal, at(fr, [uc, base - bracket.shelf / 2], back + d / 2),
      across(w / 2), [0, bracket.shelf / 2, 0], out(d / 2), true);
    for (const side of [-1, 1]) {
      const u = uc + side * (w / 2 - bracket.strut);
      sink.slantedBox(metal,
        at(fr, [u, base - bracket.shelf - bracket.drop], back),
        at(fr, [u, base - bracket.shelf], back + d),
        across(1), bracket.strut, bracket.strut);
    }
  }
}

function meshColumns(mb: MeshBuilder, layout: Layout, above: FloorLayout[], top: number, mat: (k: string) => string): void {
  if (!layout.style.showColumns || above.length === 0) return;
  const relief = layout.relief;
  const sink = mb.part('columns');
  const w = layout.style.columnWidth;
  relief.byEdge.forEach((face, e) => {
    const fr = frame(relief.outline, e);
    for (const u of face.columns) {
      sink.box(mat('column'), at(fr, [u, top / 2], 0.06), [fr.dir[0] * w / 2, 0, fr.dir[1] * w / 2], [0, top / 2, 0], [fr.n[0] * 0.06, 0, fr.n[1] * 0.06]);
    }
  });
}

/** World corners of the stair-head cutout, in the plate's own axis frame. */
function bulkheadRect(b: NonNullable<Blueprint['roof']['bulkhead']>): P2[] {
  const a = b.axis;
  const c: P2 = [-a[1], a[0]];
  const hw = b.width / 2, hd = b.depth / 2;
  const at2 = (u: number, v: number): P2 => [b.center[0] + a[0] * u + c[0] * v, b.center[1] + a[1] * u + c[1] * v];
  return [at2(-hw, -hd), at2(hw, -hd), at2(hw, hd), at2(-hw, hd)];
}

/** The housing over the stair head: four walls, one door onto the roof, a capped top. */
function meshBulkhead(
  mb: MeshBuilder, b: NonNullable<Blueprint['roof']['bulkhead']>, top: number, caps: CapFrame,
  mat: (k: string) => string,
): void {
  const sink = mb.part('bulkhead');
  const ring = bulkheadRect(b);
  const yTop = top + b.housingHeight;
  const t = ROOF_ACCESS.wallThickness;
  const wall = mat('wall');
  for (let e = 0; e < ring.length; e++) {
    const fr = frame(ring, e);
    const onDoorFace = fr.n[0] * b.doorNormal[0] + fr.n[1] * b.doorNormal[1] > 0.99;
    const holes: Hole[] = [];
    let door: { u0: number; u1: number; head: number } | null = null;
    if (onDoorFace) {
      const width = Math.min(b.doorWidth, fr.len - 0.4);
      const height = Math.min(b.doorHeight, b.housingHeight - 0.2);
      const u0 = (fr.len - width) / 2;
      holes.push(rectHole(u0, top, width, height));
      door = { u0, u1: u0 + width, head: top + height };
    }
    const inward: V3 = [-fr.n[0], 0, -fr.n[1]];
    for (const piece of cutWall(fr.len, top, yTop, holes)) {
      const uvs = [piece.bl, piece.br, piece.tr, piece.tl].map(([u, y]) => [u, top - y] as [number, number]);
      sink.quadFacing(wall, at(fr, piece.bl), at(fr, piece.br), at(fr, piece.tr), at(fr, piece.tl), n3(fr), uvs);
      // The same band on the room side: a one-sided wall reads as no wall from within.
      sink.quadFacing(wall, at(fr, piece.bl, -t), at(fr, piece.br, -t), at(fr, piece.tr, -t), at(fr, piece.tl, -t), inward, uvs);
    }
    if (!door) continue;
    const jamb: P2[] = [[door.u0, top], [door.u1, top], [door.u1, door.head], [door.u0, door.head]];
    reveal(sink, fr, jamb, t, false, wall);
    const base = 'door:roof-bulkhead';
    mb.part(base);
    doorCasing(mb.part(`${base}/frame`, { parent: base }), fr, door.u0, door.u1, top, door.head, mat('door'));
    doorLeaves(mb, base, fr, door.u0, door.u1, top, door.head, { leaves: 1 } as Opening, mat);
  }
  capUp(sink, mat('roof'), caps, ring, yTop);
  capDown(sink, mat('floor-slab'), caps, ring, yTop);
}

function meshRoofArtifacts(mb: MeshBuilder, layout: Layout, top: number, mat: (k: string) => string): void {
  if (layout.roof.artifacts.length === 0) return;
  const sink = mb.part('roof-artifacts');
  for (const a of layout.roof.artifacts) {
    const [w, d, h] = a.size;
    const ww = a.rotationDeg === 90 ? d : w;
    const dd = a.rotationDeg === 90 ? w : d;
    sink.aabox(mat('roof-artifact'), [a.center[0], top + h / 2, a.center[1]], ww, dd, h);
  }
}

function meshFeatures(mb: MeshBuilder, layout: Layout, mat: (k: string) => string): void {
  layout.signage.forEach((s, i) => meshSign(mb.part(`signage:${i}`), s, mat));
  layout.screens.forEach((s, i) => plate(mb.part(`screen:${i}`), s.center, s.normal, s.width, s.height, s.standoff + 0.1, mat('ad-screen'), s.standoff));
  layout.lights.forEach((l, i) => {
    const c = add(l.position, [l.normal[0] * 0.1, 0, l.normal[1] * 0.1]);
    mb.part(`light:${i}`).aabox(mat('light-fixture'), c, 0.16, 0.16, 0.28);
  });
}

/**
 * A sign: a framed plate carrying one glyph cell per letter. Horizontal signs
 * are a marquee band on the wall; vertical ones are a blade protruding edge-on,
 * lettered on both faces so the street reads it from either side.
 */
function meshSign(sink: PartSink, s: Blueprint['signage'][number], mat: (k: string) => string): void {
  const frame = mat('signage');
  const glyph = mat(glyphKind());
  const n: V3 = [s.normal[0], 0, s.normal[1]];
  const right: V3 = [s.normal[1], 0, -s.normal[0]];
  const up: V3 = [0, 1, 0];
  const text = s.text ?? '';
  const cell = s.cellSize ?? 0;

  if (s.mode === 'logo' || s.orientation !== 'vertical') {
    const depth = s.depth ?? 0.06;
    // a dark border plate behind the sign face, so the letters read as a mounted sign
    plate(sink, s.center, s.normal, s.width + 2 * SIGN_BORDER, s.height + 2 * SIGN_BORDER, depth - 0.02, mat('door'), s.standoff);
    plate(sink, s.center, s.normal, s.width, s.height, depth, frame, s.standoff);
    if (!cell) return;
    // Glyph cells left to right across the band, standing just off the plate face.
    const face = add(s.center, scale(n, depth + 0.01));
    const size = cell * SIGNAGE.glyphFill;
    for (let i = 0; i < text.length; i++) {
      const char = text[i] as string;
      if (isBlank(char)) continue;
      const cx = (i + 0.5) * cell - s.width / 2;
      glyphQuad(sink, glyph, add(face, scale(right, cx)), right, up, size, n, char);
    }
    return;
  }

  // Blade: a box standing out from the wall, letters stacked down both sides.
  const depth = s.depth ?? 1;
  const back = s.standoff;
  const half = s.width / 2;
  const center = add(s.center, scale(n, (back + depth) / 2));
  sink.box(frame, center, scale(right, half), scale(up, s.height / 2), scale(n, (depth - back) / 2));
  if (!cell) return;
  const size = Math.min(cell * SIGNAGE.glyphFill, depth * 0.8);
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (isBlank(char)) continue;
    const cy = s.height / 2 - SIGNAGE.framePad - (i + 0.5) * cell;
    for (const side of [1, -1]) {
      const outward = scale(right, side);
      const at3 = add(add(center, scale(up, cy)), scale(right, side * (half + 0.01)));
      // The far face reads from the opposite side, so its text axis flips with it.
      glyphQuad(sink, glyph, at3, scale(n, -side), up, size, outward, char);
    }
  }
}

/** One letter cell: a quad facing `outward`, UV-picked out of the letter atlas. */
function glyphQuad(
  sink: PartSink, material: string, center: V3, right: V3, up: V3, size: number, outward: V3, char: string,
): void {
  const [u0, v0, u1, v1] = glyphUv(char);
  const h = scale(right, size / 2);
  const v = scale(up, size / 2);
  sink.quadFacing(material,
    add(add(center, scale(h, -1)), scale(v, -1)),
    add(add(center, h), scale(v, -1)),
    add(add(center, h), v),
    add(add(center, scale(h, -1)), v),
    outward, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]);
}

/**
 * Shallow closed box on a wall: the exact 0..1 front face the sign or screen is
 * painted on, four thin sides, and a solid back so nothing reads through the
 * plate from behind. The back stands a centimetre off the wall, never on it.
 */
function plate(
  sink: PartSink, center: V3, normal: P2, w: number, h: number, depth: number, material: string, standoff = 0,
): void {
  const n: V3 = [normal[0], 0, normal[1]];
  const right: V3 = [normal[1], 0, -normal[0]];
  const up: V3 = [0, 1, 0];
  const back = standoff + PLATE_STANDOFF;
  const corner = (su: number, sv: number, proud: number): V3 =>
    add(add(add(center, scale(right, su * w / 2)), scale(up, sv * h / 2)), scale(n, proud));
  sink.quadFacing(material, corner(-1, -1, depth), corner(1, -1, depth), corner(1, 1, depth), corner(-1, 1, depth), n, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  sink.quadFacing(material, corner(1, -1, back), corner(-1, -1, back), corner(-1, 1, back), corner(1, 1, back), scale(n, -1), [[0, 1], [1, 1], [1, 0], [0, 0]]);
  const sides: [V3, V3, V3][] = [
    [corner(-1, 1, back), corner(1, 1, back), up],
    [corner(1, -1, back), corner(-1, -1, back), scale(up, -1)],
    [corner(-1, -1, back), corner(-1, 1, back), scale(right, -1)],
    [corner(1, 1, back), corner(1, -1, back), right],
  ];
  for (const [a, b, out] of sides) {
    sink.quadFacing(material, a, b, add(b, scale(n, depth - back)), add(a, scale(n, depth - back)), out, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
}

function meshFireEscape(mb: MeshBuilder, layout: Layout, above: FloorLayout[], mat: (k: string) => string): void {
  const fe = layout.fireEscape;
  if (!fe) return;
  const sink = mb.part('fire-escape');
  const ground = above[0]!;
  const fr = frame(ground.outline, fe.edge);
  const uc = fr.len / 2;
  const halfLen = FIRE_ESCAPE.platformLength / 2;
  const pw = FIRE_ESCAPE.platformWidth;
  const m = mat('fire-escape');
  const elevOf = new Map(above.map((f) => [f.index, f.elevation]));

  for (let i = fe.fromFloor; i <= fe.toFloor; i++) {
    const y = elevOf.get(i) as number;
    // Platform grate and front rail.
    sink.box(m, at(fr, [uc, y + 0.04], pw / 2), [fr.dir[0] * halfLen, 0, fr.dir[1] * halfLen], [0, 0.04, 0], [fr.n[0] * pw / 2, 0, fr.n[1] * pw / 2]);
    sink.box(m, at(fr, [uc, y + 0.53], pw - 0.025), [fr.dir[0] * halfLen, 0, fr.dir[1] * halfLen], [0, 0.45, 0], [fr.n[0] * 0.025, 0, fr.n[1] * 0.025]);
    // Run up to the next platform, zigzagging.
    if (i < fe.toFloor) {
      const yNext = elevOf.get(i + 1) as number;
      const even = i % 2 === 0;
      const uStart = even ? uc - halfLen + 0.3 : uc + halfLen - 0.3;
      const uEnd = even ? uc + halfLen - 0.3 : uc - halfLen + 0.3;
      sink.slantedBox(m, at(fr, [uStart, y + 0.08], pw / 2), at(fr, [uEnd, yNext], pw / 2), n3(fr), FIRE_ESCAPE.stairWidth, 0.08);
    }
  }
  // Drop ladder from the lowest platform, ending one floor above the street.
  const y1 = elevOf.get(fe.fromFloor) as number;
  sink.slantedBox(m, at(fr, [uc - halfLen + 0.2, y1], pw / 2), at(fr, [uc - halfLen + 0.2, Math.max(2.2, y1 - 2.5)], pw / 2 + 0.05), n3(fr), 0.38, 0.06);
}
