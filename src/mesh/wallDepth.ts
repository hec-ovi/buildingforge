import { slopePoint } from './floorSlope.ts';
import { buildingFamily } from '../families/registry.ts';
// How far the opening units reach behind the outline skin: the deepest vertex
// of every window, door, balcony door, open frontage and aperture part, measured against the
// same-height facade plane. Published as facade.wallDepth, so a
// consumer fitting the shell keeps clear of everything built into the openings.

import { WALL_THICKNESS } from './wallLining.ts';
import { edgeNormal } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder, Part } from './primitives.ts';
import type { BuildingRequest, OpeningKind } from '../types.ts';

const NODE: Record<OpeningKind, string> = {
  window: 'window:', door: 'door:', balconyDoor: 'balcony:', openFront: 'open-front:', aperture: 'aperture:',
};

/** Visible family layers keep one shared structural backing and lining reservation. */
export function familyBackingDepth(request: BuildingRequest | undefined): number {
  const family = buildingFamily(request?.options?.architecture);
  return family ? family.wallBackingDepth ?? 0.12 : 0;
}

export function measureWallDepth(layout: Pick<Layout, 'floors'> & Partial<Pick<Layout, 'request'>>, mb: MeshBuilder): number {
  const byName = new Map(mb.parts.map((p) => [p.name, p]));
  const children = new Map<string, Part[]>();
  for (const p of mb.parts) if (p.parent) children.set(p.parent, [...(children.get(p.parent) ?? []), p]);

  let deepest = familyBackingDepth(layout.request) + WALL_THICKNESS;
  for (const floor of layout.floors) {
    for (const o of floor.openings) {
      const base = `${NODE[o.kind]}${o.id}`;
      const [vx, vz] = floor.outline[o.edge]!;
      const [nx, nz] = edgeNormal(floor.outline, o.edge);
      const basePlane = { x: vx, z: vz, nx, nz };
      const next = floor.outline[(o.edge + 1) % floor.outline.length]!;
      const planes = new Map<number, { x: number; z: number; nx: number; nz: number }>();
      const planeAt = (y: number) => {
        let plane = planes.get(y);
        if (!plane) {
          const a = slopePoint(floor, [vx, y, vz]), b = slopePoint(floor, [next[0], y, next[1]]);
          const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
          plane = { x: a[0], z: a[2], nx: dz / length, nz: -dx / length };
          planes.set(y, plane);
        }
        return plane;
      };
      const parts = [byName.get(base), ...(children.get(base) ?? [])];
      for (const part of parts) {
        if (!part) continue;
        const [ox, oy, oz] = part.pivot ?? [0, 0, 0];
        for (const prim of part.prims.values()) {
          const pos = prim.positions;
          for (let i = 0; i < pos.length; i += 3) {
            const plane = part.sloped && floor.topOutline ? planeAt(pos[i + 1]! + oy) : basePlane;
            const inward = -((pos[i]! + ox - plane.x) * plane.nx + (pos[i + 2]! + oz - plane.z) * plane.nz);
            if (inward > deepest) deepest = inward;
          }
        }
      }
    }
  }
  return Math.round(deepest * 1000) / 1000;
}
