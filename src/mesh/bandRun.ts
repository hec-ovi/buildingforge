// One floor-band run between the fitted outer points of its two corners.

import type { P2 } from '../core/polygon.ts';
import type { PartSink, V3 } from './primitives.ts';

export interface BandFrame {
  v: [number, number];
  dir: [number, number];
  n: [number, number];
  len: number;
}

export function meshBandRun(
  sink: PartSink, frame: BandFrame, y0: number, y1: number,
  outerStart: P2, outerEnd: P2, material: string,
): void {
  const innerStart = point(frame, 0, y0, 0);
  const innerEnd = point(frame, frame.len, y0, 0);
  const innerEndTop = point(frame, frame.len, y1, 0);
  const innerStartTop = point(frame, 0, y1, 0);
  const outerStartBottom: V3 = [outerStart[0], y0, outerStart[1]];
  const outerEndBottom: V3 = [outerEnd[0], y0, outerEnd[1]];
  const outerEndTop: V3 = [outerEnd[0], y1, outerEnd[1]];
  const outerStartTop: V3 = [outerStart[0], y1, outerStart[1]];
  const height = y1 - y0;
  const outerLength = Math.hypot(outerEnd[0] - outerStart[0], outerEnd[1] - outerStart[1]);
  const innerUv: [number, number][] = [[0, height], [frame.len, height], [frame.len, 0], [0, 0]];
  const outerUv: [number, number][] = [[0, height], [outerLength, height], [outerLength, 0], [0, 0]];
  const capUv = (point: V3): [number, number] => {
    const dx = point[0] - frame.v[0], dz = point[2] - frame.v[1];
    return [dx * frame.dir[0] + dz * frame.dir[1], dx * frame.n[0] + dz * frame.n[1]];
  };

  sink.quadFacing(material, outerStartBottom, outerEndBottom, outerEndTop, outerStartTop,
    [frame.n[0], 0, frame.n[1]], outerUv);
  sink.quadFacing(material, innerEnd, innerStart, innerStartTop, innerEndTop,
    [-frame.n[0], 0, -frame.n[1]], innerUv);
  sink.quadFacing(material, innerStartTop, innerEndTop, outerEndTop, outerStartTop,
    [0, 1, 0], [capUv(innerStartTop), capUv(innerEndTop), capUv(outerEndTop), capUv(outerStartTop)]);
  sink.quadFacing(material, outerStartBottom, outerEndBottom, innerEnd, innerStart,
    [0, -1, 0], [capUv(outerStartBottom), capUv(outerEndBottom), capUv(innerEnd), capUv(innerStart)]);
}

function point(frame: BandFrame, u: number, y: number, depth: number): V3 {
  return [
    frame.v[0] + frame.dir[0] * u + frame.n[0] * depth,
    y,
    frame.v[1] + frame.dir[1] * u + frame.n[1] * depth,
  ];
}
