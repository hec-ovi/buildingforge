import { DOORS } from '../rules/tables.ts';
import { edgeDir, edgeNormal, ringInsidePolygon, type P2 } from '../core/polygon.ts';
import type { DoorAssembly, DoorSet, Opening, PocketMotion } from '../types.ts';

/** Moving finish and recessed hardware both stay within this chamber profile. */
export const POCKET = {
  leafThickness: DOORS.leaf.leafThickness, finishDepth: Math.max(DOORS.leaf.panelDepth, DOORS.leaf.ribDepth), clearance: 0.008,
  skin: 0.035, overlap: 0.02, travelClearance: 0.05, bottom: 0.006,
};

const mm = (value: number) => Math.round(value * 1000) / 1000;

/** Closed slab bounds, shared by the fitter and the authored moving node. */
export function pocketLeafBounds(offset: number, width: number, count: number, index: number): [number, number] {
  const a = offset + width * index / count;
  const b = offset + width * (index + 1) / count;
  return [a - (index === 0 ? POCKET.overlap : 0), b + (index === count - 1 ? POCKET.overlap : 0)];
}

/** Prefer opposed leaves; one-sided chambers fit asymmetric remaining wall fields. */
export function fitPocketDoor(
  set: DoorSet, offset: number, width: number, height: number,
  available: (start: number, end: number, depth: number) => boolean,
): DoorAssembly | undefined {
  const solid = set === 'glazed-grid' || set === 'illuminated' ? 'layered' : set;
  const rule = DOORS.sets[solid];
  const frameWidth = mm(rule.frameWidth * (solid === 'layered' ? 2.35 : 1));
  const frontDepth = mm(rule.recessDepth - POCKET.finishDepth - POCKET.clearance);
  const chamberBack = mm(rule.recessDepth + POCKET.leafThickness + POCKET.clearance);
  const backDepth = mm(chamberBack + POCKET.skin);
  const chamberTop = mm(height + POCKET.overlap + POCKET.clearance);
  for (const directions of [[-1, 1], [-1], [1]]) {
    const count = directions.length;
    const travel = mm(width / count + POCKET.travelClearance);
    const leaves: PocketMotion['leaves'] = directions.map((direction, leaf) => {
      const [a, b] = pocketLeafBounds(offset, width, count, leaf);
      const travelU = direction * travel;
      const lo = direction < 0 ? a + travelU - POCKET.clearance : offset + width;
      const hi = direction < 0 ? offset : b + travelU + POCKET.clearance;
      return { leaf: leaf as 0 | 1, travelU, pocket: {
        offset: mm(lo), sill: POCKET.bottom - POCKET.clearance / 2,
        width: mm(hi - lo), height: mm(chamberTop - (POCKET.bottom - POCKET.clearance / 2)),
        frontDepth, backDepth: chamberBack,
      } };
    });
    const start = mm(Math.min(offset - frameWidth,
      ...leaves.map(({ pocket }) => pocket.offset - POCKET.skin)));
    const end = mm(Math.max(offset + width + frameWidth,
      ...leaves.map(({ pocket }) => pocket.offset + pocket.width + POCKET.skin)));
    if (!available(start, end, backDepth)) continue;
    return {
      set: solid, frameWidth, frameDepth: rule.frameDepth, recessDepth: rule.recessDepth, thresholdHeight: 0,
      motion: { kind: 'pocket', maxTravel: travel, clearDepth: 0, leaves },
      clearance: { offset, sill: 0, width, height, backDepth },
      cassette: { offset: start, sill: 0, width: mm(end - start), height: mm(height + frameWidth), backDepth },
    };
  }
  return undefined;
}

export function fittedPocketLeaves(assembly: DoorAssembly): Opening['leaves'] {
  return assembly.motion.kind === 'pocket' ? assembly.motion.leaves.length as 1 | 2 : undefined;
}

/** Complete cassette depth must remain within a concave or explicitly shaped plate. */
export function pocketInsidePlate(outline: P2[], edge: number, start: number, end: number, depth: number): boolean {
  const origin = outline[edge]!, tangent = edgeDir(outline, edge), normal = edgeNormal(outline, edge);
  const at = (u: number, inward: number): P2 => [origin[0] + tangent[0] * u - normal[0] * inward,
    origin[1] + tangent[1] * u - normal[1] * inward];
  return ringInsidePolygon(outline, [at(start, 0), at(end, 0), at(end, depth), at(start, depth)]);
}
