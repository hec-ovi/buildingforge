import { ExteriorError } from '../core/errors.ts';
import { baysAcross, bandStack, KIT, type Band, type PieceKind } from './module.ts';
import { buildPieceMesh, pieceId, type BuiltPiece } from './piece.ts';
import { recipeFor } from './recipes/index.ts';
import { world } from './transform.ts';
import type { AssemblyPlan, AssemblyRequest, Placement } from './types.ts';

export function lotEdges(width: number, depth: number) {
  const ring: [number, number][] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  return ring.map((origin, index) => {
    const next = ring[(index + 1) % 4]!;
    const length = Math.hypot(next[0] - origin[0], next[1] - origin[1]);
    const dir: [number, number] = [(next[0] - origin[0]) / length, (next[1] - origin[1]) / length];
    return { origin, dir, length, rotationY: Math.atan2(-dir[1], dir[0]) };
  });
}

/** Retain built pieces for callers that also serialize an assembled GLB. */
export function prepareAssembly(request: AssemblyRequest): { plan: AssemblyPlan; pieces: Map<string, BuiltPiece> } {
  const recipe = recipeFor(request.family);
  baysAcross(request.lot.width);
  baysAcross(request.lot.depth);
  const stack = bandStack(request.floors);
  const seed = request.seed ?? request.buildingId;
  const groundHeight = request.groundHeight ?? recipe.heights.ground;
  const floorHeight = request.floorHeight ?? recipe.heights.middle;
  const crownHeight = floorHeight + (recipe.heights.crown - recipe.heights.middle);
  if (![groundHeight, floorHeight, crownHeight].every(h => Number.isFinite(h) && h > 0)) {
    throw new ExteriorError('E_SCHEMA', 'band heights must be finite and positive');
  }
  const entranceEdge = request.entranceEdge ?? 0;
  if (!Number.isInteger(entranceEdge) || entranceEdge < 0 || entranceEdge > 3) {
    throw new ExteriorError('E_SCHEMA', 'entranceEdge must be an integer from 0 to 3');
  }
  const bands: AssemblyPlan['bands'] = [{ band: 'ground', floor: 0, base: 0, height: groundHeight }];
  for (let k = 0; k < stack.middle; k++) {
    bands.push({ band: 'middle', floor: k + 1, base: groundHeight + k * floorHeight, height: floorHeight });
  }
  bands.push({ band: 'crown', floor: request.floors - 1, base: groundHeight + stack.middle * floorHeight, height: crownHeight });

  const plan: AssemblyPlan = { family: recipe.family, bands, placements: [], signAnchors: [], doors: [] };
  const pieces = new Map<string, BuiltPiece>();
  const need = (band: Band, kind: PieceKind, height: number) => {
    const id = pieceId(recipe.family, band, kind);
    if (!pieces.has(id)) pieces.set(id, buildPieceMesh({ family: recipe.family, band, piece: kind, seed, height }));
    return id;
  };
  const lot = lotEdges(request.lot.width, request.lot.depth);
  for (const band of bands) {
    for (const [face, edge] of lot.entries()) {
      const add = (kind: PieceKind, bayIndex: number | null, along: number) => {
        const placement: Placement = {
          family: recipe.family, piece: need(band.band, kind, band.height), floor: band.floor, face, bayIndex,
          position: [edge.origin[0] + edge.dir[0] * along, band.base, edge.origin[1] + edge.dir[1] * along],
          rotationY: edge.rotationY,
        };
        const index = plan.placements.length;
        plan.placements.push(placement);
        const manifest = pieces.get(placement.piece)!.manifest;
        for (const anchor of manifest.signAnchors) plan.signAnchors.push({ ...anchor, ...world(anchor, placement), placement: index });
        for (const door of manifest.doors) plan.doors.push({ ...door, ...world(door, placement), placement: index });
      };
      add('corner', null, 0);
      const bays = edge.length / KIT.bay - 1;
      const entranceAt = face === entranceEdge ? Math.floor(bays / 2) : -1;
      for (let bay = 0; bay < bays; bay++) {
        add(bay === entranceAt ? 'entrance-bay' : 'bay', bay, KIT.cornerArm + bay * KIT.bay);
      }
    }
  }
  return { plan, pieces };
}

/** JSON placement table, including world space attachment records. */
export function planAssembly(request: AssemblyRequest): AssemblyPlan {
  return prepareAssembly(request).plan;
}
