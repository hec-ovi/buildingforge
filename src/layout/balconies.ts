// Balcony bands are shared geometry, derived once from the final door layout.
// A full facade band never becomes one duplicate slab per door.

import { Rng } from '../core/rng.ts';
import { edgeDir, edgeLength, edgeNormal, quant, ringInsidePolygon, type P2 } from '../core/polygon.ts';
import { BALCONY, OPENING } from '../rules/tables.ts';
import type { BalconyBand, BuildingRequest, Opening } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { FloorLayout, Style } from './model.ts';

export function buildBalconyBands(
  req: BuildingRequest, family: Family, tier: Tier, style: Style, floors: FloorLayout[],
): BalconyBand[] {
  const bands: BalconyBand[] = [];
  const wanted = req.options?.balconyStyle ?? 'auto';
  const eligible = BALCONY.fullFamilies.includes(family) && BALCONY.fullTiers.includes(tier);
  const full = wanted === 'full' ? eligible
    : wanted === 'bay' ? false
      : eligible && new Rng(req.seed, 'full-balcony').chance(BALCONY.fullChance[tier] ?? 0);

  for (const floor of floors) {
    if (floor.index <= 0) continue;
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const doors = floor.openings.filter((opening) =>
        opening.kind === 'balconyDoor' && opening.edge === edge && opening.balcony);
      if (doors.length === 0) continue;

      const length = edgeLength(floor.outline, edge);
      const fullOffset = OPENING.cornerMargin;
      const fullWidth = quant(length - 2 * OPENING.cornerMargin);
      if (full && style.balconyDepth > 0 && fullWidth > 0
        && bandFits(req.parcel.footprint, floor.outline, edge, fullOffset, fullWidth, style.balconyDepth)) {
        const id = `bb:${floor.index}:${edge}:0`;
        const band = makeBand(id, floor.index, edge, fullOffset, fullWidth,
          style.balconyDepth, 'full', doors);
        for (const door of doors) {
          door.balcony = { ...door.balcony!, width: band.width, bandId: id };
        }
        bands.push(band);
        continue;
      }

      doors.forEach((door, index) => {
        const width = door.balcony!.width;
        const offset = quant(door.offset + door.width / 2 - width / 2);
        const id = `bb:${floor.index}:${edge}:${index}`;
        const band = makeBand(id, floor.index, edge, offset, width, door.balcony!.depth,
          door.balcony!.depth > 0 ? 'bay' : 'juliet', [door]);
        door.balcony = { ...door.balcony!, bandId: id };
        bands.push(band);
      });
    }
  }
  return bands;
}

function makeBand(
  id: string, floor: number, edge: number, offset: number, width: number, depth: number,
  style: BalconyBand['style'], doors: Opening[],
): BalconyBand {
  return {
    id, floor, edge, offset, width, depth,
    slabThickness: depth > 0 ? BALCONY.slabThickness : 0,
    railHeight: BALCONY.railing,
    style,
    doors: doors.map((door) => door.id),
  };
}

/** The whole band, including both outer corners, stays inside the parcel. */
function bandFits(
  parcel: P2[], outline: P2[], edge: number, offset: number, width: number, depth: number,
): boolean {
  const at = outline[edge]!;
  const along = edgeDir(outline, edge);
  const outward = edgeNormal(outline, edge);
  const point = (u: number, d: number): P2 => [
    at[0] + along[0] * u + outward[0] * d,
    at[1] + along[1] * u + outward[1] * d,
  ];
  return ringInsidePolygon(parcel, [
    point(offset, 0), point(offset + width, 0),
    point(offset + width, depth), point(offset, depth),
  ]);
}
