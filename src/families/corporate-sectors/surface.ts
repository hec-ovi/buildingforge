import { FacadeField, type DecorationContext, type FloorLayout, type PartSink } from '../api.ts';

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
  private readonly shift: number;
  private readonly holes: Rect[];
  constructor(context: DecorationContext, floor: FloorLayout, edge: number) {
    this.field = new FacadeField(floor.outline, edge);
    const p = this.field.point(this.field.length / 2, 0, 0);
    let margin = 1.5;
    const parcel = context.layout.request.parcel.footprint;
    for (let i = 0; i < parcel.length; i++) {
      const a = parcel[i]!, b = parcel[(i + 1) % parcel.length]!;
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const outX = dz / length, outZ = -dx / length;
      const approach = this.field.normal[0] * outX + this.field.normal[1] * outZ;
      if (approach > 1e-8) margin = Math.min(margin, ((a[0] - p[0]) * outX + (a[1] - p[2]) * outZ) / approach);
    }
    this.margin = Math.max(0, margin - 0.025);
    this.shift = floor.index >= 4 ? Math.max(0, 1.45 - this.margin) : 0;
    this.holes = floor.openings.filter(o => o.edge === edge).map(o => {
      const bounds = o.door?.cassette ?? o;
      const pad = o.kind === 'window' ? 0.04 : 0.18;
      return [bounds.offset - pad, bounds.offset + bounds.width + pad, floor.elevation + bounds.sill - pad, floor.elevation + bounds.sill + bounds.height + pad];
    });
    for (const c of context.layout.carved) {
      if (c.aperture.face !== edge || c.aperture.kind === 'wire-anchor') continue;
      const x = c.facePoly.map(p => p[0]), y = c.facePoly.map(p => p[1]);
      if (x.length) this.holes.push([Math.min(...x) - 0.2, Math.max(...x) + 0.2, Math.min(...y) - 0.2, Math.max(...y) + 0.2]);
    }
  }
  clear(rect: Rect): boolean {
    return !this.holes.some(h => rect[0] < h[1] && rect[1] > h[0] && rect[2] < h[3] && rect[3] > h[2]);
  }
  depth(front: number): number { return front - this.shift; }
  solid(part: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, front = 0.1, back = 0, worldUv = true): void {
    if (u1 <= u0 || y1 <= y0) return;
    const shift = this.shift || Math.max(0, front - this.margin);
    let pieces: Rect[] = [[u0, u1, y0, y1]];
    for (const hole of this.holes) pieces = pieces.flatMap(p => subtract(p, hole));
    for (const r of pieces) this.field.solid(part, material, ...r, front - shift, back - shift, [0, 1], undefined, worldUv);
  }
  panels(part: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, panelWidth: number, panelHeight: number, origin: number, front: number): void {
    const count = Math.max(1, Math.round((u1 - u0) / panelWidth));
    const width = (u1 - u0) / count;
    const first = Math.floor((y0 - origin) / panelHeight);
    for (let i = 0; i < count; i++) for (let row = first; origin + row * panelHeight < y1 - 1e-6; row++) {
      const low = origin + row * panelHeight, high = low + panelHeight;
      this.solid(part, material, u0 + i * width + 0.016, u0 + (i + 1) * width - 0.016, Math.max(y0, low + 0.018), Math.min(y1, high - 0.018), front, front - 0.12);
    }
  }
}
