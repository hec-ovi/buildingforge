import { edgeDir, edgeNormal, type P2 } from '../core/polygon.ts';
import { fixedPanelAxis } from '../layout/module.ts';
import type { PartSink, V3 } from './primitives.ts';
import type { WallPiece } from './wallcut.ts';

interface PanelField {
  outline: P2[];
  edge: number;
  elevation: number;
  height: number;
  width: number;
  panelHeight: number;
  jointWidth: number;
  pieces: WallPiece[];
  material: string;
}

export const PANEL_JOINT_DEPTH = 0.012;
const BEVEL = 0.004;

/** Complete panel modules with inset joints and bevelled edges, clipped to the wall's solid pieces. */
export function meshPanelField(sink: PartSink, field: PanelField): void {
  const { outline, edge, elevation, height, width, panelHeight, jointWidth, pieces, material } = field;
  const origin = outline[edge]!;
  const next = outline[(edge + 1) % outline.length]!;
  const length = Math.hypot(next[0] - origin[0], next[1] - origin[1]);
  const horizontal = fixedPanelAxis(length, width);
  const vertical = fixedPanelAxis(height, panelHeight);
  const uOrigin = horizontal.borders[0];
  const yOrigin = elevation + vertical.borders[0];
  const tangent = edgeDir(outline, edge), normal = edgeNormal(outline, edge);
  const world = ([u, y]: P2, depth: number): V3 => [
    origin[0] + tangent[0] * u + normal[0] * depth,
    y,
    origin[1] + tangent[1] * u + normal[1] * depth,
  ];
  const outward: V3 = [normal[0], 0, normal[1]];
  const solid = pieces.map((piece) => [piece.bl, piece.br, piece.tr, piece.tl]);
  const emit = (region: P2[], depth: (point: P2) => number) => {
    for (const piece of solid) {
      const polygon = clipConvex(region, piece);
      const uv = ([u, y]: P2): P2 => [u - uOrigin, yOrigin - y];
      for (let i = 1; i + 1 < polygon.length; i++) {
        const a = polygon[0]!, b = polygon[i]!, c = polygon[i + 1]!;
        if (Math.abs(cross2(a, b, c)) < 1e-10) continue;
        sink.triFacing(material, world(a, depth(a)), world(b, depth(b)), world(c, depth(c)), outward,
          [uv(a), uv(b), uv(c)]);
      }
    }
  };

  const columns = Math.round((length - 2 * uOrigin) / width);
  const rows = Math.round((height - 2 * vertical.borders[0]) / panelHeight);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const u0 = uOrigin + column * width + jointWidth / 2;
    const u1 = uOrigin + (column + 1) * width - jointWidth / 2;
    const y0 = yOrigin + row * panelHeight + jointWidth / 2;
    const y1 = yOrigin + (row + 1) * panelHeight - jointWidth / 2;
    const b = Math.min(BEVEL, (u1 - u0) / 4, (y1 - y0) / 4);
    emit([[u0 + b, y0 + b], [u1 - b, y0 + b], [u1 - b, y1 - b], [u0 + b, y1 - b]], () => 0);
    emit([[u0, y0], [u0 + b, y0 + b], [u0 + b, y1 - b], [u0, y1]],
      ([u]) => -PANEL_JOINT_DEPTH * (1 - (u - u0) / b));
    emit([[u1 - b, y0 + b], [u1, y0], [u1, y1], [u1 - b, y1 - b]],
      ([u]) => -PANEL_JOINT_DEPTH * (1 - (u1 - u) / b));
    emit([[u0, y0], [u1, y0], [u1 - b, y0 + b], [u0 + b, y0 + b]],
      ([, y]) => -PANEL_JOINT_DEPTH * (1 - (y - y0) / b));
    emit([[u0 + b, y1 - b], [u1 - b, y1 - b], [u1, y1], [u0, y1]],
      ([, y]) => -PANEL_JOINT_DEPTH * (1 - (y1 - y) / b));
  }
}

function cross2(a: P2, b: P2, p: P2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

/** Intersection of two convex CCW face polygons, retaining diagonal aperture boundaries. */
function clipConvex(subject: P2[], clip: P2[]): P2[] {
  let result = subject;
  for (let edge = 0; edge < clip.length; edge++) {
    const a = clip[edge]!, b = clip[(edge + 1) % clip.length]!;
    const input = result;
    result = [];
    for (let i = 0; i < input.length; i++) {
      const p = input[i]!, q = input[(i + 1) % input.length]!;
      const dp = cross2(a, b, p), dq = cross2(a, b, q);
      if (dp >= -1e-10) result.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return result;
}
