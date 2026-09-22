import { FacadeField, type FloorLayout, type Layout, type PartSink, type Point, type V3 } from '../api.ts';

export interface Rectangle { u0: number; u1: number; y0: number; y1: number }
export const rectangle = (u0: number, u1: number, y0: number, y1: number): Point[] => [[u0, y0], [u1, y0], [u1, y1], [u0, y1]];

/** The entire glazing, cassette and pocket travel envelope remains free of attachments. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Rectangle[] {
  const aligned = layout.floors.filter(source => source.index >= 0 && [edge, (edge + 1) % floor.outline.length].every(i =>
    source.outline[i] && Math.hypot(source.outline[i]![0] - floor.outline[i]![0], source.outline[i]![1] - floor.outline[i]![1]) < 1e-7));
  const holes: Rectangle[] = aligned.flatMap(source => source.openings.filter(o => o.edge === edge).map(o => {
    const fields = [o, o.glazing, o.door?.clearance, o.door?.cassette,
      ...(o.door?.motion.kind === 'pocket' ? o.door.motion.leaves.map(leaf => leaf.pocket) : [])].filter(f => f !== undefined);
    const margin = 0.04 + (o.door?.frameWidth ?? o.portal?.frameWidth ?? 0);
    return { u0: Math.min(...fields.map(f => f.offset)) - margin,
      u1: Math.max(...fields.map(f => f.offset + f.width)) + margin,
      y0: source.elevation + Math.min(...fields.map(f => f.sill)) - margin,
      y1: source.elevation + Math.max(...fields.map(f => f.sill + f.height)) + (o.transom ? o.transom + 0.1 : 0) + margin };
  }));
  for (const cut of layout.carved) if (cut.aperture.face === edge && cut.aperture.kind !== 'wire-anchor' && cut.facePoly.length) holes.push({
    u0: Math.min(...cut.facePoly.map(p => p[0])) - 0.04, u1: Math.max(...cut.facePoly.map(p => p[0])) + 0.04,
    y0: Math.min(...cut.facePoly.map(p => p[1])) - 0.04, y1: Math.max(...cut.facePoly.map(p => p[1])) + 0.04 });
  return holes.filter(hole => hole.y1 > floor.elevation && hole.y0 < floor.elevation + floor.height);
}

function clip(points: Point[], axis: 0 | 1, boundary: number, positive: boolean): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const da = (a[axis] - boundary) * (positive ? 1 : -1), db = (b[axis] - boundary) * (positive ? 1 : -1);
    if (da >= -1e-9) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

export function intersect(points: Point[], box: Rectangle): Point[] {
  return clip(clip(clip(clip(points, 0, box.u0, true), 0, box.u1, false), 1, box.y0, true), 1, box.y1, false);
}

/** Convex pieces give real front, back and cut returns; no brace bridges a reserved hole. */
export function panel(sink: PartSink, field: FacadeField, material: string, polygon: Point[], front: number, back: number, holes: Rectangle[]): void {
  let pieces = [polygon];
  for (const hole of holes) pieces = pieces.flatMap(p => {
    const middle = clip(clip(p, 0, hole.u0, true), 0, hole.u1, false);
    return [clip(p, 0, hole.u0, false), clip(p, 0, hole.u1, true),
      clip(middle, 1, hole.y0, false), clip(middle, 1, hole.y1, true)].filter(piece => piece.length >= 3);
  });
  const normal: V3 = [field.normal[0], 0, field.normal[1]];
  for (const raw of pieces) {
    const p = raw.filter((v, i) => { const prev = raw[(i + raw.length - 1) % raw.length]!; return Math.hypot(v[0] - prev[0], v[1] - prev[1]) > 1e-8; });
    const area = p.reduce((a, v, i) => { const next = p[(i + 1) % p.length]!; return a + v[0] * next[1] - next[0] * v[1]; }, 0);
    if (p.length < 3 || Math.abs(area) < 1e-8) continue;
    const point = (v: Point, depth: number) => field.point(v[0], v[1], depth);
    const uv = (v: Point): Point => [v[0], -v[1]];
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[0]!, b = p[i]!, c = p[i + 1]!;
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-8) continue;
      sink.triFacing(material, point(a, front), point(b, front), point(c, front), normal, [uv(a), uv(b), uv(c)]);
      sink.triFacing(material, point(a, back), point(b, back), point(c, back), [-normal[0], 0, -normal[2]], [uv(a), uv(b), uv(c)]);
    }
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!, b = p[(i + 1) % p.length]!, du = b[0] - a[0], dy = b[1] - a[1], sign = Math.sign(area);
      sink.quadFacing(material, point(a, front), point(b, front), point(b, back), point(a, back),
        [field.dir[0] * dy * sign, -du * sign, field.dir[1] * dy * sign],
        [[0, front], [Math.hypot(du, dy), front], [Math.hypot(du, dy), back], [0, back]]);
    }
  }
}

/** The full mitred corner, including diagonal displacement, stays within the parcel. */
export function projection(outline: Point[], parcel: Point[]): number {
  const distance = (p: Point, a: Point, b: Point) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], n = dx * dx + dz * dz;
    const t = n ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / n)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  };
  let clear = Infinity;
  for (const p of outline) for (let i = 0; i < parcel.length; i++) clear = Math.min(clear, distance(p, parcel[i]!, parcel[(i + 1) % parcel.length]!));
  return Math.min(0.82, clear / Math.SQRT2);
}
