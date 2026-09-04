// Facade ribs and floor bands, including solid mitred joins at convex corners.

import { edgeDir, edgeLength, edgeNormal, type P2 } from '../core/polygon.ts';
import type { FloorLayout, Layout } from '../layout/model.ts';
import { capDown, capFrame, capUp } from './caps.ts';
import { meshBandRun } from './bandRun.ts';
import { meshStructuralPier } from './structuralPier.ts';
import type { MeshBuilder, PartSink } from './primitives.ts';

interface Frame { v: P2; dir: P2; n: P2; len: number }

export function meshFacadeRelief(
  mb: MeshBuilder, layout: Layout, above: FloorLayout[], top: number,
  mat: (kind: string) => string,
): void {
  const facade = layout.style.facade;
  if (above.length === 0) return;
  const sink = mb.part('facade-relief');
  const ribs = mb.part('facade-ribs');
  const material = mat('wall-trim');

  layout.relief.byEdge.forEach((face, edge) => {
    const fr = frame(layout.relief.outline, edge);
    for (const u of face.ribs) {
      const base = layout.relief.verticalBase;
      if (top <= base) continue;
      meshStructuralPier(ribs, fr, u, layout.relief.ribWidth, base, top,
        layout.relief.ribDepth, mat('column'));
    }
  });

  for (const floor of above) {
    if (floor.index === 0 || facade.bandHeight <= 0) continue;
    const y0 = floor.elevation - facade.bandHeight / 2;
    const y1 = floor.elevation + facade.bandHeight / 2;
    const corners = floor.outline.map((_, index) => cornerJoin(floor.outline, index, facade.bandProud));
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const fr = frame(floor.outline, edge);
      const start = corners[edge]!;
      const end = corners[(edge + 1) % corners.length]!;
      meshBandRun(sink, fr, y0, y1, start.next, end.previous, material);
    }
    meshCornerJoins(sink, corners, y0, y1, material, capFrame(floor.outline));
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

/** Add only the exposed face of a bounded bevel when a miter would grow too long. */
interface CornerJoin { previous: P2; next: P2; bevel?: P2[] }

function meshCornerJoins(
  sink: PartSink, corners: CornerJoin[], y0: number, y1: number,
  material: string, caps: ReturnType<typeof capFrame>,
): void {
  for (const { bevel: ring } of corners) {
    if (!ring) continue;
    capUp(sink, material, caps, ring, y1);
    capDown(sink, material, caps, ring, y0);
    // The two faces back to the wall are shared with the open run ends. Only
    // the exposed outside boundary belongs to the corner join.
    for (let edge = 1; edge < ring.length - 1; edge++) {
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

function cornerJoin(outline: P2[], index: number, depth: number): CornerJoin {
  const previous = (index + outline.length - 1) % outline.length;
  const previousDirection = edgeDir(outline, previous);
  const nextDirection = edgeDir(outline, index);
  const vertex = outline[index] as P2;
  const previousOuter = add2(vertex, scale2(edgeNormal(outline, previous), depth));
  const nextOuter = add2(vertex, scale2(edgeNormal(outline, index), depth));
  const turn = cross2(previousDirection, nextDirection);
  const intersection = lineIntersection(previousOuter, previousDirection, nextOuter, nextDirection);

  if (intersection && (turn < 0 || distance2(vertex, intersection) <= depth * 4)) {
    return { previous: intersection, next: intersection };
  }
  if (Math.abs(turn) <= 1e-8) {
    const shared: P2 = [(previousOuter[0] + nextOuter[0]) / 2, (previousOuter[1] + nextOuter[1]) / 2];
    return { previous: shared, next: shared };
  }
  return { previous: previousOuter, next: nextOuter, bevel: [vertex, previousOuter, nextOuter] };
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
