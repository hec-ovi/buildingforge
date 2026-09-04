import type { P2 } from '../core/polygon.ts';
import type { DoorAssembly } from '../types.ts';
import type { FrameBasis } from './frameRing.ts';
import type { PartSink, V3 } from './primitives.ts';

/** Pressed metal panels with clipped corners, a sloping rim and metre-scale UVs. */
export function meshDoorPanels(
  sink: PartSink, basis: FrameBasis, a: number, b: number, bottom: number, top: number,
  assembly: DoorAssembly, material: string,
): void {
  if (assembly.set === 'industrial-ribbed') return;
  const width = b - a, height = top - bottom;
  const margin = Math.min(0.1, width * 0.12);
  const base = -assembly.recessDepth - 0.002;
  const front = -assembly.recessDepth + 0.018;
  const ranges: [number, number][] = assembly.set === 'layered'
    ? [[bottom + margin, bottom + height * 0.36], [bottom + height * 0.36 + 0.035, top - margin]]
    : [[bottom + margin, top - margin]];
  for (const [y0, y1] of ranges) {
    const cut = Math.min(width * (assembly.set === 'plain' ? 0.07 : 0.17), (y1 - y0) * 0.12);
    const bevel = Math.min(0.025, width * 0.035);
    const outer = clippedRect(a + margin, b - margin, y0, y1, cut);
    const inner = clippedRect(a + margin + bevel, b - margin - bevel, y0 + bevel, y1 - bevel, cut * 0.85);
    panel(sink, basis, outer, inner, base, front, material);
  }
}

function clippedRect(a: number, b: number, y0: number, y1: number, cut: number): P2[] {
  return [[a + cut, y0], [b - cut, y0], [b, y0 + cut], [b, y1 - cut],
    [b - cut, y1], [a + cut, y1], [a, y1 - cut], [a, y0 + cut]];
}

function panel(
  sink: PartSink, basis: FrameBasis, outer: P2[], inner: P2[], back: number, front: number, material: string,
): void {
  const point = ([u, y]: P2, depth: number): V3 => [
    basis.v[0] + basis.dir[0] * u + basis.n[0] * depth, y,
    basis.v[1] + basis.dir[1] * u + basis.n[1] * depth,
  ];
  const normal: V3 = [basis.n[0], 0, basis.n[1]];
  const uv = ([u, y]: P2): P2 => [u - outer[0]![0], outer[0]![1] - y];
  for (let i = 0; i < outer.length; i++) {
    const next = (i + 1) % outer.length;
    sink.quadFacing(material, point(outer[i]!, back), point(outer[next]!, back),
      point(inner[next]!, front), point(inner[i]!, front), normal,
      [uv(outer[i]!), uv(outer[next]!), uv(inner[next]!), uv(inner[i]!)]);
  }
  for (let i = 1; i < inner.length - 1; i++) {
    sink.triFacing(material, point(inner[0]!, front), point(inner[i]!, front), point(inner[i + 1]!, front), normal,
      [uv(inner[0]!), uv(inner[i]!), uv(inner[i + 1]!)]);
    sink.triFacing(material, point(outer[0]!, back), point(outer[i]!, back), point(outer[i + 1]!, back),
      [-normal[0], 0, -normal[2]], [uv(outer[0]!), uv(outer[i]!), uv(outer[i + 1]!)]);
  }
}
