import type { FloorLayout, Layout } from '../api.ts';

export interface Reservation { u0: number; u1: number; y0: number; y1: number }

/** Attached members leave both traversable apertures and moving entrances clear. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Reservation[] {
  const result = floor.openings.filter(o => o.edge === edge && o.kind !== 'window').map(o => ({
    u0: o.offset - 0.18, u1: o.offset + o.width + 0.18,
    y0: floor.elevation + o.sill - 0.12, y1: floor.elevation + o.sill + o.height + 0.18,
  }));
  for (const cut of layout.carved) {
    if (cut.aperture.face !== edge || cut.aperture.kind === 'wire-anchor') continue;
    const points = cut.facePoly;
    result.push({ u0: Math.min(...points.map(p => p[0])) - 0.18, u1: Math.max(...points.map(p => p[0])) + 0.18,
      y0: Math.min(...points.map(p => p[1])) - 0.12, y1: Math.max(...points.map(p => p[1])) + 0.18 });
  }
  return result;
}

export function intersects(area: Reservation, reserved: Reservation[]): boolean {
  return reserved.some(r => area.u0 < r.u1 && area.u1 > r.u0 && area.y0 < r.y1 && area.y1 > r.y0);
}

export function verticalRuns(u0: number, u1: number, y0: number, y1: number, reserved: Reservation[]): [number, number][] {
  let runs: [number, number][] = [[y0, y1]];
  for (const r of reserved.filter(r => u0 < r.u1 && u1 > r.u0)) {
    runs = runs.flatMap(([a, b]) => r.y0 >= b || r.y1 <= a ? [[a, b] as [number, number]] :
      ([[a, Math.min(b, r.y0)], [Math.max(a, r.y1), b]] as [number, number][]).filter(([c, d]) => d - c > 0.04));
  }
  return runs;
}
