import { ExteriorError } from '../core/errors.ts';
import { edgeDir, edgeLength } from '../core/polygon.ts';
import { validateRequest } from '../core/validate.ts';
import { entranceCandidates } from '../layout/entrance.ts';
import type { BuildingRequest, P2 } from '../types.ts';
import type { AssemblyRequest } from './types.ts';

export function rectangle(width: number, depth: number): P2[] {
  return [[0, 0], [width, 0], [width, depth], [0, depth]];
}

export function assemblyEdges(outline: P2[]) {
  return outline.map((origin, index) => {
    const dir = edgeDir(outline, index);
    return { origin, dir, length: edgeLength(outline, index), rotationY: Math.atan2(-dir[1], dir[0]) };
  });
}

/** Resolve both public request forms into the shared parcel frame. */
export function assemblyRequest(raw: AssemblyRequest): BuildingRequest {
  if (raw.parcel ? !raw.building || raw.lot !== undefined || raw.floors !== undefined
    : !raw.lot || raw.building !== undefined || raw.floors === undefined) {
    throw new ExteriorError('E_SCHEMA', 'supply parcel and building, or lot and floors');
  }
  const parcel = raw.parcel ?? {
    footprint: rectangle(raw.lot!.width, raw.lot!.depth), accessPoint: [raw.lot!.width / 2, 0],
    maxHeight: Number.MAX_VALUE,
  };
  const request = validateRequest({
    seed: raw.seed ?? raw.buildingId, buildingId: raw.buildingId, theme: raw.theme ?? 'cyberpunk',
    parcel, building: raw.building ?? { type: 'residential', tier: 'rich', floors: raw.floors },
  });
  if (request.building.basements) throw new ExteriorError('E_SCHEMA', 'kit pieces support above ground floors only');
  const outline = request.parcel.footprint;
  if (outline.length !== 4) throw new ExteriorError('E_SCHEMA', 'kit footprint must be a CCW rectangle');
  const edges = assemblyEdges(outline);
  for (const [i, edge] of edges.entries()) {
    const next = edges[(i + 1) % 4]!;
    if (Math.abs(edge.dir[0] * next.dir[0] + edge.dir[1] * next.dir[1]) > 1e-8
      || edge.dir[0] * next.dir[1] - edge.dir[1] * next.dir[0] < 1 - 1e-8) {
      throw new ExteriorError('E_SCHEMA', 'kit footprint must be a CCW rectangle');
    }
  }
  return request;
}

export function entranceFace(raw: AssemblyRequest, request: BuildingRequest): number {
  const edge = raw.entranceEdge ?? (raw.parcel
    ? entranceCandidates(request.parcel.footprint, request.parcel.accessPoint, request.parcel.streetAccess)[0]!
    : 0);
  if (!Number.isInteger(edge) || edge < 0 || edge > 3) {
    throw new ExteriorError('E_SCHEMA', 'entranceEdge must be an integer from 0 to 3');
  }
  return edge;
}
