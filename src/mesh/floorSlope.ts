import { edgeDir, edgeLength } from '../core/polygon.ts';
import { GARDEN_PIER } from '../sections/garden.ts';
import type { FloorLayout } from '../layout/model.ts';
import type { MeshBuilder, V3 } from './primitives.ts';

/** The central spine stays fixed while the outer glazed wings taper. */
export function slopePoint(floor: FloorLayout, point: V3): V3 {
  if (!floor.topOutline) return [...point];
  const base = floor.outline, top = floor.topOutline;
  const u = edgeDir(base, 0), v = edgeDir(base, 1);
  const width = edgeLength(base, 0), depth = edgeLength(base, 1);
  const cx = (base[0]![0] + base[2]![0]) / 2, cz = (base[0]![1] + base[2]![1]) / 2;
  const t = Math.max(0, Math.min(1, (point[1] - floor.elevation) / floor.height));
  const w = width + (edgeLength(top, 0) - width) * t;
  const d = depth + (edgeLength(top, 1) - depth) * t;
  const x = (point[0] - cx) * u[0] + (point[2] - cz) * u[1];
  const z = (point[0] - cx) * v[0] + (point[2] - cz) * v[1];
  const spine = floor.assembly?.sections.find(section => section.technique === 'garden-bay');
  const middle = (spine?.width ?? 0) / 2 + GARDEN_PIER;
  const wingEnd = width / 2 - GARDEN_PIER, targetEnd = w / 2 - GARDEN_PIER;
  const absolute = Math.abs(x);
  const nx = absolute <= middle ? x : Math.sign(x) * (absolute >= wingEnd
    ? targetEnd + absolute - wingEnd
    : middle + (absolute - middle) * (targetEnd - middle) / (wingEnd - middle));
  const nz = z * d / depth;
  return [cx + u[0] * nx + v[0] * nz, point[1], cz + u[1] * nx + v[1] * nz];
}

export function applyFloorSlopes(builder: MeshBuilder, floors: FloorLayout[]): void {
  for (const part of builder.parts) {
    const floor = floors.find(f => f.index === part.floor);
    if (!floor?.topOutline || part.sloped) continue;
    const pivot = part.pivot ?? [0, 0, 0];
    const newPivot = part.pivot ? slopePoint(floor, pivot) : [0, 0, 0];
    for (const primitive of part.prims.values()) {
      const p = primitive.positions;
      for (let i = 0; i < p.length; i += 3) {
        const mapped = slopePoint(floor, [p[i]! + pivot[0]!, p[i+1]! + pivot[1]!, p[i+2]! + pivot[2]!]);
        for (let axis = 0; axis < 3; axis++) p[i+axis] = mapped[axis]! - newPivot[axis]!;
      }
      for (let i = 0; i < primitive.indices.length; i += 3) {
        const [a, b, c] = primitive.indices.slice(i, i+3).map(index => index * 3);
        const ux = p[b!]! - p[a!]!, uy = p[b!+1]! - p[a!+1]!, uz = p[b!+2]! - p[a!+2]!;
        const vx = p[c!]! - p[a!]!, vy = p[c!+1]! - p[a!+1]!, vz = p[c!+2]! - p[a!+2]!;
        const normal = [uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx];
        const length = Math.hypot(...normal) || 1;
        for (const index of [a!, b!, c!]) for (let axis = 0; axis < 3; axis++) primitive.normals[index+axis] = normal[axis]! / length;
      }
    }
    if (part.pivot) part.pivot = newPivot as V3;
    part.sloped = true;
  }
}
