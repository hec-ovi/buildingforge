import { ExteriorError } from '../core/errors.ts';
import { baysAcross, bandStack, KIT, type Band, type PieceKind } from './module.ts';
import { buildPieceMesh, pieceId, type BuiltPiece } from './piece.ts';
import { recipeFor } from './recipes/index.ts';
import { world } from './transform.ts';
import { assemblyBlueprint } from './blueprint.ts';
import { assemblyEdges, assemblyRequest, entranceFace } from './request.ts';
import type { BuildingRequest } from '../types.ts';
import type { AssemblyPlan, AssemblyRequest, Placement } from './types.ts';

/** Retain built pieces for callers that also serialize an assembled GLB. */
export function prepareAssembly(raw: AssemblyRequest): { plan: AssemblyPlan; pieces: Map<string, BuiltPiece>; request: BuildingRequest } {
  const recipe = recipeFor(raw.family);
  const request = assemblyRequest(raw);
  const lot = assemblyEdges(request.parcel.footprint);
  for (const edge of lot) baysAcross(Number(edge.length.toFixed(8)));
  const stack = bandStack(request.building.floors);
  const seed = request.seed;
  const groundHeight = raw.groundHeight ?? recipe.heights.ground;
  const floorHeight = raw.floorHeight ?? recipe.heights.middle;
  const crownHeight = raw.floorHeight ?? recipe.heights.crown;
  if (![groundHeight, floorHeight, crownHeight].every(h => Number.isFinite(h) && h >= 2.2 && h <= 12)) {
    throw new ExteriorError('E_SCHEMA', 'band heights must be finite and between 2.2 and 12 metres');
  }
  const entranceEdge = entranceFace(raw, request);
  const bands: AssemblyPlan['bands'] = [{ band: 'ground', floor: 0, base: 0, height: groundHeight }];
  for (let k = 0; k < stack.middle; k++) {
    bands.push({ band: 'middle', floor: k + 1, base: groundHeight + k * floorHeight, height: floorHeight });
  }
  bands.push({ band: 'crown', floor: request.building.floors - 1, base: groundHeight + stack.middle * floorHeight, height: crownHeight });
  if (bands.at(-1)!.base + crownHeight > request.parcel.maxHeight + 1e-8) {
    throw new ExteriorError('E_ENVELOPE_TOO_LOW', 'kit band heights exceed parcel.maxHeight');
  }

  const plan: Omit<AssemblyPlan, 'blueprint'> = { family: recipe.family, bands, placements: [], signAnchors: [], doors: [] };
  const pieces = new Map<string, BuiltPiece>();
  const need = (band: Band, kind: PieceKind, height: number) => {
    const id = pieceId(recipe.family, band, kind);
    if (!pieces.has(id)) pieces.set(id, buildPieceMesh({ family: recipe.family, band, piece: kind, seed, height }));
    return id;
  };
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
      const bays = Math.round(edge.length / KIT.bay) - 1;
      const entranceAt = face === entranceEdge ? Math.floor(bays / 2) : -1;
      for (let bay = 0; bay < bays; bay++) {
        add(bay === entranceAt ? 'entrance-bay' : 'bay', bay, KIT.cornerArm + bay * KIT.bay);
      }
    }
  }
  return { plan: { ...plan, blueprint: assemblyBlueprint(request, raw, recipe, plan, pieces) }, pieces, request };
}

/** JSON placement table, including world space attachment records. */
export function planAssembly(request: AssemblyRequest): AssemblyPlan {
  return prepareAssembly(request).plan;
}
