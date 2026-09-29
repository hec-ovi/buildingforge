import { Rng } from '../core/rng.ts';
import type { V3 } from './primitives.ts';
import type { TerraceKit } from './terraceKit.ts';

const LEAF = 'cyberpunk/hiromi-fern/mid#shade~exact';
const YOUNG_LEAF = 'cyberpunk/hiromi-fern/mid#leaf~exact';
const STEM = 'cyberpunk/hiromi-fern-stem/mid#rachis';

const add = (a: V3, b: V3): V3 => a.map((n, i) => n + b[i]!) as V3;
const sub = (a: V3, b: V3): V3 => a.map((n, i) => n - b[i]!) as V3;
const scale = (p: V3, n: number): V3 => p.map(v => v * n) as V3;
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (p: V3): V3 => scale(p, 1 / (Math.hypot(...p) || 1));

/** Natural fern clump: every frond grows from a separate root in the same crown.
 * Narrow pinnae follow a tapered arching rachis; there is no broad leaf card or
 * generic imported tree. Deterministic irregularity changes age, sweep and scale. */
export function terraceFern(t: TerraceKit, u: number, v: number, width: number, depth: number, height: number, seed: string): void {
  const rng = new Rng(seed, 'roof-fern');
  const count = 8 + rng.int(0, 1);
  for (let frond = 0; frond < count; frond++) {
    const angle = frond * Math.PI * 2 / count + rng.range(-.22, .22);
    const along: V3 = [Math.cos(angle), 0, Math.sin(angle)];
    const sideways: V3 = [-along[2], 0, along[0]];
    const root: V3 = [u + rng.range(-.065, .065), .715, v + rng.range(-.065, .065)];
    const reach = rng.range(.74, 1.0), rise = height * rng.range(.65, 1.05);
    const arc = (f: number): V3 => {
      const horizontal = reach * (1 - Math.pow(1 - f, 1.7));
      return [root[0] + along[0] * width * .44 * horizontal,
        root[1] + rise * (1.8 * f - 1.24 * f * f),
        root[2] + along[2] * depth * .44 * horizontal];
    };
    smoothTube(t, STEM, Array.from({ length: 13 }, (_, i) => arc(i / 12)), .010, .0018, 6);
    const pairs = 9 + rng.int(0, 2);
    for (let pair = 0; pair < pairs; pair++) for (const side of [-1, 1]) {
      const f = .18 + (pair + (side > 0 ? .26 : 0)) / pairs * .77;
      const origin = arc(f);
      const length = (Math.sin(Math.PI * Math.pow(f, .83)) * .19 + .015) * rng.range(.84, 1.14);
      const sweep = rng.range(.30, .62), droop = rng.range(-.10, .045);
      const vector: V3 = [sideways[0] * side + along[0] * sweep, droop, sideways[2] * side + along[2] * sweep];
      const halfWidth = length * rng.range(.115, .16);
      const leaf = (s: number, across: number): V3 => {
        const centre = add(origin, scale(vector, s * length));
        const spread = Math.pow(Math.sin(s * Math.PI), .8) * halfWidth * across;
        return [centre[0] + along[0] * spread,
          centre[1] + length * (.22 * Math.sin(s * Math.PI) - .07 * across * across * Math.sin(s * Math.PI)),
          centre[2] + along[2] * spread];
      };
      curvedLeaflet(t, frond % 4 === 0 ? YOUNG_LEAF : LEAF, leaf);
    }
  }
}

/** Smooth, tapered tube with a moving cross-section; also used for bent stool wire. */
export function smoothTube(t: TerraceKit, material: string, path: V3[], radius: number, tipRadius = radius, sides = 8): void {
  const positions: V3[] = [], normals: V3[] = [], uv: [number, number][] = [], indices: number[] = [];
  const axis = t.plan.axis;
  let distance = 0;
  let previousSide: V3 | null = null;
  for (let ring = 0; ring < path.length; ring++) {
    const p = path[ring]!, before = path[Math.max(0, ring - 1)]!, after = path[Math.min(path.length - 1, ring + 1)]!;
    const direction = normalize(sub(after, before));
    const projection: V3 | null = previousSide ? sub(previousSide, scale(direction, previousSide.reduce((n, v, i) => n + v * direction[i]!, 0))) : null;
    const side: V3 = projection && Math.hypot(...projection) > 1e-6 ? normalize(projection)
      : normalize(cross(direction, Math.abs(direction[1]) < .95 ? [0, 1, 0] : [1, 0, 0]));
    previousSide = side;
    const up = normalize(cross(direction, side));
    const r = radius + (tipRadius - radius) * ring / (path.length - 1);
    if (ring) distance += Math.hypot(...sub(p, path[ring - 1]!));
    for (let i = 0; i <= sides; i++) {
      const angle = i / sides * Math.PI * 2;
      const n = add(scale(side, Math.cos(angle)), scale(up, Math.sin(angle)));
      positions.push(t.point(...add(p, scale(n, r))));
      normals.push([axis[0] * n[0] - axis[1] * n[2], n[1], axis[1] * n[0] + axis[0] * n[2]]);
      uv.push([i / sides * Math.PI * 2 * r, distance]);
      if (ring && i < sides) {
        const a = (ring - 1) * (sides + 1) + i, b = ring * (sides + 1) + i;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  t.sink.indexed(material, positions, normals, uv, indices);
}

/** Curved leaflet with a smooth shallow midrib and normalized leaf UVs.
 * The dedicated exported material is double-sided, avoiding duplicated backs.
 * Every blade has a physical outline; the texture supplies fine venation only. */
function curvedLeaflet(t: TerraceKit, material: string, point: (along: number, across: number) => V3): void {
  const positions: V3[] = [], normals: V3[] = [], uv: [number, number][] = [], indices: number[] = [];
  const steps = 3, axis = t.plan.axis, epsilon = .0001;
  for (const face of [1]) {
    const offset = positions.length;
    for (let i = 0; i <= steps; i++) for (const side of [-1, 0, 1]) {
      const f = i / steps, sample = Math.max(.001, Math.min(.999, f));
      const along = sub(point(sample + epsilon, side), point(sample - epsilon, side));
      const across = sub(point(sample, side + epsilon), point(sample, side - epsilon));
      let n = normalize(cross(along, across));
      if (n[1] < 0) n = scale(n, -1);
      positions.push(t.point(...point(f, side)));
      normals.push([face * (axis[0] * n[0] - axis[1] * n[2]), face * n[1], face * (axis[1] * n[0] + axis[0] * n[2])]);
      uv.push([(side + 1) / 2, f]);
    }
    const triangle = (a: number, b: number, c: number) => {
      const normal = cross(sub(positions[b]!, positions[a]!), sub(positions[c]!, positions[a]!));
      if (normal[1] * face < 0) indices.push(a, c, b); else indices.push(a, b, c);
    };
    for (let i = 0; i < steps; i++) for (let side = 0; side < 2; side++) {
      const a = offset + i * 3 + side, b = a + 3;
      if (i !== steps - 1) triangle(a, b, b + 1);
      if (i !== 0) triangle(a, b + 1, a + 1);
    }
  }
  t.sink.indexed(material, positions, normals, uv, indices);
}
