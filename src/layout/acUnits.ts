// Facade condenser units: clusters of two to four housings on a bracket, hung
// on the wall under a window or on a blank service band. Placement is a scan on
// the metre module for a stretch of facade that carries nothing, so a cluster
// never lands on an opening, a rib or a column; where the only wall a face has
// is relief (a curtain wall's spandrel band) the cluster mounts proud of it.

import { Rng } from '../core/rng.ts';
import { AC_UNITS, OPENING } from '../rules/tables.ts';
import { onModule } from './module.ts';
import { crossed, standoffOver, type Rect } from './obstructions.ts';
import { edgeDir, edgeLength, edgeNormal, pointInPolygon, quant, type P2 } from '../core/polygon.ts';
import type { BuildingRequest, FacadeArtifact } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { FloorLayout } from './model.ts';

/** How often one face of one floor carries a cluster. */
function clusterChance(family: Family, tier: Tier): number {
  return AC_UNITS.chance.tier[tier] * AC_UNITS.chance.family[family];
}

/**
 * One cluster per face per above-ground floor at most. Each unit is published as
 * a facade artifact of kind `ac-unit`, and the cluster's rectangle joins the
 * face's obstacle map, so a sign or an ad screen placed after it stays clear.
 */
export function placeAcUnits(
  req: BuildingRequest, family: Family, tier: Tier,
  floors: FloorLayout[], obstacles: Map<number, Rect[]>,
): FacadeArtifact[] {
  const out: FacadeArtifact[] = [];
  const chance = clusterChance(family, tier);
  if (chance <= 0) return out;

  for (const floor of floors) {
    if (floor.index < 1) continue; // the ground floor belongs to the street
    for (let e = 0; e < floor.outline.length; e++) {
      const rng = new Rng(req.seed, `ac:${floor.index}:${e}`);
      if (!rng.chance(chance)) continue;
      const cluster = fitCluster(req, floor, e, rng, obstacles.get(e));
      if (!cluster) continue;
      for (let i = 0; i < cluster.count; i++) {
        out.push({
          kind: 'ac-unit',
          floor: floor.index,
          edge: e,
          offset: quant(cluster.u0 + i * AC_UNITS.pitch + (AC_UNITS.pitch - AC_UNITS.width) / 2),
          sill: cluster.sill,
          size: [AC_UNITS.width, AC_UNITS.height, AC_UNITS.depth],
          standoff: cluster.standoff,
        });
      }
      const list = obstacles.get(e) ?? [];
      list.push(clusterRect(floor, e, cluster));
      obstacles.set(e, list);
    }
  }
  return out;
}

interface Cluster { u0: number; sill: number; count: number; standoff: number }

/** The obstacle a placed cluster becomes; a unit skips its own when it is checked. */
export function acClusterName(floor: number, edge: number): string {
  return `ac cluster ${floor}:${edge}`;
}

/** What a cluster occupies on its face: the housings plus the bracket under them. */
function clusterRect(floor: FloorLayout, edge: number, c: Cluster): Rect {
  return {
    u0: c.u0,
    u1: quant(c.u0 + c.count * AC_UNITS.pitch),
    y0: floor.elevation + c.sill - AC_UNITS.bracket.drop - AC_UNITS.bracket.shelf,
    y1: floor.elevation + c.sill + AC_UNITS.height,
    what: acClusterName(floor.index, edge),
    kind: 'relief',
    depth: c.standoff + AC_UNITS.depth,
  };
}

/**
 * Bare wall first, then wall crossed by relief (a rib, a floor band) the bracket
 * stands proud of. Within a pass: the wanted cluster where it wants to be, then
 * narrower, then the next height, under each window on the face in turn and
 * finally the middle of the blank band, on the metre lines outward from there.
 * A face with no wall to hang on, a curtain wall, carries none.
 */
function fitCluster(
  req: BuildingRequest, floor: FloorLayout, edge: number, rng: Rng, rects: Rect[] | undefined,
): Cluster | null {
  const wanted = rng.int(AC_UNITS.cluster[0], AC_UNITS.cluster[1]);
  const L = edgeLength(floor.outline, edge);
  const room = L - 2 * OPENING.cornerMargin;
  for (const bare of [true, false]) {
    for (const seat of seats(floor, edge)) {
      for (let count = wanted; count >= AC_UNITS.cluster[0]; count--) {
        const width = count * AC_UNITS.pitch;
        if (width > room) continue;
        for (const u0 of metreLines(seat.u, width, OPENING.cornerMargin, L - OPENING.cornerMargin)) {
          const c: Cluster = { u0, sill: seat.sill, count, standoff: 0 };
          const on = crossed(rects, clusterRect(floor, edge, c), 0.1);
          if (bare ? on.length > 0 : on.some((o) => o.kind !== 'relief')) continue;
          c.standoff = standoffOver(on);
          if (!insideParcel(req.parcel.footprint, floor.outline, edge, c)) continue;
          return c;
        }
      }
    }
  }
  return null;
}

/** Heights a cluster is willing to hang at: under each window, then the blank band. */
function seats(floor: FloorLayout, edge: number): { u: number; sill: number }[] {
  const out: { u: number; sill: number }[] = [];
  const room = (sill: number) => sill >= AC_UNITS.minSill - 1e-9
    && sill + AC_UNITS.height <= floor.height + 1e-9;
  const windows = floor.openings
    .filter((o) => o.edge === edge && o.kind === 'window')
    .sort((a, b) => a.offset - b.offset);
  for (const w of windows) {
    const sill = onModule(w.sill - AC_UNITS.underWindowGap - AC_UNITS.height, 'down');
    if (room(sill)) out.push({ u: w.offset, sill });
  }
  const band = onModule((floor.height - AC_UNITS.height) / 2, 'down');
  if (room(band)) out.push({ u: edgeLength(floor.outline, edge) / 2, sill: band });
  return out;
}

/** Metre lines inside the range, nearest the wanted start first. */
function metreLines(want: number, width: number, lo: number, hi: number): number[] {
  const first = Math.ceil((lo - 1e-9) / AC_UNITS.pitch);
  const last = Math.floor((hi - width + 1e-9) / AC_UNITS.pitch);
  const out: number[] = [];
  for (let k = first; k <= last; k++) out.push(quant(k * AC_UNITS.pitch));
  return out.sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
}

/** A cluster hangs off the wall like a balcony: its box stays inside the parcel. */
function insideParcel(parcel: P2[], outline: P2[], edge: number, c: Cluster): boolean {
  const [vx, vz] = outline[edge] as P2;
  const d = edgeDir(outline, edge);
  const n = edgeNormal(outline, edge);
  const reach = c.standoff + AC_UNITS.depth;
  const u1 = c.u0 + c.count * AC_UNITS.pitch;
  return [c.u0, u1].every((u) => pointInPolygon(parcel, [
    vx + d[0] * u + n[0] * reach,
    vz + d[1] * u + n[1] * reach,
  ]));
}
