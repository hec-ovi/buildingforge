import { FacadeField, cutWall, rectHole, type FloorLayout, type Layout, type PartSink, type Point, type V3 } from '../api.ts';

export interface Area { left: number; right: number; bottom: number; top: number }

/** Family skin and attached parts use the openings produced by the host, including stair doors. */
export class Surface {
  readonly field: FacadeField;
  readonly holes: { poly: Point[] }[];
  readonly passages: Area[];
  readonly layout: Layout;

  constructor(layout: Layout, floor: FloorLayout, edge: number) {
    this.layout = layout;
    this.field = new FacadeField(floor.outline, edge);
    this.passages = [];
    this.holes = floor.openings.filter(o => o.edge === edge).map(o => {
      const bounds = [o, o.glazing, o.door?.cassette, o.door?.clearance,
        ...(o.door?.motion.kind === 'pocket' ? o.door.motion.leaves.map(l => l.pocket) : [])].filter(p => p !== undefined);
      const pad = o.kind === 'window' ? .015 : .12 + Math.max(o.door?.frameWidth ?? 0, o.portal?.frameWidth ?? 0);
      const area = { left: Math.min(...bounds.map(p => p.offset)) - pad,
        right: Math.max(...bounds.map(p => p.offset + p.width)) + pad,
        bottom: floor.elevation + Math.min(...bounds.map(p => p.sill)) - pad,
        top: floor.elevation + Math.max(...bounds.map(p => p.sill + p.height)) + (o.transom ?? 0) + pad };
      if (o.kind !== 'window') this.passages.push(area);
      return rectHole(area.left, area.bottom, area.right - area.left, area.top - area.bottom);
    });
    for (const cut of layout.carved ?? []) {
      if (cut.aperture.face !== edge || cut.aperture.kind === 'wire-anchor') continue;
      const area = { left: Math.min(...cut.facePoly.map(p => p[0])) - .12, right: Math.max(...cut.facePoly.map(p => p[0])) + .12,
        bottom: Math.min(...cut.facePoly.map(p => p[1])) - .12, top: Math.max(...cut.facePoly.map(p => p[1])) + .12 };
      this.passages.push(area);
      this.holes.push(rectHole(area.left, area.bottom, area.right - area.left, area.top - area.bottom));
    }
  }

  clear(area: Area): boolean {
    return !this.passages.some(p => p.left < area.right && p.right > area.left && p.bottom < area.top && p.top > area.bottom);
  }

  depth(u0: number, u1: number, wanted: number): number {
    const parcel = this.layout.request.parcel.footprint;
    const inside = (p: V3) => parcel.every((a, i) => {
      const b = parcel[(i + 1) % parcel.length]!;
      return (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-8;
    });
    let lo = 0, hi = wanted;
    for (let i = 0; i < 25; i++) {
      const d = (lo + hi) / 2;
      if (inside(this.field.point(u0, 0, d)) && inside(this.field.point(u1, 0, d))) lo = d;
      else hi = d;
    }
    return lo < 1e-6 ? 0 : lo;
  }

  solid(sink: PartSink, material: string, area: Area, wantedFront: number, back = -.22): void {
    const { left, right, bottom, top } = area;
    if (right <= left || top <= bottom) return;
    const front = this.depth(left, right, wantedFront);
    const holes = this.holes.map(({ poly }) => ({ poly: poly.map(([u, y]): Point => [u - left, y]) }));
    for (const local of cutWall(right - left, bottom, top, holes)) {
      const corners = [local.bl, local.br, local.tr, local.tl].map(([u, y]): Point => [u + left, y]);
      const at = ([u, y]: Point, d: number) => this.field.point(u, y, d), n: V3 = [this.field.normal[0], 0, this.field.normal[1]];
      sink.quadFacing(material, at(corners[0]!, front), at(corners[1]!, front), at(corners[2]!, front), at(corners[3]!, front), n,
        corners.map(([u, y]): Point => [u, -y]));
      for (let i = 0; i < 4; i++) {
        const a = corners[i]!, b = corners[(i + 1) % 4]!, dx = b[0] - a[0], dy = b[1] - a[1];
        sink.quadFacing(material, at(a, front), at(b, front), at(b, back), at(a, back),
          [this.field.dir[0] * dy, -dx, this.field.dir[1] * dy],
          [[0, 0], [Math.hypot(dx, dy), 0], [Math.hypot(dx, dy), front - back], [0, front - back]]);
      }
    }
  }
}
