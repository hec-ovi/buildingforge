// Assembles a building out of one family's pieces.
//
// Nothing here generates geometry for a parcel. It decides which piece stands
// where, and adds only what belongs to the building rather than to a piece: the
// floor slabs the interior replaces, the entrance a consumer opens, and the
// wire anchors the connections layer asked for.

import { MeshBuilder, type Part, type Prim, type V3 } from '../mesh/primitives.ts';
import { ExteriorError } from '../core/errors.ts';
import { measureRuntime } from '../glb/measure.ts';
import { baysAcross, bandStack, KIT, type Band } from './module.ts';
import { buildPieceMesh, pieceId } from './piece.ts';
import { recipeFor } from './recipes/index.ts';
import { writeAssemblyGlb } from './glb.ts';
import type { AssemblyRequest, AssemblyResult, Placement, PieceManifest, P3 } from './types.ts';
import type { TextureOptions } from '../materials/apply.ts';

type Edge = { origin: [number, number]; dir: [number, number]; length: number; rotation: number };

function edges(width: number, depth: number): Edge[] {
  const ring: [number, number][] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  return ring.map((origin, index) => {
    const next = ring[(index + 1) % 4]!;
    const span = [next[0] - origin[0], next[1] - origin[1]] as [number, number];
    const length = Math.hypot(span[0], span[1]);
    const dir: [number, number] = [span[0] / length, span[1] / length];
    return { origin, dir, length, rotation: Math.atan2(-dir[1], dir[0]) };
  });
}

/** Turn a piece's own frame into the building frame. */
function place(edge: Edge, along: number, y: number): { position: P3; rotation: number } {
  return {
    position: [edge.origin[0] + edge.dir[0] * along, y, edge.origin[1] + edge.dir[1] * along],
    rotation: edge.rotation,
  };
}

export interface AssemblyPlan {
  family: string;
  bands: { band: Band; floor: number; base: number; height: number }[];
  placements: Placement[];
  pieces: Map<string, PieceManifest>;
}

/** Which piece stands where, without building any geometry. */
export function planAssembly(request: AssemblyRequest): AssemblyPlan {
  const recipe = recipeFor(request.family);
  const across = baysAcross(request.lot.width), deep = baysAcross(request.lot.depth);
  const stack = bandStack(request.floors);
  const seed = request.seed ?? request.buildingId;
  const groundHeight = request.groundHeight ?? recipe.heights.ground;
  const floorHeight = request.floorHeight ?? recipe.heights.middle;
  const crownHeight = floorHeight + (recipe.heights.crown - recipe.heights.middle);
  const bands: AssemblyPlan['bands'] = [{ band: 'ground', floor: 0, base: 0, height: groundHeight }];
  for (let k = 0; k < stack.middle; k++) {
    bands.push({ band: 'middle', floor: k + 1, base: groundHeight + k * floorHeight, height: floorHeight });
  }
  bands.push({ band: 'crown', floor: request.floors - 1, base: groundHeight + stack.middle * floorHeight, height: crownHeight });

  const entranceEdge = request.entranceEdge ?? 0;
  const lot = edges(request.lot.width, request.lot.depth);
  const placements: Placement[] = [];
  const pieces = new Map<string, PieceManifest>();
  const need = (band: Band, kind: 'corner' | 'bay' | 'entrance-bay', height: number) => {
    const id = pieceId(recipe.family, band, kind);
    if (!pieces.has(id)) pieces.set(id, buildPieceMesh({ family: recipe.family, band, piece: kind, seed, height }).manifest);
    return id;
  };
  for (const band of bands) {
    for (const [index, edge] of lot.entries()) {
      placements.push({ piece: need(band.band, 'corner', band.height), floor: band.floor, ...place(edge, 0, band.base) });
      const bays = Math.round(edge.length / KIT.bay) - 1;
      const entranceAt = index === entranceEdge ? Math.floor(bays / 2) : -1;
      for (let bay = 0; bay < bays; bay++) {
        const kind = bay === entranceAt ? 'entrance-bay' : 'bay';
        placements.push({ piece: need(band.band, kind, band.height), floor: band.floor, ...place(edge, KIT.cornerArm + bay * KIT.bay, band.base) });
      }
    }
  }
  return { family: recipe.family, bands, placements, pieces };
}

const cos = Math.cos, sin = Math.sin;

/** Copy one piece's addressable parts into the building frame. */
function transfer(source: MeshBuilder, target: MeshBuilder, names: Set<string>, at: { position: P3; rotation: number }): void {
  const turn = (p: V3): V3 => [
    p[0] * cos(at.rotation) + p[2] * sin(at.rotation) + at.position[0],
    p[1] + at.position[1],
    -p[0] * sin(at.rotation) + p[2] * cos(at.rotation) + at.position[2],
  ];
  const spin = (p: V3): V3 => [p[0] * cos(at.rotation) + p[2] * sin(at.rotation), p[1], -p[0] * sin(at.rotation) + p[2] * cos(at.rotation)];
  for (const part of source.parts) {
    if (!names.has(part.name)) continue;
    const pivot = part.pivot ? turn(part.pivot) : undefined;
    const copy: Part = { name: part.name, prims: new Map(), keepNode: true, ...(pivot ? { pivot } : {}), ...(part.parent ? { parent: part.parent } : {}) };
    for (const [slot, prim] of part.prims) {
      const moved: Prim = { positions: [], normals: [], uvs: [...prim.uvs], indices: [...prim.indices] };
      for (let i = 0; i < prim.positions.length; i += 3) {
        const local: V3 = [prim.positions[i]!, prim.positions[i + 1]!, prim.positions[i + 2]!];
        const world = part.pivot ? spin(local) : turn(local);
        moved.positions.push(world[0], world[1], world[2]);
        const n = spin([prim.normals[i]!, prim.normals[i + 1]!, prim.normals[i + 2]!]);
        moved.normals.push(n[0], n[1], n[2]);
      }
      copy.prims.set(slot, moved);
    }
    target.parts.push(copy);
  }
}

export async function assembleFromPieces(request: AssemblyRequest, options: TextureOptions = {}): Promise<AssemblyResult> {
  const recipe = recipeFor(request.family);
  const plan = planAssembly(request);
  const seed = request.seed ?? request.buildingId;
  const kinds = new Map<string, MeshBuilder>();
  for (const [id, manifest] of plan.pieces) {
    kinds.set(id, buildPieceMesh({ family: recipe.family, band: manifest.band, piece: manifest.piece, seed, height: manifest.height }).mb);
  }

  const building = new MeshBuilder();
  const inset = recipe.backing;
  const { width, depth } = request.lot;
  for (const band of plan.bands) {
    const sink = building.part(`floor:${band.floor}/slab`, { keepNode: true });
    slab(sink, recipe.materials['inner-wall'] ?? recipe.materials.wall!, inset, width - inset, depth - inset, band.base);
  }
  const top = plan.bands.at(-1)!;
  slab(building.part('roof:deck', { keepNode: true }), recipe.materials.roof ?? recipe.materials.wall!,
    inset, width - inset, depth - inset, top.base + top.height, 'up');

  // The entrance is placed once, so its casing and leaves keep their own nodes.
  const entrance = plan.placements.find(p => p.piece.endsWith('/ground/entrance-bay'));
  const signAnchors: AssemblyResult['signAnchors'] = [];
  const doors: AssemblyResult['doors'] = [];
  for (const [index, placement] of plan.placements.entries()) {
    const manifest = plan.pieces.get(placement.piece)!;
    const frame = { position: placement.position, rotation: placement.rotation };
    for (const anchor of manifest.signAnchors) signAnchors.push({ ...anchor, ...world(anchor, frame), placement: index });
    for (const door of manifest.doors) doors.push({ ...door, ...world(door, frame), placement: index });
    if (placement === entrance) {
      const source = kinds.get(placement.piece)!;
      transfer(source, building, new Set(source.parts.filter(p => p.pivot || p.keepNode).map(p => p.name)), frame);
    }
  }
  for (const anchor of request.anchors ?? []) {
    const edge = edges(width, depth)[anchor.edge];
    if (!edge) throw new ExteriorError('E_SCHEMA', `anchor ${anchor.id} names edge ${anchor.edge}`, { anchor });
    const sink = building.part(`anchor:${anchor.id}`, { keepNode: true });
    const at: V3 = [edge.origin[0] + edge.dir[0] * anchor.u, anchor.y, edge.origin[1] + edge.dir[1] * anchor.u];
    sink.box(recipe.materials.column ?? recipe.materials.wall!, at, [0.25, 0, 0], [0, 0.25, 0], [0, 0, 0.25]);
  }

  const { glb, textures } = await writeAssemblyGlb({
    name: `building:${request.buildingId}`, theme: request.theme ?? 'cyberpunk', seed,
    kinds, placements: plan.placements, building,
  }, options);

  const unique = [...kinds.values()].map(measureRuntime);
  const parts = measureRuntime(building);
  return {
    glb,
    pieces: [...plan.pieces.values()],
    placements: plan.placements,
    signAnchors, doors,
    geometry: {
      vertices: unique.reduce((n, g) => n + g.vertices, parts.vertices),
      triangles: unique.reduce((n, g) => n + g.triangles, parts.triangles),
      bytes: unique.reduce((n, g) => n + g.bytes, parts.bytes),
      instances: plan.placements.length,
      uniquePieces: kinds.size,
    },
    textures,
  };
}

/** A piece-local point in the building frame. */
function world(record: { position: P3; facing: P3 }, at: { position: P3; rotation: number }): { position: P3; facing: P3 } {
  const turn = (p: P3): P3 => [p[0] * cos(at.rotation) + p[2] * sin(at.rotation), p[1], -p[0] * sin(at.rotation) + p[2] * cos(at.rotation)];
  const [x, y, z] = turn(record.position);
  return { position: [x + at.position[0], y + at.position[1], z + at.position[2]], facing: turn(record.facing) };
}

/** One replaceable floor plate, two-sided unless it is the roof deck. */
function slab(sink: ReturnType<MeshBuilder['part']>, material: string, inset: number, width: number, depth: number, y: number, faces: 'both' | 'up' = 'both'): void {
  const ring: V3[] = [[inset, y, inset], [width, y, inset], [width, y, depth], [inset, y, depth]];
  sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  if (faces === 'both') sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}
