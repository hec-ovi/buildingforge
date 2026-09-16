import { FacadeField, type DecorationContext, type FloorLayout, type PartSink, type Point, type V3 } from '../api.ts';
import { BODY_MARGIN } from './dimensions.ts';

type Rect = [number, number, number, number];

function subtract(rect: Rect, cut: Rect): Rect[] {
  const [x0, x1, y0, y1] = rect;
  const left = Math.max(x0, cut[0]), right = Math.min(x1, cut[1]);
  const bottom = Math.max(y0, cut[2]), top = Math.min(y1, cut[3]);
  if (left >= right || bottom >= top) return [rect];
  return [[x0, left, y0, y1], [right, x1, y0, y1], [left, right, y0, bottom], [left, right, top, y1]].filter(r => r[1]! - r[0]! > 1e-5 && r[3]! - r[2]! > 1e-5) as Rect[];
}

export class Surface {
  readonly field: FacadeField;
  readonly margin: number;
  readonly start: number;
  readonly end: number;
  private readonly skin: FacadeField;
  private readonly holes: { bounds: Rect; window: boolean }[];
  constructor(context: DecorationContext, floor: FloorLayout, edge: number) {
    this.field = new FacadeField(floor.outline, edge);
    const p = this.field.point(this.field.length / 2, 0, 0);
    let margin = BODY_MARGIN;
    const parcel = context.layout.request.parcel.footprint;
    for (let i = 0; i < parcel.length; i++) {
      const a = parcel[i]!, b = parcel[(i + 1) % parcel.length]!;
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const outX = dz / length, outZ = -dx / length;
      const approach = this.field.normal[0] * outX + this.field.normal[1] * outZ;
      if (approach > 1e-8) margin = Math.min(margin, ((a[0] - p[0]) * outX + (a[1] - p[2]) * outZ) / approach);
    }
    this.margin = Math.max(0, margin);
    this.start = Math.max(0, BODY_MARGIN - this.margin);
    this.end = this.field.length - this.start;
    const outline = floor.outline.map((_, i): Point => {
      const vertex = new FacadeField(floor.outline, i).point(0, 0, -this.start);
      return [vertex[0], vertex[2]];
    });
    this.skin = new FacadeField(outline, edge);
    this.holes = floor.openings.filter(o => o.edge === edge).map(o => {
      const bounds = o.door?.cassette ?? o;
      const pad = o.kind === 'window' ? 0.04 : 0.18;
      return { bounds: [bounds.offset - pad, bounds.offset + bounds.width + pad, floor.elevation + bounds.sill - pad, floor.elevation + bounds.sill + bounds.height + pad], window: o.kind === 'window' };
    });
    for (const c of context.layout.carved) {
      if (c.aperture.face !== edge || c.aperture.kind === 'wire-anchor') continue;
      const x = c.facePoly.map(p => p[0]), y = c.facePoly.map(p => p[1]);
      if (x.length) this.holes.push({ bounds: [Math.min(...x) - 0.2, Math.max(...x) + 0.2, Math.min(...y) - 0.2, Math.max(...y) + 0.2], window: false });
    }
  }
  clear(rect: Rect, ignoreWindows = false): boolean {
    return !this.holes.some(({ bounds: h, window }) => (!ignoreWindows || !window) && rect[0] < h[1] && rect[1] > h[0] && rect[2] < h[3] && rect[3] > h[2]);
  }
  point(u: number, y: number, depth: number): V3 { return this.skin.point(u - this.start, y, depth); }
  solid(part: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front = 0.1, back = 0, worldUv = true): void {
    u0 = Math.max(u0, this.start); u1 = Math.min(u1, this.end);
    if (u1 <= u0 || y1 <= y0) return;
    let pieces: Rect[] = [[u0, u1, y0, y1]];
    for (const hole of this.holes) pieces = pieces.flatMap(p => subtract(p, hole.bounds));
    for (const [a, b, c, d] of pieces) this.skin.solid(part, material, a - this.start, b - this.start, c, d, front, back, [0, 1], undefined, worldUv);
  }
  ramp(part: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front0: number, front1: number, back: number): void {
    const width = u1 - u0, slope = (front1 - front0) / width;
    const n = this.field.normal, dir = this.field.dir, length = Math.hypot(1, slope);
    const normal: V3 = [(n[0] - dir[0] * slope) / length, 0, (n[1] - dir[1] * slope) / length];
    let pieces: Rect[] = [[u0, u1, y0, y1]];
    for (const hole of this.holes) pieces = pieces.flatMap(p => subtract(p, hole.bounds));
    for (const [a, b, low, high] of pieces) {
      const fa = front0 + (a - u0) * slope, fb = front0 + (b - u0) * slope;
      const p = (u: number, y: number, d: number) => this.point(u, y, d);
      const uv: [number, number][] = [[a, -low], [b, -low], [b, -high], [a, -high]];
      part.quadFacing(material, p(a, low, fa), p(b, low, fb), p(b, high, fb), p(a, high, fa), normal, uv);
      part.quadFacing(material, p(a, low, back), p(b, low, back), p(b, high, back), p(a, high, back), [-n[0], 0, -n[1]], uv);
      part.quadFacing(material, p(a, low, back), p(b, low, back), p(b, low, fb), p(a, low, fa), [0, -1, 0], [[a, back], [b, back], [b, fb], [a, fa]]);
      part.quadFacing(material, p(a, high, back), p(b, high, back), p(b, high, fb), p(a, high, fa), [0, 1, 0], [[a, back], [b, back], [b, fb], [a, fa]]);
      for (const [u, front, sign] of [[a, fa, -1], [b, fb, 1]] as const) part.quadFacing(material, p(u, low, back), p(u, low, front), p(u, high, front), p(u, high, back), [dir[0] * sign, 0, dir[1] * sign], [[back, -low], [front, -low], [front, -high], [back, -high]]);
    }
  }
  panels(part: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, panelWidth: number, panelHeight: number, originY: number, front: number, originU = this.start + 0.5): void {
    const firstColumn = Math.floor((u0 - originU) / panelWidth);
    const firstRow = Math.floor((y0 - originY) / panelHeight);
    for (let column = firstColumn; originU + column * panelWidth < u1 - 1e-6; column++) {
      const left = originU + column * panelWidth, right = left + panelWidth;
      const a = Math.max(u0, left + 0.016), b = Math.min(u1, right - 0.016);
      for (let row = firstRow; originY + row * panelHeight < y1 - 1e-6; row++) {
        const low = originY + row * panelHeight, high = low + panelHeight;
        this.solid(part, material, a, b, Math.max(y0, low + 0.018), Math.min(y1, high - 0.018), front, front - 0.12);
      }
    }
  }
}
