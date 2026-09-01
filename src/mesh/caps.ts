// Horizontal caps: floor slabs, roof, terrace rings. Earcut triangulates;
// winding is verified against the wanted direction and flipped when needed,
// so ring orientation can never invert a face.

import earcut from 'earcut';
import type { P2 } from '../core/polygon.ts';
import type { PartSink, V3 } from './primitives.ts';

export function capUp(sink: PartSink, material: string, ring: P2[], y: number, hole?: P2[]): void {
  cap(sink, material, ring, y, hole, true);
}

export function capDown(sink: PartSink, material: string, ring: P2[], y: number): void {
  cap(sink, material, ring, y, undefined, false);
}

function cap(sink: PartSink, material: string, ring: P2[], y: number, hole: P2[] | undefined, up: boolean): void {
  const flat: number[] = [];
  for (const [x, z] of ring) flat.push(x, z);
  const holeIndices: number[] = [];
  if (hole) {
    holeIndices.push(ring.length);
    for (const [x, z] of hole) flat.push(x, z);
  }
  const tris = earcut(flat, holeIndices.length ? holeIndices : undefined, 2);
  const want: V3 = up ? [0, 1, 0] : [0, -1, 0];
  for (let i = 0; i + 2 < tris.length; i += 3) {
    const ia = tris[i] as number, ib = tris[i + 1] as number, ic = tris[i + 2] as number;
    const a: V3 = [flat[ia * 2] as number, y, flat[ia * 2 + 1] as number];
    const b: V3 = [flat[ib * 2] as number, y, flat[ib * 2 + 1] as number];
    const c: V3 = [flat[ic * 2] as number, y, flat[ic * 2 + 1] as number];
    // Normal of (a,b,c) on the XZ plane: cross(b-a, c-a).y decides which way it faces.
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const flip = (ny > 0) !== up;
    const [p, q, r] = flip ? [a, c, b] : [a, b, c];
    sink.tri(material, p, q, r, [[p[0], p[2]], [q[0], q[2]], [r[0], r[2]]]);
  }
}
