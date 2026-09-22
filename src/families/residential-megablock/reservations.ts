import type { FloorLayout, Layout } from '../api.ts';

export interface Area { left: number; right: number; bottom: number; top: number }

/** Include sliding pockets, transoms, and connection cuts in the permanent skin. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Area[] {
  const openings = floor.openings.filter(o => o.edge === edge).map(o => {
    const bounds = [o, o.door?.cassette, o.door?.clearance].filter(f => f !== undefined);
    return { left: Math.min(...bounds.map(f => f.offset)) - 0.012,
      right: Math.max(...bounds.map(f => f.offset + f.width)) + 0.012,
      bottom: floor.elevation + Math.min(...bounds.map(f => f.sill)) - 0.012,
      top: floor.elevation + Math.max(...bounds.map(f => f.sill + f.height)) + (o.transom ? o.transom + 0.1 : 0) + 0.012 };
  });
  return [...openings, ...layout.carved.filter(c => c.aperture.face === edge && c.facePoly.length > 0).map(c => ({
    left: Math.min(...c.facePoly.map(p => p[0])) - 0.04, right: Math.max(...c.facePoly.map(p => p[0])) + 0.04,
    bottom: Math.min(...c.facePoly.map(p => p[1])) - 0.04, top: Math.max(...c.facePoly.map(p => p[1])) + 0.04,
  }))];
}

export function subtract(area: Area, holes: Area[]): Area[] {
  let pieces = [area];
  for (const hole of holes) pieces = pieces.flatMap(p => {
    const left = Math.max(p.left, hole.left), right = Math.min(p.right, hole.right);
    const bottom = Math.max(p.bottom, hole.bottom), top = Math.min(p.top, hole.top);
    if (left >= right || bottom >= top) return [p];
    return [
      { left: p.left, right: left, bottom: p.bottom, top: p.top },
      { left: right, right: p.right, bottom: p.bottom, top: p.top },
      { left, right, bottom: p.bottom, top: bottom },
      { left, right, bottom: top, top: p.top },
    ].filter(r => r.right - r.left > 1e-7 && r.top - r.bottom > 1e-7);
  });
  return pieces;
}
