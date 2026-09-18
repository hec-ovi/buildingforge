// Assembles a building out of one family's pieces.
//
// Nothing here generates geometry for a parcel. It decides which piece stands
// where, and adds only what belongs to the building rather than to a piece: the
// floor slabs the interior replaces, the entrance a consumer opens, and the
// wire anchors the connections layer asked for.

import { MeshBuilder, type Part, type Prim, type V3 } from '../mesh/primitives.ts';
import { ExteriorError } from '../core/errors.ts';
import { measureRuntime } from '../glb/measure.ts';
import { lotEdges, prepareAssembly } from './plan.ts';
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
      const moved: Prim = { positions: [], normals: [], uvs: [...prim.uvs], indices: [...prim.indices] };
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

export async function assembleFromPieces(request: AssemblyRequest, options: TextureOptions = {}): Promise<AssemblyResult> {
  const recipe = recipeFor(request.family);
  const { plan, pieces } = prepareAssembly(request);
  const seed = request.seed ?? request.buildingId;
  const kinds = new Map([...pieces].map(([id, built]) => [id, built.mb]));

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
  if (entrance) {
    const source = kinds.get(entrance.piece)!;
    transfer(source, building, new Set(source.parts.filter(p => p.pivot || p.keepNode).map(p => p.name)), entrance);
  }
  for (const anchor of request.anchors ?? []) {
    const edge = lotEdges(width, depth)[anchor.edge];
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
function slab(sink: ReturnType<MeshBuilder['part']>, material: string, inset: number, width: number, depth: number, y: number, faces: 'both' | 'up' = 'both'): void {
  const ring: V3[] = [[inset, y, inset], [width, y, inset], [width, y, depth], [inset, y, depth]];
  sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  if (faces === 'both') sink.quadFacing(material, ring[0]!, ring[1]!, ring[2]!, ring[3]!, [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}
