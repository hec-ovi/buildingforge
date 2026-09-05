import { centroid, quant, ringInsidePolygon, type P2 } from '../core/polygon.ts';
import { Rng } from '../core/rng.ts';
import type { Family } from '../rules/families.ts';
import { ROOF_ACCESS, ROOF_ARTIFACTS } from '../rules/tables.ts';
import type { Blueprint, BuildingRequest, RoofArtifact } from '../types.ts';
import type { CoreStairPlacement } from './corePreflight.ts';
import { buildMastAssembly } from './mastAssembly.ts';
import type { FloorLayout, Style } from './model.ts';
import { fitRoofAccess } from './roofAccess.ts';

interface RoofReservation { cx: number; cz: number; hw: number; hd: number }

/** Roof fittings reserve the final stair enclosure before placing equipment. */
export function buildRoof(
  request: BuildingRequest, family: Family, top: number,
  style: Style, floors: FloorLayout[], coreStair: CoreStairPlacement,
): Blueprint['roof'] {
  const outline = floors[floors.length - 1]!.outline;
  const elevation = quant(top);
  const artifacts: RoofArtifact[] = [];
  const bulkhead = fitRoofAccess(request.seed, outline, coreStair);
  if ((request.options?.roofArtifacts ?? 'auto') !== 'off') {
    const rng = new Rng(request.seed, 'roof');
    const placed: RoofReservation[] = bulkhead ? [bulkheadKeepOut(bulkhead)] : [];
    const [cx, cz] = centroid(outline);
    for (const [ruleIndex, rule] of ROOF_ARTIFACTS[family].entries()) {
      if (!rng.chance(rule.chance)) continue;
      const w = quant(rng.range(...rule.size[0]));
      const d = quant(rng.range(...rule.size[1]));
      const h = quant(rng.range(...rule.size[2]));
      const rotationDeg = rng.chance(0.5) ? 90 : 0;
      const ww = rotationDeg === 90 ? d : w;
      const dd = rotationDeg === 90 ? w : d;
      const spot = findRoofSpot(outline, placed, ww, dd, cx, cz, rng,
        rule.kind === 'helipad' || rule.kind === 'penthouse-screen');
      if (!spot) continue;
      placed.push({ cx: spot[0], cz: spot[1], hw: ww / 2 + 0.4, hd: dd / 2 + 0.4 });
      const artifact: RoofArtifact = {
        id: `roof-artifact:${rule.kind}:${ruleIndex}`, kind: rule.kind,
        center: [quant(spot[0]), quant(spot[1])], size: [w, d, h], rotationDeg,
      };
      if (rule.mastVariant) artifact.mastAssembly = buildMastAssembly(artifact, elevation, rule.mastVariant);
      artifacts.push(artifact);
    }
  }
  return { elevation, outline, parapetHeight: style.parapetHeight, bulkhead, artifacts };
}

function bulkheadKeepOut(bulkhead: NonNullable<Blueprint['roof']['bulkhead']>): RoofReservation {
  const cross: P2 = [-bulkhead.axis[1], bulkhead.axis[0]];
  return {
    cx: bulkhead.center[0], cz: bulkhead.center[1],
    hw: Math.abs(bulkhead.axis[0]) * bulkhead.width / 2 + Math.abs(cross[0]) * bulkhead.depth / 2 + ROOF_ACCESS.clearance,
    hd: Math.abs(bulkhead.axis[1]) * bulkhead.width / 2 + Math.abs(cross[1]) * bulkhead.depth / 2 + ROOF_ACCESS.clearance,
  };
}

function findRoofSpot(
  outline: P2[], placed: RoofReservation[], w: number, d: number,
  cx: number, cz: number, rng: Rng, preferCenter: boolean,
): P2 | null {
  const candidates: P2[] = preferCenter ? [[cx, cz]] : [];
  const span = (axis: number) => Math.max(...outline.map((point) => point[axis]!)) - Math.min(...outline.map((point) => point[axis]!));
  for (let i = 0; i < 8; i++) {
    candidates.push([cx + rng.range(-0.4, 0.4) * span(0), cz + rng.range(-0.4, 0.4) * span(1)]);
  }
  for (const [x, z] of candidates) {
    const corners: P2[] = [
      [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2],
    ];
    if (!ringInsidePolygon(outline, corners)) continue;
    if (placed.some((item) => Math.abs(x - item.cx) < w / 2 + item.hw && Math.abs(z - item.cz) < d / 2 + item.hd)) continue;
    return [x, z];
  }
  return null;
}
