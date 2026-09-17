// What a shell occupies at runtime, measured before anything is written.
//
// The runtime GLB is one welded primitive per material slot plus the nodes a
// consumer addresses by name. The budget is measured on that packing, so the
// figure does not move with `options.glb`, and the generator can measure a mesh
// without serializing it.

import { weld, UINT16_LIMIT, VERTEX_BYTES } from './weld.ts';
import type { MeshBuilder, Part, Prim } from '../mesh/primitives.ts';

export interface RuntimeGeometry {
  vertices: number;
  triangles: number;
  bytes: number;
}

/** Face count, which welding never changes: the cheap half of the budget check. */
export function countTriangles(mb: MeshBuilder): number {
  let triangles = 0;
  for (const part of mb.parts) for (const prim of part.prims.values()) triangles += prim.indices.length / 3;
  return triangles;
}

export function measureRuntime(mb: MeshBuilder): RuntimeGeometry {
  const kept = keptParts(mb);
  const prims = [...groupByMaterial(mb.parts.filter((p) => !kept.has(p.name))).values()];
  for (const part of mb.parts) if (kept.has(part.name)) prims.push(...part.prims.values());
  const geometry: RuntimeGeometry = { vertices: 0, triangles: 0, bytes: 0 };
  for (const prim of prims) {
    if (prim.indices.length === 0) continue;
    const welded = weld(prim);
    const count = welded.positions.length / 3;
    geometry.vertices += count;
    geometry.triangles += welded.indices.length / 3;
    geometry.bytes += count * VERTEX_BYTES + welded.indices.length * (count < UINT16_LIMIT ? 2 : 4);
  }
  return geometry;
}

/** Parts a consumer addresses by node: moving leaves, anchors, replaceable slabs, and their children. */
export function keptParts(mb: MeshBuilder): Set<string> {
  const kept = new Set<string>();
  for (const part of mb.parts) if (part.pivot || part.keepNode) kept.add(part.name);
  for (const part of mb.parts) if (part.parent && kept.has(part.parent)) kept.add(part.name);
  return kept;
}

/** Concatenate every part's geometry into one primitive per material slot. */
export function groupByMaterial(parts: readonly Part[]): Map<string, Prim> {
  const byMaterial = new Map<string, Prim>();
  for (const part of parts) {
    for (const [key, prim] of part.prims) {
      if (prim.indices.length === 0) continue;
      let g = byMaterial.get(key);
      if (!g) { g = { positions: [], normals: [], uvs: [], indices: [] }; byMaterial.set(key, g); }
      const base = g.positions.length / 3;
      for (const position of prim.positions) g.positions.push(position);
      for (const normal of prim.normals) g.normals.push(normal);
      for (const uv of prim.uvs) g.uvs.push(uv);
      for (const i of prim.indices) g.indices.push(base + i);
    }
  }
  return byMaterial;
}
