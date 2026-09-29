import { RoomEnvelopes } from '../blueprint/roomEnvelope.ts';
import { edgeDir, edgeNormal, type P2 } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import { capDifference } from './capDifference.ts';
import { capDown, capFrame, capUp } from './caps.ts';
import { PartSink, type MeshBuilder } from './primitives.ts';
import { slabOutline } from './slabOutline.ts';
import { measureWallDepth } from './wallDepth.ts';

/** A stone threshold's finish sits at the room floor level. Its structural backing
 * is recessed one finish thickness below it, so furnished and shell-only versions
 * both have support without drawing two different materials in the same plane. */
const FINISH_DEPTH = .02;

export function recessFloorThresholds(builder: MeshBuilder, layout: Layout): void {
  const wallDepth = measureWallDepth(layout, builder);
  const envelopes = new RoomEnvelopes(layout.request);
  const caps = capFrame(layout.floors.find(floor => floor.index === 0)!.outline);
  const local = ([x, z]: P2): P2 => [x * caps.axis[0] + z * caps.axis[1] - caps.origin[0], z * caps.axis[0] - x * caps.axis[1] - caps.origin[1]];
  const world = ([u, v]: P2): P2 => [(u + caps.origin[0]) * caps.axis[0] - (v + caps.origin[1]) * caps.axis[1],
    (u + caps.origin[0]) * caps.axis[1] + (v + caps.origin[1]) * caps.axis[0]];
  for (const floor of layout.floors) {
    // Infrastructure apertures (bridge/tunnel cuts) carry their own continuous
    // shell walking plate at the published connection elevation.
    const doors = floor.openings.filter(opening => ['door', 'balconyDoor', 'openFront'].includes(opening.kind) && opening.sill === 0);
    if (!doors.length) continue;
    const part = builder.parts.find(part => part.name === `floor:${floor.index}/slab`);
    if (!part || part.prims.size !== 1) continue;
    const material = [...part.prims.keys()][0]!;
    const envelope = envelopes.forFloor(floor.topOutline ? { ...floor, outline: floor.topOutline } : floor, wallDepth);
    const patches: P2[][] = [];
    for (const opening of doors) {
      const field = opening.door?.clearance ?? opening;
      const width = opening.portal?.clearWidth ?? (opening.door?.motion.kind === 'pocket' ? field.width : field.width - .02);
      const offset = field.offset + (field.width - width) / 2;
      const origin = floor.outline[opening.edge]!, dir = edgeDir(floor.outline, opening.edge), normal = edgeNormal(floor.outline, opening.edge);
      const start = Math.max(opening.door?.motion.kind === 'pocket' ? opening.door.clearance?.backDepth ?? .02 : .02,
        opening.door?.recessDepth ?? opening.portal?.recessDepth ?? 0);
      const end = Math.min(...envelope.corners.map(point => -(point[0] - origin[0]) * normal[0] - (point[1] - origin[1]) * normal[1]));
      if (width <= 0 || end <= start + 1e-6) continue;
      const at = (u: number, depth: number): P2 => [origin[0] + dir[0] * u - normal[0] * depth, origin[1] + dir[1] * u - normal[1] * depth];
      patches.push([at(offset, start), at(offset + width, start), at(offset + width, end), at(offset, end)].map(local));
    }
    if (!patches.length) continue;
    let surface = [slabOutline(floor, layout.floors.find(other => other.index === floor.index - 1)).map(local)];
    for (const patch of patches) surface = surface.flatMap(ring => capDifference(ring, patch));
    part.prims.clear();
    const sink = new PartSink(part);
    for (const ring of surface) {
      capUp(sink, material, caps, ring.map(world), floor.elevation);
      capDown(sink, material, caps, ring.map(world), floor.elevation);
    }
    for (const patch of patches) {
      const ring = patch.map(world);
      capUp(sink, material, caps, ring, floor.elevation - FINISH_DEPTH);
      capDown(sink, material, caps, ring, floor.elevation - FINISH_DEPTH);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
        const inward: [number, number, number] = [-(b[1] - a[1]), 0, b[0] - a[0]];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        sink.quadFacing(material, [a[0], floor.elevation - FINISH_DEPTH, a[1]], [b[0], floor.elevation - FINISH_DEPTH, b[1]],
          [b[0], floor.elevation, b[1]], [a[0], floor.elevation, a[1]], inward,
          [[0, 0], [length, 0], [length, FINISH_DEPTH], [0, FINISH_DEPTH]]);
      }
    }
  }
}
