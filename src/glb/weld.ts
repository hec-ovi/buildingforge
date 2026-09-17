// Welding pass between the mesher and the GLB buffers.
//
// The mesher writes one vertex per face corner, because every helper fixes its
// own winding and flat normal. Coincident corners are therefore duplicated
// wherever two faces of a surface meet. Snapping attributes to a fixed grid and
// then merging identical (position, normal, uv) triples removes the duplicates
// without changing a single face: a corner shared by two faces with different
// normals still keeps one vertex per normal.

import type { Prim } from '../mesh/primitives.ts';

/** 0.01 mm for positions and UV metres, 1e-5 for unit normals. */
const GRID = 1e5;

/** Primitives above this vertex count keep 32-bit indices. */
export const UINT16_LIMIT = 65536;

/** Packed bytes per vertex: float position, normalized short normal, float UV. */
export const VERTEX_BYTES = 4 * 3 + 2 * 3 + 4 * 2;

/**
 * Normals as normalized signed shorts, the KHR_mesh_quantization encoding.
 * A flat architectural face lands within 0.002 degrees of its float normal and
 * the attribute costs six bytes instead of twelve.
 */
export function quantizedNormals(normals: number[]): Int16Array<ArrayBuffer> {
  const out = new Int16Array(new ArrayBuffer(normals.length * 2));
  for (let i = 0; i < normals.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, normals[i]!)) * 32767);
  return out;
}

const FIELDS = 8;

export function weld(prim: Prim): Prim {
  const total = prim.indices.length;
  const snapped = new Int32Array(FIELDS);
  const kept = new Int32Array(total * FIELDS);
  const buckets = new Map<number, number[]>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = new Array(total);
  let count = 0;

  for (let i = 0; i < total; i++) {
    const v = prim.indices[i] as number;
    snapped[0] = Math.round(prim.positions[v * 3]! * GRID);
    snapped[1] = Math.round(prim.positions[v * 3 + 1]! * GRID);
    snapped[2] = Math.round(prim.positions[v * 3 + 2]! * GRID);
    snapped[3] = Math.round(prim.normals[v * 3]! * GRID);
    snapped[4] = Math.round(prim.normals[v * 3 + 1]! * GRID);
    snapped[5] = Math.round(prim.normals[v * 3 + 2]! * GRID);
    snapped[6] = Math.round(prim.uvs[v * 2]! * GRID);
    snapped[7] = Math.round(prim.uvs[v * 2 + 1]! * GRID);

    let hash = 0x811c9dc5;
    for (let f = 0; f < FIELDS; f++) hash = Math.imul(hash ^ snapped[f]!, 0x01000193);
    let bucket = buckets.get(hash);
    let index = -1;
    if (bucket) {
      for (const candidate of bucket) {
        const base = candidate * FIELDS;
        let same = true;
        for (let f = 0; f < FIELDS && same; f++) same = kept[base + f] === snapped[f];
        if (same) { index = candidate; break; }
      }
    } else {
      bucket = [];
      buckets.set(hash, bucket);
    }
    if (index < 0) {
      index = count++;
      kept.set(snapped, index * FIELDS);
      bucket.push(index);
      positions.push(snapped[0]! / GRID, snapped[1]! / GRID, snapped[2]! / GRID);
      normals.push(snapped[3]! / GRID, snapped[4]! / GRID, snapped[5]! / GRID);
      uvs.push(snapped[6]! / GRID, snapped[7]! / GRID);
    }
    indices[i] = index;
  }
  return { positions, normals, uvs, indices };
}
