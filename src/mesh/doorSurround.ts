import type { P2 } from '../core/polygon.ts';
import type { FrameBasis } from './frameRing.ts';
import type { PartSink, V3 } from './primitives.ts';

/** A closed U-shaped surround with clipped head corners and a bevelled face. */
export function meshDoorSurround(
  sink: PartSink, basis: FrameBasis, a: number, b: number, bottom: number, top: number,
  width: number, depth: number, material: string,
): void {
  const left = a, right = b, head = top;
  const cut = width * 0.55;
  const inner: P2[] = [[left, bottom], [left, head - cut], [left, head],
    [right, head], [right, head - cut], [right, bottom]];
  const outer: P2[] = [[left - width, bottom], [left - width, head + width - cut],
    [left - width + cut, head + width], [right + width - cut, head + width],
    [right + width, head + width - cut], [right + width, bottom]];
  const crest = inner.map(([u, y], i): P2 => [u + (outer[i]![0] - u) * 0.38,
    y + (outer[i]![1] - y) * 0.38]);
  const point = ([u, y]: P2, d: number): V3 => [
    basis.v[0] + basis.dir[0] * u + basis.n[0] * d, y,
    basis.v[1] + basis.dir[1] * u + basis.n[1] * d,
  ];
  const normal: V3 = [basis.n[0], 0, basis.n[1]];
  const join = (first: P2[], firstDepth: number, second: P2[], secondDepth: number, outward: V3) => {
    for (let i = 0; i < first.length - 1; i++) {
      const next = i + 1;
      const length = Math.hypot(first[next]![0] - first[i]![0], first[next]![1] - first[i]![1]);
      const thickness = Math.hypot(second[i]![0] - first[i]![0], second[i]![1] - first[i]![1], secondDepth - firstDepth);
      const a = point(first[i]!, firstDepth), b = point(first[next]!, firstDepth);
      const c = point(second[next]!, secondDepth), d = point(second[i]!, secondDepth);
      sink.triFacing(material, a, b, c, outward, [[0, 0], [length, 0], [length, thickness]]);
      sink.triFacing(material, a, c, d, outward, [[0, 0], [length, thickness], [0, thickness]]);
    }
  };
  join(inner, depth * 0.72, crest, depth, normal);
  join(crest, depth, outer, depth * 0.4, normal);
  join(outer, 0, inner, 0, [-normal[0], 0, -normal[2]]);
  for (const [path, d, sign] of [[inner, depth * 0.72, 1], [outer, depth * 0.4, -1]] as const) {
    for (let i = 0; i < path.length - 1; i++) {
      const next = i + 1;
      const du = path[next]![0] - path[i]![0], dy = path[next]![1] - path[i]![1];
      const length = Math.hypot(du, dy);
      const outward: V3 = [basis.dir[0] * dy * sign, -du * sign, basis.dir[1] * dy * sign];
      sink.quadFacing(material, point(path[i]!, 0), point(path[next]!, 0),
        point(path[next]!, d), point(path[i]!, d), outward,
        [[0, 0], [length, 0], [length, d], [0, d]]);
    }
  }
  for (const i of [0, inner.length - 1]) {
    const profile: [P2, number][] = [[inner[i]!, 0], [outer[i]!, 0], [outer[i]!, depth * 0.4],
      [crest[i]!, depth], [inner[i]!, depth * 0.72]];
    for (let j = 1; j < profile.length - 1; j++) {
      const p = profile[j]!, q = profile[j + 1]!;
      sink.triFacing(material, point(profile[0]![0], 0), point(p[0], p[1]), point(q[0], q[1]),
        [0, -1, 0], [[0, 0], [Math.abs(p[0][0] - inner[i]![0]), p[1]], [Math.abs(q[0][0] - inner[i]![0]), q[1]]]);
    }
  }
}
