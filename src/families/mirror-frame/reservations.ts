import type { FloorLayout, Layout } from '../api.ts';

export interface Rectangle { left: number; right: number; bottom: number; top: number }

/** Opening and connection reservations are removed from every attached panel. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Rectangle[] {
  const openings = floor.openings.filter(o => o.edge === edge).map(o => {
    const fields = [o, o.door?.cassette, o.door?.clearance].filter(f => f !== undefined);
    return {
      left: Math.min(...fields.map(f => f.offset)) - 0.025,
      right: Math.max(...fields.map(f => f.offset + f.width)) + 0.025,
      bottom: floor.elevation + Math.min(...fields.map(f => f.sill)) - 0.025,
      top: floor.elevation + Math.max(...fields.map(f => f.sill + f.height)) + (o.transom ? o.transom + 0.1 : 0) + 0.025,
    };
  });
  const connections = layout.carved.filter(c => c.aperture.face === edge).map(c => ({
    left: Math.min(...c.facePoly.map(p => p[0])) - 0.04, right: Math.max(...c.facePoly.map(p => p[0])) + 0.04,
    bottom: Math.min(...c.facePoly.map(p => p[1])) - 0.04, top: Math.max(...c.facePoly.map(p => p[1])) + 0.04,
  }));
  return [...openings, ...connections];
}

export function subtract(area: Rectangle, holes: Rectangle[]): Rectangle[] {
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
    ].filter(r => r.right - r.left > 1e-6 && r.top - r.bottom > 1e-6);
  });
  return pieces;
}
