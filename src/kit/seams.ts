import type { MeshBuilder, Prim, V3 } from '../mesh/primitives.ts';
import { authorPiece } from './author.ts';
import { BANDS, type Band, type PieceKind } from './module.ts';

type Point = [number, number];
const profiles = new Map<string, Point[]>();
const EPS = 1e-7;

/** All mating bands use the same vertices along their common cross section. */
function profile(family: string, kind: PieceKind): Point[] {
  const shape = kind === 'corner' ? 'corner' : 'bay';
  const key = `${family}/${shape}`;
  const cached = profiles.get(key);
  if (cached) return cached;
  const points = new Map<string, Point>();
  for (const piece of shape === 'corner' ? ['corner'] as const : ['bay', 'entrance-bay'] as const) {
    for (const band of BANDS) {
      const { mb, height } = authorPiece({ family, piece, band });
      for (const part of mb.parts) for (const prim of part.prims.values()) for (const i of prim.indices) {
        const y = prim.positions[3 * i + 1]! + (part.pivot?.[1] ?? 0);
        if ((band === 'ground' || Math.abs(y) > EPS) && (band === 'crown' || Math.abs(y - height) > EPS)) continue;
        const p: Point = [prim.positions[3 * i]! + (part.pivot?.[0] ?? 0), prim.positions[3 * i + 2]! + (part.pivot?.[2] ?? 0)];
        points.set(p.map(v => v.toFixed(7)).join(','), p);
      }
    }
  }
  const result = [...points.values()];
  profiles.set(key, result);
  return result;
}

function split(prim: Prim, plane: number, points: Point[], shift: V3): void {
  const at = (i: number): V3 => prim.positions.slice(i * 3, i * 3 + 3) as V3;
  const append = (a: number, b: number, t: number): number => {
    const index = prim.positions.length / 3;
    for (const [values, stride] of [[prim.positions, 3], [prim.normals, 3], [prim.uvs, 2]] as const) {
      for (let axis = 0; axis < stride; axis++) values.push(values[a * stride + axis]! * (1 - t) + values[b * stride + axis]! * t);
    }
    return index;
  };
  const indices: number[] = [];
  const boundaries = new Map((prim.faces ?? []).map(face => [face.first, face]));
  const faces: NonNullable<Prim['faces']> = [];
  for (let i = 0; i < prim.indices.length; i += 3) {
    if (boundaries.has(i)) faces.push({ first: indices.length, count: 0 });
    let triangles = [prim.indices.slice(i, i + 3)];
    for (const point of points) {
      const next: number[][] = [];
      for (const triangle of triangles) {
        let divided = false;
        for (let edge = 0; edge < 3; edge++) {
          const a = triangle[edge]!, b = triangle[(edge + 1) % 3]!, c = triangle[(edge + 2) % 3]!;
          const p = at(a), q = at(b);
          if (Math.abs(p[1] + shift[1] - plane) > EPS || Math.abs(q[1] + shift[1] - plane) > EPS) continue;
          const dx = q[0] - p[0], dz = q[2] - p[2], length2 = dx * dx + dz * dz;
          if (length2 < EPS * EPS) continue;
          const x = point[0] - p[0] - shift[0], z = point[1] - p[2] - shift[2];
          const t = (x * dx + z * dz) / length2;
          if (t <= EPS || t >= 1 - EPS || Math.hypot(x - t * dx, z - t * dz) > EPS) continue;
          const mid = append(a, b, t);
          next.push([a, mid, c], [mid, b, c]);
          divided = true;
          break;
        }
        if (!divided) next.push(triangle);
      }
      triangles = next;
    }
    for (const triangle of triangles) indices.push(...triangle);
    if (faces.length) faces.at(-1)!.count += triangles.length * 3;
  }
  prim.indices = indices;
  if (prim.faces) prim.faces = faces;
}

export function mateBands(mb: MeshBuilder, family: string, kind: PieceKind, band: Band, height: number): void {
  const points = profile(family, kind);
  for (const part of mb.parts) for (const prim of part.prims.values()) {
    if (band !== 'ground') split(prim, 0, points, part.pivot ?? [0, 0, 0]);
    if (band !== 'crown') split(prim, height, points, part.pivot ?? [0, 0, 0]);
  }
}
