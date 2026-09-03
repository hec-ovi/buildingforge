// How far the opening units reach behind the outline skin: the deepest vertex
// of every window, door, balcony door, open frontage and aperture part, measured against the
// outward normal of the edge it sits on. Published as facade.wallDepth, so a
// consumer fitting the shell keeps clear of everything built into the openings.

import { edgeNormal } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder, Part } from './primitives.ts';
import type { OpeningKind } from '../types.ts';

const NODE: Record<OpeningKind, string> = {
  window: 'window:', door: 'door:', balconyDoor: 'balcony:', openFront: 'open-front:', aperture: 'aperture:',
};

export function measureWallDepth(layout: Layout, mb: MeshBuilder): number {
  const byName = new Map(mb.parts.map((p) => [p.name, p]));
  const children = new Map<string, Part[]>();
  for (const p of mb.parts) if (p.parent) children.set(p.parent, [...(children.get(p.parent) ?? []), p]);

  let deepest = 0;
  for (const floor of layout.floors) {
    for (const o of floor.openings) {
      const base = `${NODE[o.kind]}${o.id}`;
      const [vx, vz] = floor.outline[o.edge]!;
      const [nx, nz] = edgeNormal(floor.outline, o.edge);
      const parts = [byName.get(base), ...(children.get(base) ?? [])];
      for (const part of parts) {
        if (!part) continue;
        const [ox, , oz] = part.pivot ?? [0, 0, 0];
        for (const prim of part.prims.values()) {
          const pos = prim.positions;
          for (let i = 0; i < pos.length; i += 3) {
            const inward = -((pos[i]! + ox - vx) * nx + (pos[i + 2]! + oz - vz) * nz);
            if (inward > deepest) deepest = inward;
          }
        }
      }
    }
  }
  return Math.round(deepest * 1000) / 1000;
}
