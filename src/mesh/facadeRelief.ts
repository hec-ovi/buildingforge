// Facade ribs and floor bands, including solid mitred joins at convex corners.

import { edgeDir, edgeLength, edgeNormal, type P2 } from '../core/polygon.ts';
import type { FloorLayout, Layout } from '../layout/model.ts';
import { capDown, capFrame, capUp } from './caps.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';

interface Frame { v: P2; dir: P2; n: P2; len: number }

export function meshFacadeRelief(
  mb: MeshBuilder, layout: Layout, above: FloorLayout[], top: number,
  mat: (kind: string) => string,
): void {
  const facade = layout.style.facade;
  if (facade.ribWidth <= 0 || above.length === 0) return;
  const sink = mb.part('facade-relief');
  const material = mat('wall-trim');

  layout.relief.byEdge.forEach((face, edge) => {
    const fr = frame(layout.relief.outline, edge);
    for (const u of face.ribs) {
      sink.box(material, at(fr, u, top / 2, facade.ribDepth / 2),
        [fr.dir[0] * facade.ribWidth / 2, 0, fr.dir[1] * facade.ribWidth / 2],
        [0, top / 2, 0],
        [fr.n[0] * facade.ribDepth / 2, 0, fr.n[1] * facade.ribDepth / 2]);
    }
  });

  for (const floor of above) {
    if (floor.index === 0) continue;
    const y0 = floor.elevation - facade.bandHeight / 2;
    const y1 = floor.elevation + facade.bandHeight / 2;
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const fr = frame(floor.outline, edge);
      sink.box(material, at(fr, fr.len / 2, floor.elevation, facade.bandProud / 2),
        [fr.dir[0] * fr.len / 2, 0, fr.dir[1] * fr.len / 2],
        [0, facade.bandHeight / 2, 0],
        [fr.n[0] * facade.bandProud / 2, 0, fr.n[1] * facade.bandProud / 2]);
    }
    meshCornerJoins(sink, floor.outline, y0, y1, facade.bandProud, material);
  }
}

function frame(outline: P2[], edge: number): Frame {
  return {
    v: outline[edge] as P2,
    dir: edgeDir(outline, edge),
    n: edgeNormal(outline, edge),
    len: edgeLength(outline, edge),
  };
}

function at(fr: Frame, u: number, y: number, proud: number): V3 {
  return [
    fr.v[0] + fr.dir[0] * u + fr.n[0] * proud,
    y,
    fr.v[1] + fr.dir[1] * u + fr.n[1] * proud,
  ];
}

/** Fill the wedge between adjacent band boxes, so the trim wraps as one piece. */
function meshCornerJoins(
  sink: PartSink, outline: P2[], y0: number, y1: number, depth: number, material: string,
): void {
  const caps = capFrame(outline);
  for (let index = 0; index < outline.length; index++) {
    const previous = (index + outline.length - 1) % outline.length;
    const previousDirection = edgeDir(outline, previous);
    const nextDirection = edgeDir(outline, index);
    if (cross2(previousDirection, nextDirection) <= 1e-8) continue;

    const vertex = outline[index] as P2;
    const previousNormal = edgeNormal(outline, previous);
    const nextNormal = edgeNormal(outline, index);
    const previousOuter = add2(vertex, scale2(previousNormal, depth));
    const nextOuter = add2(vertex, scale2(nextNormal, depth));
    const intersection = lineIntersection(previousOuter, previousDirection, nextOuter, nextDirection);
    const ring = intersection && distance2(vertex, intersection) <= depth * 4
      ? [vertex, previousOuter, intersection, nextOuter]
      : [vertex, previousOuter, nextOuter];

    capUp(sink, material, caps, ring, y1);
    capDown(sink, material, caps, ring, y0);
    for (let edge = 0; edge < ring.length; edge++) {
      const a = ring[edge] as P2;
      const b = ring[(edge + 1) % ring.length] as P2;
      const length = distance2(a, b);
      if (length < 1e-8) continue;
      const outward = edgeNormal(ring, edge);
      sink.quadFacing(material,
        [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]],
        [outward[0], 0, outward[1]], [[0, y1 - y0], [length, y1 - y0], [length, 0], [0, 0]]);
    }
  }
}

function lineIntersection(a: P2, da: P2, b: P2, db: P2): P2 | null {
  const divisor = cross2(da, db);
  if (Math.abs(divisor) < 1e-9) return null;
  const delta: P2 = [b[0] - a[0], b[1] - a[1]];
  const distance = cross2(delta, db) / divisor;
  return [a[0] + da[0] * distance, a[1] + da[1] * distance];
}

function cross2(a: P2, b: P2): number {
  return a[0] * b[1] - a[1] * b[0];
}

function add2(a: P2, b: P2): P2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function scale2(a: P2, scale: number): P2 {
  return [a[0] * scale, a[1] * scale];
}

function distance2(a: P2, b: P2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
