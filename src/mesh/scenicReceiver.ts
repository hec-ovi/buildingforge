import type { PartSink, V3 } from './primitives.ts';
import type { P2 } from '../types.ts';

/** Positive signed distance is behind the finished lining, in scenic source space. */
export interface ReceiverPlane { distance(point: V3): number }
interface Vertex { point: V3; uv: P2 }

/** Removable scenery begins behind the permanent shell's finished window reveals. */
export function scenicReceiver(sink: PartSink, material: string, points: V3[], normal: V3,
  uvs: P2[], planes: readonly ReceiverPlane[] = []): void {
  if (!planes.length) {
    sink.quadFacing(material, points[0]!, points[1]!, points[2]!, points[3]!, normal, uvs);
    return;
  }
  let polygon: Vertex[] = points.map((point, i) => ({ point, uv: uvs[i]! }));
  for (const plane of planes) {
    const next: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
      const da = plane.distance(a.point), db = plane.distance(b.point), insideA = da >= -1e-9, insideB = db >= -1e-9;
      if (insideA) next.push(a);
      if (insideA !== insideB) {
        const t = da / (da - db);
        next.push({ point: a.point.map((v, k) => v + t * (b.point[k]! - v)) as V3,
          uv: a.uv.map((v, k) => v + t * (b.uv[k]! - v)) as P2 });
      }
    }
    polygon = next;
  }
  for (let i = 1; i + 1 < polygon.length; i++) {
    const a = polygon[0]!, b = polygon[i]!, c = polygon[i + 1]!;
    sink.triFacing(material, a.point, b.point, c.point, normal, [a.uv, b.uv, c.uv]);
  }
}
