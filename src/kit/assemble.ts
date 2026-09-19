// Assembles a building out of one family's pieces.
//
// Nothing here generates geometry for a parcel. It decides which piece stands
// where, and adds only what belongs to the building rather than to a piece: the
// floor slabs the interior replaces, the entrance a consumer opens, and the
// wire anchors the connections layer asked for.

import { MeshBuilder, type Part, type Prim, type V3 } from '../mesh/primitives.ts';
import { measureRuntime } from '../glb/measure.ts';
import { prepareAssembly } from './plan.ts';
import { point, spin, type PieceFrame } from './transform.ts';
import { recipeFor } from './recipes/index.ts';
import { writeAssemblyGlb } from './glb.ts';
import type { AssemblyRequest, AssemblyResult } from './types.ts';
import type { TextureOptions } from '../materials/apply.ts';

/** Copy one piece's addressable parts into the building frame. */
function transfer(source: MeshBuilder, target: MeshBuilder, names: Set<string>, at: PieceFrame): void {
  for (const part of source.parts) {
    if (!names.has(part.name)) continue;
    const pivot = part.pivot ? point(part.pivot, at) : undefined;
    const copy: Part = { name: part.name, prims: new Map(), keepNode: true, ...(pivot ? { pivot } : {}), ...(part.parent ? { parent: part.parent } : {}) };
    for (const [slot, prim] of part.prims) {
      const moved: Prim = { positions: [], normals: [], uvs: [...prim.uvs], indices: [...prim.indices], faces: prim.faces?.map(face => ({ ...face })) };
      for (let i = 0; i < prim.positions.length; i += 3) {
        const local: V3 = [prim.positions[i]!, prim.positions[i + 1]!, prim.positions[i + 2]!];
        const world = part.pivot ? spin(local, at.rotationY) : point(local, at);
        moved.positions.push(world[0], world[1], world[2]);
        const n = spin([prim.normals[i]!, prim.normals[i + 1]!, prim.normals[i + 2]!], at.rotationY);
        moved.normals.push(n[0], n[1], n[2]);
      }
      copy.prims.set(slot, moved);
    }
    target.parts.push(copy);
  }
}

export async function assembleFromPieces(raw: AssemblyRequest, options: TextureOptions = {}): Promise<AssemblyResult> {
  const recipe = recipeFor(raw.family);
  const { plan, pieces, request } = prepareAssembly(raw);
  const seed = request.seed;
  const kinds = new Map([...pieces].map(([id, built]) => [id, built.mb]));

  const building = new MeshBuilder();
  const inset = recipe.backing;
  const outline = request.parcel.footprint;
  const width = Math.hypot(outline[1]![0] - outline[0]![0], outline[1]![1] - outline[0]![1]);
  const depth = Math.hypot(outline[3]![0] - outline[0]![0], outline[3]![1] - outline[0]![1]);
  const frame = plan.placements[0]!;
  for (const band of plan.bands) {
    const sink = building.part(`floor:${band.floor}/slab`, { keepNode: true });
    slab(sink, recipe.materials['inner-wall'] ?? recipe.materials.wall!, inset, width - inset, depth - inset, band.base, frame);
  }
  const top = plan.bands.at(-1)!;
  slab(building.part('roof:deck', { keepNode: true }), recipe.materials.roof ?? recipe.materials.wall!,
    inset, width - inset, depth - inset, top.base + top.height, frame, 'up');

  // The entrance is placed once, so its casing and leaves keep their own nodes.
  const entrance = plan.placements.find(p => p.piece.endsWith('/ground/entrance-bay'));
  if (entrance) {
    const source = kinds.get(entrance.piece)!;
    transfer(source, building, new Set(source.parts.filter(p => p.pivot || p.keepNode).map(p => p.name)), entrance);
  }
  for (const anchor of plan.blueprint.anchors) {
    building.part(`anchor:${anchor.id}`, { keepNode: true, pivot: anchor.position });
  }

  const { glb, textures } = await writeAssemblyGlb({
    name: `building:${request.buildingId}`, theme: request.theme ?? 'cyberpunk', seed,
    kinds, placements: plan.placements, building,
  }, options);

  const unique = [...kinds.values()].map(measureRuntime);
  const parts = measureRuntime(building);
  return {
    glb,
    blueprint: plan.blueprint,
    pieces: [...pieces.values()].map(built => built.manifest),
    placements: plan.placements,
    signAnchors: plan.signAnchors, doors: plan.doors,
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

/** One replaceable floor plate, two-sided unless it is the roof deck. */
function slab(sink: ReturnType<MeshBuilder['part']>, material: string, inset: number, width: number, depth: number, y: number, frame: PieceFrame, faces: 'both' | 'up' = 'both'): void {
  const local: V3[] = [[inset, y, inset], [width, y, inset], [width, y, depth], [inset, y, depth]];
  const ring = local.map(p => point(p, frame));
  sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  if (faces === 'both') sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}
