import { edgeDir, edgeLength, edgeNormal, ringInsidePolygon } from '../core/polygon.ts';
import { DOORS } from '../rules/tables.ts';
import { sectionRoles } from '../sections/index.ts';
import type { Blueprint, BuildingRequest, Opening, P2 } from '../types.ts';
import type { FloorLayout } from './model.ts';

/** Fit the entire stair and its real access doors before Interior allocates any room. */
export function planConnectedFireEscape(request: BuildingRequest, floors: FloorLayout[]): Blueprint['fireEscape'] {
  if (request.options?.architecture !== 'residential-courtyard'
    || request.options.fireEscape === 'off' || request.options.fireEscape === false) return null;
  const above = floors.filter(floor => floor.index >= 0);
  const ground = above[0];
  if (!ground?.assembly || above.length < 2) return null;
  if (above.some(floor => JSON.stringify(floor.outline) !== JSON.stringify(ground.outline))) return null;
  const edge = 0, landingDepth = 1.5, stairWidth = 1.2, depth = 3.15;
  const flights = above.slice(1).map((floor, i) => ({ fromFloor: above[i]!.index, toFloor: floor.index,
    bottom: above[i]!.elevation, top: floor.elevation, steps: Math.ceil((floor.elevation - above[i]!.elevation) / 0.38) }));
  // Complete risers, at most 190 mm high; the top landing takes the final riser.
  const width = 2 * landingDepth + Math.max(...flights.map(flight => flight.steps - 1)) * 0.28;
  const length = edgeLength(ground.outline, edge);
  const origin = ground.outline[edge]!, direction = edgeDir(ground.outline, edge), normal = edgeNormal(ground.outline, edge);
  const point = (u: number, d: number): P2 => [origin[0] + direction[0] * u + normal[0] * d,
    origin[1] + direction[1] * u + normal[1] * d];
  for (const section of ground.assembly.sections.filter(section => section.edge === edge && section.technique === 'paired-glass')) {
    const center = section.offset + section.width / 2;
    const offset = center - landingDepth / 2, doorOffset = center - 0.55;
    if (offset < 0.1 || offset + width > length - 0.1) continue;
    if (!ringInsidePolygon(request.parcel.footprint,
      [point(offset - 0.05, 0), point(offset + width + 0.05, 0), point(offset + width + 0.05, depth + 0.05), point(offset - 0.05, depth + 0.05)])) continue;
    // Keep the first flight above the street clear of any main entry or fixed bridge.
    if (above.some(floor => floor.openings.some(opening => opening.edge === edge && opening.kind !== 'window'
      && opening.offset < offset + width + 0.1 && opening.offset + opening.width > offset - 0.1))) continue;
    if (above.some(floor => {
      const owner = floor.assembly?.sections.find(candidate => candidate.id === section.id);
      const field = owner && sectionRoles(owner, floor.height).find(field => field.role === 'middle');
      return !owner || !field || doorOffset < owner.offset + field.offset
        || doorOffset + 1.1 > owner.offset + field.offset + field.width;
    })) continue;
    const doorIds: string[] = [];
    for (const floor of above) {
      floor.openings = floor.openings.filter(opening => opening.sectionId !== section.id || opening.kind !== 'window');
      const rule = DOORS.sets['industrial-ribbed'];
      const door: Opening = { id: `fire-escape-door:${floor.index}`, sectionId: section.id, sectionSpan: 0,
        kind: 'door', doorRole: 'service', edge, offset: doorOffset, width: 1.1, height: 2.35, sill: 0,
        leaves: 1, material: `${request.theme}/door/${request.building.tier}`,
        door: { set: 'industrial-ribbed', frameWidth: rule.frameWidth, frameDepth: rule.frameDepth,
          recessDepth: rule.recessDepth, thresholdHeight: 0, motion: { kind: 'swing', maxTravel: 90, clearDepth: 1.1 } } };
      floor.openings.push(door);
      doorIds.push(door.id);
    }
    return { edge, fromFloor: ground.index, toFloor: above.at(-1)!.index, offset, width,
      connected: { depth, stairWidth, landingDepth, flights, doorIds } };
  }
  return null;
}
