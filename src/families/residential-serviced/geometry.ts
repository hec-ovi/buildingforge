import type { FacadeField, FloorLayout, Layout, PartSink, Point } from '../api.ts';

export interface Box { u0: number; u1: number; y0: number; y1: number }
export const overlaps = (a: Box, b: Box): boolean => a.u1 > b.u0 && a.u0 < b.u1 && a.y1 > b.y0 && a.y0 < b.y1;

function openingReservations(floor: FloorLayout, edge: number): Box[] {
  return floor.openings.filter(o => o.edge === edge).map(o => {
    const fields = [o, o.glazing, o.door?.clearance, o.door?.cassette,
      ...(o.door?.motion.kind === 'pocket' ? o.door.motion.leaves.map(l => l.pocket) : [])].filter(f => f !== undefined);
    const margin = 0.04 + Math.max(o.door?.frameWidth ?? 0, o.portal?.frameWidth ?? 0);
    return { u0: Math.min(...fields.map(f => f.offset)) - margin, u1: Math.max(...fields.map(f => f.offset + f.width)) + margin,
      y0: floor.elevation + Math.min(...fields.map(f => f.sill)) - 0.04,
      y1: floor.elevation + Math.max(...fields.map(f => f.sill + f.height)) + (o.transom ?? 0) + margin };
  });
}

/** Reserve the whole opening assembly, including pockets and approach/movement clearances. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Box[] {
  const aligned = layout.floors.filter(f => f.outline.length === floor.outline.length && f.outline.every((p, i) =>
    Math.hypot(p[0] - floor.outline[i]![0], p[1] - floor.outline[i]![1]) < 1e-7));
  const result = aligned.flatMap(f => openingReservations(f, edge));
  for (const cut of layout.carved) if (cut.aperture.face === edge) result.push({
    u0: Math.min(...cut.facePoly.map(p => p[0])) - 0.04, u1: Math.max(...cut.facePoly.map(p => p[0])) + 0.04,
    y0: Math.min(...cut.facePoly.map(p => p[1])) - 0.04, y1: Math.max(...cut.facePoly.map(p => p[1])) + 0.04 });
  return result;
}

function subtract(a: Box, b: Box): Box[] {
  if (!overlaps(a, b)) return [a];
  const u0 = Math.max(a.u0, b.u0), u1 = Math.min(a.u1, b.u1);
  return [{ ...a, u1: Math.min(a.u1, b.u0) }, { ...a, u0: Math.max(a.u0, b.u1) },
    { u0, u1, y0: a.y0, y1: Math.min(a.y1, b.y0) }, { u0, u1, y0: Math.max(a.y0, b.y1), y1: a.y1 }]
    .filter(p => p.u1 - p.u0 > 1e-7 && p.y1 - p.y0 > 1e-7);
}

/** Fitted fronts and cut returns; the host shell owns the hidden rear closure. */
export function panel(sink: PartSink, field: FacadeField, material: string, box: Box, front: number, back: number, holes: Box[]): void {
  const pieces = holes.reduce((parts, hole) => parts.flatMap(p => subtract(p, hole)), [box]);
  for (const p of pieces) field.solid(sink, material, p.u0, p.u1, p.y0, p.y1, front, back,
    [p.u0, p.u1], { start: true, end: true, back: false }, true);
}

/** Sutherland–Hodgman intersection for contract checks against rectangular reservations. */
export function intersect(points: Point[], box: Box): Point[] {
  let result = points;
  for (const [axis, bound, sign] of [[0, box.u0, 1], [0, box.u1, -1], [1, box.y0, 1], [1, box.y1, -1]] as const) {
    const output: Point[] = [];
    for (let i = 0; i < result.length; i++) {
      const a = result[i]!, b = result[(i + 1) % result.length]!, da = (a[axis] - bound) * sign, db = (b[axis] - bound) * sign;
      if (da >= -1e-9) output.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    result = output;
  }
  return result;
}
