import { Rng } from '../core/rng.ts';
import { edgeDir, edgeLength, edgeNormal } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import { materialSlot } from '../materials/slot.ts';
import { cutWall, rectHole, type Hole } from './wallcut.ts';
import type { MeshBuilder, V3 } from './primitives.ts';

/** Fitted alpha decals cut by the same solid receiver boundaries as the walls. */
export function meshWindowWeathering(builder: MeshBuilder, layout: Layout): void {
  if (layout.style.facade.kind === 'curtain-wall') return;
  const sink = builder.part('window-weathering');
  const chance = layout.tier === 'poor' ? 0.65 : layout.tier === 'mid' ? 0.4 : 0.15;
  for (const floor of layout.floors) {
    if (floor.index < 0) continue;
    for (const opening of floor.openings) {
      if (opening.kind !== 'window' || !new Rng(layout.request.seed, `weathering:${opening.id}`).chance(chance)) continue;
      const edge = opening.edge;
      const origin = floor.outline[edge]!;
      const normal = edgeNormal(floor.outline, edge);
      const tangent = edgeDir(floor.outline, edge);
      const length = edgeLength(floor.outline, edge);
      const sill = floor.elevation + opening.sill;
      const receivers = [
        { kind: 'window-grime-sill', variant: 'runoff', x: opening.offset + opening.width / 2 - 1.5, y: sill - 0.95, width: 3, height: 0.9 },
        { kind: 'window-grime-jamb', variant: 'stain', x: opening.offset - 0.45, y: sill + opening.height - 2.5, width: 0.4, height: 2.5 },
      ];
      for (const receiver of receivers) {
        const x0 = Math.max(0, receiver.x), x1 = Math.min(length, receiver.x + receiver.width);
        const y0 = Math.max(floor.elevation, receiver.y), y1 = Math.min(floor.elevation + floor.height, receiver.y + receiver.height);
        if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
        const holes: Hole[] = floor.openings.filter((other) => other.edge === edge).map((other) =>
          rectHole(other.offset - 0.055, floor.elevation + other.sill - 0.055,
            other.width + 0.11,
            other.height + (other.transom ? other.transom + 0.15 : 0) + 0.11));
        for (const cut of layout.carved) if (cut.aperture.face === edge) holes.push({ poly: cut.facePoly });
        const localHoles = holes.map((hole): Hole => ({ poly: hole.poly.map(([u, y]) => [u - x0, y]) }));
        const material = materialSlot(`${layout.theme}/${receiver.kind}/${layout.tier}`, receiver.variant);
        const point = ([u, y]: [number, number]): V3 => [origin[0] + tangent[0] * (u + x0) + normal[0] * 0.002, y,
          origin[1] + tangent[1] * (u + x0) + normal[1] * 0.002];
        for (const piece of cutWall(x1 - x0, y0, y1, localHoles)) {
          const corners = [piece.bl, piece.br, piece.tr, piece.tl] as const;
          const uv = corners.map(([u, y]): [number, number] => [(u + x0 - receiver.x) / receiver.width,
            (receiver.y + receiver.height - y) / receiver.height]);
          sink.quadFacing(material, point(piece.bl), point(piece.br), point(piece.tr), point(piece.tl),
            [normal[0], 0, normal[1]], uv);
        }
      }
    }
  }
}
