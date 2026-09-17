// One fitted window-frame ring: a welded extruded profile, shared by every
// opening of the same size, placed at the opening's own basis.

import type { P2 } from '../core/polygon.ts';
import { ringProfile, type RingSize } from './frameProfile.ts';
import type { PartSink, V3 } from './primitives.ts';

export interface FrameBasis {
  v: P2;
  dir: P2;
  n: P2;
}

export interface FrameRect {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** Extrudes one rectangular ring: mitred front and back faces, outer and inner returns. */
export function meshFrameRing(
  sink: PartSink, basis: FrameBasis, outer: FrameRect, inner: FrameRect,
  front: number, depth: number, material: string,
): void {
  const size: RingSize = {
    width: outer.u1 - outer.u0,
    height: outer.y1 - outer.y0,
    holeU: inner.u0 - outer.u0,
    holeY: inner.y0 - outer.y0,
    holeWidth: inner.u1 - inner.u0,
    holeHeight: inner.y1 - inner.y0,
    front,
    back: front - depth,
  };
  if (size.width < 1e-6 || size.height < 1e-6 || size.holeWidth < 0 || size.holeHeight < 0) return;
  const profile = ringProfile(size);

  const positions: V3[] = [];
  const normals: V3[] = [];
  const uvs: [number, number][] = [];
  for (const vertex of profile.vertices) {
    const u = outer.u0 + vertex.u;
    positions.push([
      basis.v[0] + basis.dir[0] * u + basis.n[0] * vertex.z,
      outer.y0 + vertex.y,
      basis.v[1] + basis.dir[1] * u + basis.n[1] * vertex.z,
    ]);
    const [du, dy, dn] = vertex.n;
    normals.push([basis.dir[0] * du + basis.n[0] * dn, dy, basis.dir[1] * du + basis.n[1] * dn]);
    uvs.push(vertex.uv);
  }
  // A left-handed face basis mirrors the profile's own winding.
  const handed = basis.dir[0] * basis.n[1] - basis.dir[1] * basis.n[0];
  const indices = handed >= 0 ? profile.indices : flipped(profile.indices);
  sink.indexed(material, positions, normals, uvs, indices);
}

function flipped(indices: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < indices.length; i += 3) out.push(indices[i]!, indices[i + 2]!, indices[i + 1]!);
  return out;
}
