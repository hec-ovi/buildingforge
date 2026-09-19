import type { Prim, V3 } from './primitives.ts';

type UV = [number, number];
const subtract = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a.reduce((sum, value, axis) => sum + value * b[axis]!, 0);
const unit = (vector: V3): V3 => {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length) as V3;
};

/** Measure each receiving face after mitres, curves and taper placement. */
export function mapSurfaceUvs(primitive: Prim, alignment: 'tile' | 'exact'): Prim {
  const output: Prim = { positions: [], normals: [], uvs: [], indices: [], faces: [] };
  const faces = primitive.faces ?? Array.from({ length: primitive.indices.length / 3 }, (_, i) => ({ first: i * 3, count: 3 }));
  const emit = (indices: number[]) => {
    const face = [...new Set(indices)];
    const points = face.map(index => primitive.positions.slice(index * 3, index * 3 + 3) as V3);
    const authored = face.map(index => primitive.uvs.slice(index * 2, index * 2 + 2) as UV);
    const uv = alignment === 'exact' ? fitted(authored) : metric(points, authored);
    if (!uv && indices.length > 3) {
      for (let i = 0; i < indices.length; i += 3) emit(indices.slice(i, i + 3));
      return;
    }
    const base = output.positions.length / 3;
    face.forEach((index, i) => {
      output.positions.push(...points[i]!);
      output.normals.push(...primitive.normals.slice(index * 3, index * 3 + 3));
      output.uvs.push(...(uv ?? authored)[i]!);
    });
    output.faces!.push({ first: output.indices.length, count: indices.length });
    const remap = new Map(face.map((index, i) => [index, base + i]));
    for (const index of indices) output.indices.push(remap.get(index)!);
  };
  for (const face of faces) emit(primitive.indices.slice(face.first, face.first + face.count));
  return output;
}

/** Keep fitted images and crops; fit an unfitted plate once over its face. */
function fitted(uv: UV[]): UV[] {
  if (uv.every(point => point.every(value => value >= 0 && value <= 1))) return uv;
  const low = [0, 1].map(axis => Math.min(...uv.map(point => point[axis]!)));
  const span = [0, 1].map(axis => Math.max(...uv.map(point => point[axis]!)) - low[axis]!);
  return uv.map(point => point.map((value, axis) => span[axis]! > 1e-12 ? (value - low[axis]!) / span[axis]! : 0) as UV);
}

/** Preserve the authored U direction and phase, with orthogonal metre axes. */
function metric(points: V3[], uv: UV[]): UV[] | undefined {
  const origin = points[0]!, start = uv[0]!;
  let axes: [V3, V3] | undefined;
  for (let i = 1; i + 1 < points.length; i++) {
    const a = subtract(points[i]!, origin), b = subtract(points[i + 1]!, origin);
    const s: UV = [uv[i]![0] - start[0], uv[i]![1] - start[1]];
    const t: UV = [uv[i + 1]![0] - start[0], uv[i + 1]![1] - start[1]];
    const determinant = s[0] * t[1] - s[1] * t[0];
    if (Math.abs(determinant) < 1e-12) continue;
    const du = a.map((value, axis) => (value * t[1] - b[axis]! * s[1]) / determinant) as V3;
    const dv = a.map((value, axis) => (b[axis]! * s[0] - value * t[0]) / determinant) as V3;
    if (Math.hypot(...du) < 1e-10) continue;
    const u = unit(du), projection = dot(dv, u);
    const perpendicular = dv.map((value, axis) => value - u[axis]! * projection) as V3;
    if (Math.hypot(...perpendicular) < 1e-10) continue;
    axes = [u, unit(perpendicular)];
    break;
  }
  if (!axes) return undefined;
  const [u, v] = axes;
  const result = points.map(point => {
    const delta = subtract(point, origin);
    return [start[0] + dot(delta, u), start[1] + dot(delta, v)] as UV;
  });
  // Nonplanar quads need separate planar charts for their two triangles.
  for (let i = 1; i < points.length; i++) {
    const delta = subtract(points[i]!, origin);
    const du = result[i]![0] - start[0], dv = result[i]![1] - start[1];
    if (Math.abs(dot(delta, delta) - du ** 2 - dv ** 2) > 1e-8) return undefined;
  }
  return result;
}
