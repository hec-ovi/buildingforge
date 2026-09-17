import { FacadeField, cutWall, rectHole, type FloorLayout, type Layout, type PartSink, type Point, type V3 } from '../api.ts';

/** Face-local decoration is clipped to the same doorway and bridge reservations. */
export class Surface {
  readonly layout: Layout;
  readonly edge: number;
  readonly field: FacadeField;
  readonly holes: { poly: Point[] }[];
  readonly front: number;

  constructor(layout: Layout, floor: FloorLayout, edge: number) {
    this.layout = layout;
    this.edge = edge;
    this.field = new FacadeField(floor.outline, edge);
    this.holes = floor.openings.filter(o => o.edge === edge).map(o => {
      const e = o.door?.cassette ?? o.door?.clearance ?? o;
      return rectHole(e.offset - 0.04, floor.elevation + e.sill - 0.04, e.width + 0.08, e.height + 0.08);
    });
    for (const c of layout.carved ?? []) if (c.aperture.face === edge) this.holes.push({ poly: c.facePoly });
    this.front = this.fittedDepth(0.12);
  }

  private fittedDepth(wanted: number): number {
    const parcel = this.layout.request.parcel.footprint;
    const inside = (p: V3) => parcel.every((a, i) => {
      const b = parcel[(i + 1) % parcel.length]!;
      return (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-8;
    });
    let lo = 0, hi = wanted;
    for (let step = 0; step < 24; step++) {
      const depth = (lo + hi) / 2;
      if (inside(this.field.point(0, 0, depth)) && inside(this.field.point(this.field.length, 0, depth))) lo = depth;
      else hi = depth;
    }
    return lo < 1e-6 ? 0 : lo;
  }

  clear(u0: number, u1: number, y0: number, y1: number): boolean {
    return !this.holes.some(({ poly }) => Math.max(...poly.map(p => p[0])) > u0
      && Math.min(...poly.map(p => p[0])) < u1 && Math.max(...poly.map(p => p[1])) > y0
      && Math.min(...poly.map(p => p[1])) < y1);
  }

  /** `seated` blocks sit on the closed wall field, so their rear face is dropped. */
  solid(sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front = this.front, thickness = 0.09, seated = false): void {
    if (u1 <= u0 || y1 <= y0) return;
    const holes = this.holes.map(({ poly }) => ({ poly: poly.map(([u, y]): Point => [u - u0, y]) }));
    for (const local of cutWall(u1 - u0, y0, y1, holes)) {
      const shift = ([u, y]: Point): Point => [u + u0, y];
      const p = { bl: shift(local.bl), br: shift(local.br), tr: shift(local.tr), tl: shift(local.tl) };
      const coords = [p.bl, p.br, p.tr, p.tl];
      const uv = coords.map(([u, y]): Point => [u, -y]);
      const at = ([u, y]: Point, d: number) => this.field.point(u, y, d);
      const n: V3 = [this.field.normal[0], 0, this.field.normal[1]];
      sink.quadFacing(material, at(p.bl, front), at(p.br, front), at(p.tr, front), at(p.tl, front), n, uv);
      if (!seated) sink.quadFacing(material, at(p.bl, front - thickness), at(p.br, front - thickness), at(p.tr, front - thickness), at(p.tl, front - thickness), [-n[0], 0, -n[2]], uv);
      for (let i = 0; i < 4; i++) {
        const a = coords[i]!, b = coords[(i + 1) % 4]!;
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const outward: V3 = [this.field.dir[0] * dy, -dx, this.field.dir[1] * dy];
        sink.quadFacing(material, at(a, front), at(b, front), at(b, front - thickness), at(a, front - thickness), outward,
          [[0, 0], [Math.hypot(dx, dy), 0], [Math.hypot(dx, dy), thickness], [0, thickness]]);
      }
    }
  }
}
