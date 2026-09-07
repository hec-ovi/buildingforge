import { ExteriorError } from '../core/errors.ts';
import { edgeLength, edgeNormal, pointSegmentDistance, type P2 } from '../core/polygon.ts';
import type { StreetAccess } from '../types.ts';

/** Door-sized faces nearest the access point, constrained to its authored street side. */
export function entranceCandidates(outline: P2[], point: P2, street?: StreetAccess): number[] {
  const normal = street ? streetNormal(street, point) : undefined;
  const edges = outline.map((_, e) => {
    const n = edgeNormal(outline, e);
    return { e, len: edgeLength(outline, e),
      alignment: normal ? n[0] * normal[0] + n[1] * normal[1] : 0,
      d: pointSegmentDistance(point, outline[e]!, outline[(e + 1) % outline.length]!) };
  }).filter(edge => !normal || edge.alignment > 1e-8);
  const rank = (a: typeof edges[0], b: typeof edges[0]) => {
    if (normal && Math.abs(a.alignment - b.alignment) > 1e-8) return b.alignment - a.alignment;
    return Math.abs(a.d - b.d) < 0.5 ? b.len - a.len : a.d - b.d;
  };
  return [edges.filter(e => e.len >= 3), edges.filter(e => e.len >= 2.2 && e.len < 3),
    edges.filter(e => e.len < 2.2)].flatMap(group => group.sort(rank).map(e => e.e));
}

/** Source direction survives endpoint projection and reversal of the street path. */
function streetNormal(street: StreetAccess, point: P2): P2 {
  let nearest = 0, distance = Infinity;
  for (let i = 0; i + 1 < street.path.length; i++) {
    const candidate = pointSegmentDistance(point, street.path[i]!, street.path[i + 1]!);
    if (candidate < distance - 1e-9) { distance = candidate; nearest = i; }
  }
  const a = street.path[nearest]!, b = street.path[nearest + 1]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal: P2 = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const side = (point[0] - a[0]) * normal[0] + (point[1] - a[1]) * normal[1];
  if (Math.abs(side) <= 1e-9) throw new ExteriorError('E_SCHEMA',
    `parcel.streetAccess: accessPoint must be off street ${street.edgeId}'s selected segment line`);
  return side > 0 ? [-normal[0], -normal[1]] : normal;
}
