// The welded cross-section of one extruded rectangular ring, built once per
// size and replayed at every opening that shares it.

export interface RingSize {
  /** outer extents, measured from the outer bottom-left corner */
  width: number;
  height: number;
  /** inner hole, measured from the same corner */
  holeU: number;
  holeY: number;
  holeWidth: number;
  holeHeight: number;
  /** face planes along the basis normal */
  front: number;
  back: number;
}

/** A vertex in the ring's own frame: metres along the face, up, and out. */
export interface RingVertex {
  u: number;
  y: number;
  z: number;
  /** normal as coefficients of (face direction, up, face normal) */
  n: [number, number, number];
  uv: [number, number];
}

export interface RingProfile {
  vertices: RingVertex[];
  indices: number[];
}

type Corner = [u: number, y: number];

const KEY_PRECISION = 1e6;
const CACHE_LIMIT = 512;
const cache = new Map<string, RingProfile>();

function key(size: RingSize): string {
  return [size.width, size.height, size.holeU, size.holeY, size.holeWidth, size.holeHeight, size.front, size.back]
    .map((n) => Math.round(n * KEY_PRECISION)).join(',');
}

/** Same size, same profile: openings of one size share a single built ring. */
export function ringProfile(size: RingSize): RingProfile {
  const id = key(size);
  const hit = cache.get(id);
  if (hit) return hit;
  const built = buildRing(size);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(id, built);
  return built;
}

function buildRing(size: RingSize): RingProfile {
  const outer: Corner[] = [[0, 0], [size.width, 0], [size.width, size.height], [0, size.height]];
  const inner: Corner[] = [
    [size.holeU, size.holeY],
    [size.holeU + size.holeWidth, size.holeY],
    [size.holeU + size.holeWidth, size.holeY + size.holeHeight],
    [size.holeU, size.holeY + size.holeHeight],
  ];
  const vertices: RingVertex[] = [];
  const indices: number[] = [];

  // Front and back faces: mitred corners, so the four members share eight
  // vertices. UVs run in face metres, which keeps every member's map along its
  // own length and lets the mitre weld.
  for (const [z, n, flip] of [[size.front, 1, false], [size.back, -1, true]] as const) {
    const base = vertices.length;
    for (const [u, y] of [...outer, ...inner]) {
      vertices.push({ u, y, z, n: [0, 0, n], uv: [u, y] });
    }
    for (let k = 0; k < 4; k++) {
      const next = (k + 1) % 4;
      const [a, b] = [outer[k]!, outer[next]!];
      const [c, d] = [inner[next]!, inner[k]!];
      // A member with no width, where the hole meets the outer edge, is not drawn.
      if (area(a, b, c, d) < 1e-9) continue;
      quad(indices, base + k, base + next, base + 4 + next, base + 4 + k, flip);
    }
  }

  // Outer and inner skirts: one face per edge, each with its own normal.
  const edgeNormals: [number, number, number][] = [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  for (const [ring, sign] of [[outer, 1], [inner, -1]] as const) {
    for (let k = 0; k < 4; k++) {
      const a = ring[k]!, b = ring[(k + 1) % 4]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-6) continue;
      const [nu, ny] = edgeNormals[k]!;
      const n: [number, number, number] = [nu * sign, ny * sign, 0];
      const depth = size.front - size.back;
      const base = vertices.length;
      vertices.push({ u: a[0], y: a[1], z: size.front, n, uv: [0, 0] });
      vertices.push({ u: a[0], y: a[1], z: size.back, n, uv: [0, depth] });
      vertices.push({ u: b[0], y: b[1], z: size.back, n, uv: [length, depth] });
      vertices.push({ u: b[0], y: b[1], z: size.front, n, uv: [length, 0] });
      quad(indices, base, base + 1, base + 2, base + 3, sign < 0);
    }
  }
  return { vertices, indices };
}

/** Absolute area of a planar quad given in (u, y). */
function area(a: Corner, b: Corner, c: Corner, d: Corner): number {
  const ring = [a, b, c, d];
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const p = ring[i]!, q = ring[(i + 1) % 4]!;
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(sum) / 2;
}

function quad(indices: number[], a: number, b: number, c: number, d: number, flip: boolean): void {
  if (flip) indices.push(a, c, b, a, d, c);
  else indices.push(a, b, c, a, c, d);
}
