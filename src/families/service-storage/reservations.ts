import { FacadeField, type FloorLayout, type Layout } from '../api.ts';
import { dimensions as d } from './dimensions.ts';

export interface Rectangle { left: number; right: number; bottom: number; top: number }

/** Face-plane union is deliberately kept clear at every decoration depth. */
export function reservations(layout: Layout, floor: FloorLayout, edge: number): Rectangle[] {
  const result: Rectangle[] = [];
  for (const source of layout.floors) {
    // Upper floors share the authored grid; basement walls can have other faces.
    if (source.index < 0 || !sameFace(source, floor, edge)) continue;
    for (const opening of source.openings.filter(o => o.edge === edge)) {
      const door = opening.door;
      const fields = [opening, door?.cassette, door?.clearance, opening.glazing,
        ...(door?.motion.kind === 'pocket' ? door.motion.leaves.map(l => l.pocket) : [])]
        .filter(f => f !== undefined);
      const traversable = ['door', 'balconyDoor', 'openFront', 'aperture'].includes(opening.kind);
      const margin = (traversable ? d.approachMargin : d.openingMargin) + (door?.frameWidth ?? opening.portal?.frameWidth ?? 0);
      result.push({
        left: Math.min(...fields.map(f => f.offset)) - margin,
        right: Math.max(...fields.map(f => f.offset + f.width)) + margin,
        bottom: source.elevation + Math.min(...fields.map(f => f.sill)) - margin,
        top: source.elevation + Math.max(...fields.map(f => f.sill + f.height))
          + (opening.transom ? opening.transom + 0.1 : 0) + margin,
      });
    }
  }
  for (const cut of layout.carved) {
    if (cut.aperture.face !== edge || cut.aperture.kind === 'wire-anchor' || !cut.facePoly.length) continue;
    result.push({
      left: Math.min(...cut.facePoly.map(p => p[0])) - d.approachMargin,
      right: Math.max(...cut.facePoly.map(p => p[0])) + d.approachMargin,
      bottom: Math.min(...cut.facePoly.map(p => p[1])) - d.approachMargin,
      top: Math.max(...cut.facePoly.map(p => p[1])) + d.approachMargin,
    });
  }
  const field = new FacadeField(floor.outline, edge);
  const worldRect = (position: [number, number, number], width: number, height: number) => {
    const origin = floor.outline[edge]!;
    const u = (position[0] - origin[0]) * field.dir[0] + (position[2] - origin[1]) * field.dir[1];
    result.push({ left: u - width / 2 - d.openingMargin, right: u + width / 2 + d.openingMargin,
      bottom: position[1] - height / 2 - d.openingMargin, top: position[1] + height / 2 + d.openingMargin });
  };
  for (const anchor of layout.anchors ?? []) if (anchor.edge === edge) worldRect(anchor.position, anchor.size, anchor.size);
  for (const item of [...layout.signage ?? [], ...layout.screens ?? []]) {
    if (item.edge === edge) worldRect(item.center, item.width, item.height);
  }
  for (const light of layout.lights) if (light.edge === edge) worldRect(light.position, light.size[0], light.size[1]);
  for (const band of layout.balconyBands ?? []) if (band.floor === floor.index && band.edge === edge) {
    result.push({ left: band.offset - d.approachMargin, right: band.offset + band.width + d.approachMargin,
      bottom: floor.elevation, top: floor.elevation + Math.min(floor.height, band.railHeight + 1) });
  }
  const escape = layout.fireEscape;
  if (escape?.edge === edge && floor.index >= escape.fromFloor && floor.index <= escape.toFloor) {
    result.push({ left: escape.offset - d.approachMargin, right: escape.offset + escape.width + d.approachMargin,
      bottom: floor.elevation, top: floor.elevation + floor.height });
  }
  return result;
}

function sameFace(a: FloorLayout, b: FloorLayout, edge: number): boolean {
  return [edge, (edge + 1) % b.outline.length].every(index => a.outline[index]
    && Math.hypot(a.outline[index]![0] - b.outline[index]![0], a.outline[index]![1] - b.outline[index]![1]) < 1e-7);
}

export function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

export function subtract(area: Rectangle, holes: Rectangle[]): Rectangle[] {
  let pieces = [area];
  for (const hole of holes) pieces = pieces.flatMap(p => {
    if (!intersects(p, hole)) return [p];
    const left = Math.max(p.left, hole.left), right = Math.min(p.right, hole.right);
    const bottom = Math.max(p.bottom, hole.bottom), top = Math.min(p.top, hole.top);
    return [
      { left: p.left, right: left, bottom: p.bottom, top: p.top },
      { left: right, right: p.right, bottom: p.bottom, top: p.top },
      { left, right, bottom: p.bottom, top: bottom },
      { left, right, bottom: top, top: p.top },
    ].filter(r => r.right - r.left > 1e-7 && r.top - r.bottom > 1e-7);
  });
  return pieces;
}
