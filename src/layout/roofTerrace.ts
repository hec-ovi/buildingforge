import { ringInsidePolygon, type P2 } from '../core/polygon.ts';
import type { Blueprint, BuildingRequest, RoofArtifact } from '../types.ts';

export interface RoofBay { u: number; v: number; width: number; depth: number }
export interface RoofTerracePlan {
  origin: P2; axis: P2; outline: P2[]; occupied: RoofBay[]; route: RoofBay;
  /** Body-centre route, beginning outside the bulkhead and stopping before the guard. */
  accessPath: P2[];
  lounge: RoofBay[]; garden: RoofBay | null; service: RoofBay | null; equipment: RoofArtifact[];
}

export function hasRoofTerrace(request: BuildingRequest): boolean {
  return request.options?.architecture === 'balcony-grid'
    && ['rich', 'high_rich'].includes(request.building.tier)
    && request.options?.roofArtifacts !== 'off';
}

/** An ordered terrace uses the actual roof polygon and stair door as datums.
 * A two-metre access spine remains empty all the way from the stair door toward
 * the far roof edge. Bays also reserve a one-metre walking apron on every side. */
export function roofTerracePlan(outline: P2[], bulkhead: Blueprint['roof']['bulkhead']): RoofTerracePlan | null {
  if (!bulkhead) return null;
  const origin = outline[0]!, length = Math.hypot(outline[1]![0] - origin[0], outline[1]![1] - origin[1]);
  if (length < 1e-6) return null;
  const axis: P2 = [(outline[1]![0] - origin[0]) / length, (outline[1]![1] - origin[1]) / length];
  const local = (p: P2): P2 => [(p[0] - origin[0]) * axis[0] + (p[1] - origin[1]) * axis[1],
    -(p[0] - origin[0]) * axis[1] + (p[1] - origin[1]) * axis[0]];
  const world = (u: number, v: number): P2 => [origin[0] + axis[0] * u - axis[1] * v, origin[1] + axis[1] * u + axis[0] * v];
  const polygon = outline.map(local);
  const bounds = (points: P2[], margin = 0): RoofBay => {
    const u = Math.min(...points.map(p => p[0])) - margin, v = Math.min(...points.map(p => p[1])) - margin;
    return { u, v, width: Math.max(...points.map(p => p[0])) - u + margin, depth: Math.max(...points.map(p => p[1])) - v + margin };
  };
  const ax = bulkhead.axis, cross: P2 = [-ax[1], ax[0]];
  const corners = [-1, 1].flatMap(a => [-1, 1].map(b => local([
    bulkhead.center[0] + ax[0] * a * bulkhead.width / 2 + cross[0] * b * bulkhead.depth / 2,
    bulkhead.center[1] + ax[1] * a * bulkhead.width / 2 + cross[1] * b * bulkhead.depth / 2,
  ])));
  const housing = bounds(corners, 1);
  const normal = bulkhead.doorNormal;
  const reach = (Math.abs(normal[0] * ax[0] + normal[1] * ax[1]) > .99 ? bulkhead.width : bulkhead.depth) / 2;
  const door: P2 = [bulkhead.center[0] + normal[0] * reach, bulkhead.center[1] + normal[1] * reach];
  const span = bounds(polygon), far = Math.hypot(span.width, span.depth);
  const entry = local(door), direction: P2 = [normal[0] * axis[0] + normal[1] * axis[1], -normal[0] * axis[1] + normal[1] * axis[0]];
  const across: P2 = [-direction[1], direction[0]];
  const at = (distance: number): P2 => [entry[0] + direction[0] * distance, entry[1] + direction[1] * distance];
  const corridor = (distance: number): P2[] => [at(.5), at(distance)].flatMap((p, i) =>
    (i ? [1, -1] : [-1, 1]).map(sign => [p[0] + across[0] * sign, p[1] + across[1] * sign] as P2));
  let extent = .5;
  for (let distance = 1; distance <= far; distance += .5) {
    if (!ringInsidePolygon(polygon, corridor(distance))) break;
    extent = distance;
  }
  if (extent < 3) return null;
  const route = bounds(corridor(extent));
  const accessPath = [world(...at(.8)), world(...at(extent - .8))];
  const occupied = [housing, route];
  const overlaps = (a: RoofBay, b: RoofBay, gap = 0) => a.u < b.u + b.width + gap && a.u + a.width > b.u - gap
    && a.v < b.v + b.depth + gap && a.v + a.depth > b.v - gap;
  const find = (width: number, depth: number, near: boolean): RoofBay | null => {
    const candidates: RoofBay[] = [];
    for (let v = span.v + 1.5; v + depth <= span.v + span.depth - 1.5; v += 1) {
      for (let u = span.u + 1.5; u + width <= span.u + span.width - 1.5; u += 1) {
        const bay = { u, v, width, depth };
        const apron: P2[] = [[u - .8, v - .8], [u + width + .8, v - .8], [u + width + .8, v + depth + .8], [u - .8, v + depth + .8]];
        if (ringInsidePolygon(polygon, apron) && !occupied.some(item => overlaps(bay, item, 1))) candidates.push(bay);
      }
    }
    const entry = local(door);
    const score = (bay: RoofBay) => Math.hypot(bay.u + width / 2 - entry[0], bay.v + depth / 2 - entry[1]);
    candidates.sort((a, b) => (near ? 1 : -1) * (score(a) - score(b)) || a.v - b.v || a.u - b.u);
    const chosen = candidates[0] ?? null;
    if (chosen) occupied.push(chosen);
    return chosen;
  };
  const service = find(7, 6, false);
  const lounge = [find(8, 7, true), find(8, 7, true)].filter((bay): bay is RoofBay => !!bay);
  const garden = find(10, 5, false);
  const equipment: RoofArtifact[] = service ? [0, 1, 2].map(i => ({
    id: `roof-artifact:terrace-hvac:${i}`, kind: 'hvac', center: world(service.u + 1.35 + i * 2.1, service.v + 3.1),
    size: [1.55, 2.2, 1.5], rotationDeg: Math.atan2(axis[1], axis[0]) * 180 / Math.PI,
  })) : [];
  return { origin, axis, outline: polygon, occupied, route, accessPath, lounge, garden, service, equipment };
}
