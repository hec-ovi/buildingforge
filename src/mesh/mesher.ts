// Turns a Layout into mesh parts. Every visible face goes through quadFacing or
// the cap winding check, so nothing can face inward.

import { MeshBuilder, type PartSink, type V3, add, scale } from './primitives.ts';
import { cutWall, rectHole, type Hole } from './wallcut.ts';
import { capUp, capDown } from './caps.ts';
import { edgeDir, edgeNormal, edgeLength, type P2 } from '../core/polygon.ts';
import { BALCONY, FIRE_ESCAPE, SIGNAGE } from '../rules/tables.ts';
import { glyphKind, glyphUv, isBlank } from '../rules/glyphs.ts';
import { paneGrid } from '../layout/glazing.ts';
import type { Layout, FloorLayout, Style } from '../layout/model.ts';
import type { Blueprint, Opening } from '../types.ts';

const REVEAL = 0.12;
const APERTURE_REVEAL = 0.15;

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

  // Floor separator planes, faced both ways: seen from below through the glazing
  // a one-sided slab is invisible and the shell reads hollow.
  for (const f of floors) {
    const sink = mb.part(`floor:${f.index}/slab`);
    capUp(sink, mat('floor-slab'), f.outline, f.elevation);
    capDown(sink, mat('floor-slab'), f.outline, f.elevation);
  }

  // Terrace rings where the outline steps inward.
  for (let i = 1; i < above.length; i++) {
    const prev = above[i - 1]!, cur = above[i]!;
    if (prev.outline !== cur.outline) {
      capUp(mb.part(`terrace:${cur.index}`), mat('roof'), prev.outline, cur.elevation, cur.outline);
    }
  }

  // Walls with holes, then per-opening geometry.
  for (const f of floors) {
    for (let e = 0; e < f.outline.length; e++) {
      const fr = frame(f.outline, e);
      const holes: Hole[] = [];
      for (const o of f.openings) {
        if (o.edge !== e) continue;
        if (o.kind === 'door' || o.kind === 'balconyDoor') {
          holes.push(rectHole(o.offset, f.elevation + o.sill, o.width, o.height));
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

  // Roof, parapet, bottom cap. The roof is the top floor's ceiling too.
  const roofSink = mb.part('roof');
  capUp(roofSink, mat('roof'), topFloor.outline, top);
  capDown(roofSink, mat('floor-slab'), topFloor.outline, top);
  capDown(mb.part('base'), mat('floor-slab'), lowest.outline, lowest.elevation);
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
    const sink = mb.part(o.kind === 'door' ? `door:${o.id}` : `balcony:${o.id}`);
    reveal(sink, fr, [[u0, yb], [u1, yb], [u1, yt], [u0, yt]], REVEAL, o.sill > 0.01, mat('wall-trim'));
    // Leaf recessed at the reveal depth.
    const leafMat = o.material ?? mat('door');
    sink.quadFacing(leafMat, at(fr, [u0, yb], -REVEAL), at(fr, [u1, yb], -REVEAL), at(fr, [u1, yt], -REVEAL), at(fr, [u0, yt], -REVEAL), n3(fr), [[0, 1], [1, 1], [1, 0], [0, 0]]);
    // Trim strips proud around the hole.
    const t = 0.08;
    strip(sink, fr, u0 - t, u1 + t, yt, yt + t, 0.03, mat('wall-trim'));
    strip(sink, fr, u0 - t, u0, yb, yt, 0.03, mat('wall-trim'));
    strip(sink, fr, u1, u1 + t, yb, yt, 0.03, mat('wall-trim'));
    if (o.kind === 'balconyDoor' && o.balcony) meshBalcony(sink, fr, o, f.elevation, mat);
    return;
  }
  // Aperture: reveal ring around the exact cut, mouth left open.
  const sink = mb.part(`aperture:${o.id}`);
  const carved = layout.carved.find((c) => c.aperture.id === o.id);
  if (carved) reveal(sink, fr, carved.facePoly, APERTURE_REVEAL, true, o.material ?? mat('aperture-frame'));
}

/**
 * A window unit: a frame profile standing proud of the wall with real reveal
 * depth, a mullion grid splitting the opening into panes no larger than the
 * tier's structural limit, and the glass recessed behind the profile.
 */
function windowUnit(
  sink: PartSink, fr: Frame, u0: number, u1: number, yb: number, yt: number,
  o: Opening, style: Style, mat: (k: string) => string,
): void {
  const g = style.glazing;
  const fw = Math.min(g.frameWidth, (u1 - u0) / 4, (yt - yb) / 4);
  const depth = g.frameProud + g.glassInset;
  const g0 = u0 + fw, g1 = u1 - fw, gb = yb + fw, gt = yt - fw;
  const frameMat = mat('window-frame');

  // Deep-set styles sink the whole unit into the wall behind a reveal ring.
  const recess = style.facade.windowRecess;
  const z = -recess;
  if (recess > 0.02) {
    reveal(sink, fr, [[u0, yb], [u1, yb], [u1, yt], [u0, yt]], recess, true, mat('wall-trim'));
  }
  const proud = g.frameProud + z;

  member(sink, fr, u0, u1, yt - fw, yt, proud, depth, frameMat, { bottom: true });
  member(sink, fr, u0, u1, yb, yb + fw, proud, depth, frameMat, { top: true });
  member(sink, fr, u0, g0, gb, gt, proud, depth, frameMat, { right: true });
  member(sink, fr, g1, u1, gb, gt, proud, depth, frameMat, { left: true });

  const { cols, rows } = o.panes ?? paneGrid(u1 - u0, yt - yb, g);
  const mw = Math.min(g.mullionWidth, (g1 - g0) / (cols * 2), (gt - gb) / (rows * 2));
  const mProud = g.frameProud * 0.7 + z;
  const mDepth = g.frameProud * 0.7 + g.glassInset;
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
  strip(sink, fr, u0, u1, y0, y1, proud, material);
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
    outward, [[0, 0], [depth, 0], [depth, h], [0, h]]);
}

/** Horizontal reveal face at y, normal +Y or -Y by s. */
function revealY(
  sink: PartSink, fr: Frame, u0: number, u1: number, y: number,
  proud: number, back: number, s: number, depth: number, material: string,
): void {
  const w = u1 - u0;
  sink.quadFacing(material,
    at(fr, [u0, y], proud), at(fr, [u1, y], proud), at(fr, [u1, y], back), at(fr, [u0, y], back),
    [0, s, 0], [[0, 0], [w, 0], [w, depth], [0, depth]]);
}

/** Proud flat plate on the wall plane (frames, trims), world-scale UVs so tiles never stretch. */
function strip(sink: PartSink, fr: Frame, u0: number, u1: number, y0: number, y1: number, proud: number, material: string): void {
  if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
  const w = u1 - u0, h = y1 - y0;
  sink.quadFacing(material, at(fr, [u0, y0], proud), at(fr, [u1, y0], proud), at(fr, [u1, y1], proud), at(fr, [u0, y1], proud), n3(fr), [[0, 0], [w, 0], [w, h], [0, h]]);
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
  if (f.ribWidth <= 0 || above.length === 0) return;
  const sink = mb.part('facade-relief');
  const material = mat('wall-trim');
  const ground = above[0]!;
  const constantOutline = above.every((fl) => fl.outline === ground.outline);

  if (constantOutline) {
    for (let e = 0; e < ground.outline.length; e++) {
      const fr = frame(ground.outline, e);
      for (let u = f.panelModule; u < fr.len - f.ribWidth / 2; u += f.panelModule) {
        sink.box(material, at(fr, [u, top / 2], f.ribDepth / 2),
          [fr.dir[0] * f.ribWidth / 2, 0, fr.dir[1] * f.ribWidth / 2],
          [0, top / 2, 0],
          [fr.n[0] * f.ribDepth / 2, 0, fr.n[1] * f.ribDepth / 2]);
      }
    }
  }

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
  if (layout.facadeArtifacts.length === 0) return;
  const sink = mb.part('facade-artifacts');
  const byFloor = new Map(layout.floors.map((f) => [f.index, f]));
  for (const a of layout.facadeArtifacts) {
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

function meshColumns(mb: MeshBuilder, layout: Layout, above: FloorLayout[], top: number, mat: (k: string) => string): void {
  if (!layout.style.showColumns) return;
  const ground = above[0]!;
  if (above.some((f) => f.outline !== ground.outline)) return;
  const sink = mb.part('columns');
  const w = layout.style.columnWidth;
  for (let e = 0; e < ground.outline.length; e++) {
    const fr = frame(ground.outline, e);
    const forbidden: [number, number][] = [];
    for (const f of above) for (const o of f.openings) if (o.edge === e) forbidden.push([o.offset - 0.2, o.offset + o.width + 0.2]);
    for (const c of layout.carved) if (c.aperture.face === e) {
      const us = c.facePoly.map((p) => p[0]);
      forbidden.push([Math.min(...us) - 0.2, Math.max(...us) + 0.2]);
    }
    for (let u = layout.style.columnSpacing; u < fr.len - w; u += layout.style.columnSpacing) {
      if (forbidden.some(([a, b]) => u + w / 2 > a && u - w / 2 < b)) continue;
      sink.box(mat('column'), at(fr, [u, top / 2], 0.06), [fr.dir[0] * w / 2, 0, fr.dir[1] * w / 2], [0, top / 2, 0], [fr.n[0] * 0.06, 0, fr.n[1] * 0.06]);
    }
  }
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
  layout.screens.forEach((s, i) => plate(mb.part(`screen:${i}`), s.center, s.normal, s.width, s.height, 0.1, mat('ad-screen')));
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
    plate(sink, s.center, s.normal, s.width, s.height, depth, frame);
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
  const half = s.width / 2;
  const center = add(s.center, scale(n, depth / 2));
  sink.box(frame, center, scale(right, half), scale(up, s.height / 2), scale(n, depth / 2));
  if (!cell) return;
  const size = Math.min(cell * SIGNAGE.glyphFill, depth * 0.8);
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (isBlank(char)) continue;
    const cy = s.height / 2 - SIGNAGE.framePad - (i + 0.5) * cell;
    for (const side of [1, -1]) {
      const outward = scale(right, side);
      const at3 = add(add(center, scale(up, cy)), scale(right, side * (half + 0.01)));
      glyphQuad(sink, glyph, at3, scale(n, -1), up, size, outward, char);
    }
  }
}

/** One letter cell: a quad facing `outward`, UV-picked from the letter atlas when there is one. */
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

/** Shallow box on a wall: exact 0..1 front face plus four thin sides, no back. */
function plate(sink: PartSink, center: V3, normal: P2, w: number, h: number, depth: number, material: string): void {
  const n: V3 = [normal[0], 0, normal[1]];
  const right: V3 = [normal[1], 0, -normal[0]];
  const up: V3 = [0, 1, 0];
  const corner = (su: number, sv: number, proud: boolean): V3 =>
    add(add(add(center, scale(right, su * w / 2)), scale(up, sv * h / 2)), scale(n, proud ? depth : 0));
  sink.quadFacing(material, corner(-1, -1, true), corner(1, -1, true), corner(1, 1, true), corner(-1, 1, true), n, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  const sides: [V3, V3, V3][] = [
    [corner(-1, 1, false), corner(1, 1, false), up],
    [corner(1, -1, false), corner(-1, -1, false), scale(up, -1)],
    [corner(-1, -1, false), corner(-1, 1, false), scale(right, -1)],
    [corner(1, 1, false), corner(1, -1, false), right],
  ];
  for (const [a, b, out] of sides) {
    sink.quadFacing(material, a, b, add(b, scale(n, depth)), add(a, scale(n, depth)), out, [[0, 0], [1, 0], [1, 1], [0, 1]]);
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
