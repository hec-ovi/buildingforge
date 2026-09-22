import { edgeDir, edgeNormal } from '../core/polygon.ts';
import type { FloorLayout, Layout } from '../layout/model.ts';
import type { Opening } from '../types.ts';
import { MeshBuilder, type Part, type PartSink, type V3 } from './primitives.ts';

const TREAD_THICKNESS = 0.045;
const RAIL_HEIGHT = 1.05;
const RAIL_SIZE = 0.035;
const POST_SIZE = 0.04;
const FACADE_GAP = 0.14;
const FLIGHT_GAP = 0.18;

interface Landing {
  floor: FloorLayout;
  door: Opening;
  elevation: number;
}

/**
 * A connected escape has two open-riser flights between consecutive floors.
 * Floor platforms occupy the left end, turning platforms the right end; the
 * empty space between them is never covered by a full-width floor plate.
 */
export function meshConnectedFireEscape(
  builder: MeshBuilder, layout: Layout, material: (kind: string) => string,
): void {
  const escape = layout.fireEscape;
  const connected = escape?.connected;
  if (!escape || !connected) return;
  const { depth, stairWidth, landingDepth } = connected;
  const run = escape.width - 2 * landingDepth;
  if (run <= 0 || depth < FACADE_GAP + 2 * stairWidth + FLIGHT_GAP + POST_SIZE) {
    throw new Error('Connected fire escape has no room for its two stair flights.');
  }

  // Openings, rather than a nominal storey pitch, are the source of every
  // walking elevation. Keep the door lookup scoped to its actual floor.
  const doorIds = new Set(connected.doorIds);
  const landings = new Map<number, Landing>();
  for (const floor of layout.floors) {
    if (floor.index < escape.fromFloor || floor.index > escape.toFloor) continue;
    const door = floor.openings.find(opening => doorIds.has(opening.id)
      && opening.edge === escape.edge && (opening.kind === 'door' || opening.kind === 'balconyDoor'));
    if (!door) throw new Error(`Connected fire escape has no access door on floor ${floor.index}.`);
    if (door.offset < escape.offset - 1e-6
      || door.offset + door.width > escape.offset + landingDepth + 1e-6) {
      throw new Error(`Connected fire escape door ${door.id} misses its floor landing.`);
    }
    landings.set(floor.index, { floor, door, elevation: floor.elevation + door.sill });
  }
  const first = landings.get(escape.fromFloor);
  if (!first) throw new Error('Connected fire escape has no first floor landing.');
  const origin = first.floor.outline[escape.edge]!;
  const direction = edgeDir(first.floor.outline, escape.edge);
  const normal = edgeNormal(first.floor.outline, escape.edge);
  const world = ([u, y, d]: V3): V3 => [
    origin[0] + direction[0] * (escape.offset + u) + normal[0] * d,
    y,
    origin[1] + direction[1] * (escape.offset + u) + normal[1] * d,
  ];
  const previousFloor = builder.floor;
  const steel = material('fire-escape');
  const authored: Part[] = [];
  const part = (name: string, floor: number): PartSink => {
    builder.floor = floor;
    // These members are already fitted to the real facade and thresholds.
    const sink = builder.part(`fire-escape:${name}`, { sloped: true });
    authored.push(builder.parts[builder.parts.length - 1]!);
    return sink.mapped(world);
  };
  const farStart = escape.width - landingDepth;
  const nearLane: [number, number] = [FACADE_GAP, FACADE_GAP + stairWidth];
  const outerLane: [number, number] = [nearLane[1] + FLIGHT_GAP, nearLane[1] + FLIGHT_GAP + stairWidth];

  try {
    for (const [index, landing] of landings) {
      const y = landing.elevation;
      platform(part(`landing:${index}`, index), steel, 0, landingDepth, depth, y);
      const rail = part(`landing-rails:${index}`, index);
      guard(rail, steel, [0.04, y, 0.04], [0.04, y, depth - 0.04]);
      // The lowest platform meets the street: leave its full outward edge
      // open so the stair route has an arrival beyond the interior door.
      if (index !== escape.fromFloor || y > 0.05) {
        guard(rail, steel, [0.04, y, depth - 0.04], [landingDepth, y, depth - 0.04]);
      }
      // The wall side remains entirely clear for the authored door and its
      // frame. Only the narrow gap between flight mouths receives a guard.
      guard(rail, steel, [landingDepth, y, nearLane[1] + 0.045],
        [landingDepth, y, outerLane[0] - 0.045]);
      guard(rail, steel, [landingDepth, y, outerLane[1] + 0.045], [landingDepth, y, depth - 0.04]);
      if (!connected.flights.some(flight => flight.fromFloor === index)) {
        guard(rail, steel, [landingDepth, y, nearLane[0] - 0.045], [landingDepth, y, nearLane[1] + 0.045]);
      }
      if (!connected.flights.some(flight => flight.toFloor === index)) {
        guard(rail, steel, [landingDepth, y, outerLane[0] - 0.045], [landingDepth, y, outerLane[1] + 0.045]);
      }
      if (index > escape.fromFloor) {
        brackets(part(`landing-braces:${index}`, index), steel, 0, landingDepth, depth, y);
      }
    }

    for (const descriptor of connected.flights) {
      const lower = landings.get(descriptor.fromFloor);
      const upper = landings.get(descriptor.toFloor);
      if (!lower || !upper) throw new Error('Connected fire escape flight is missing an endpoint door.');
      const bottom = lower.elevation, top = upper.elevation;
      const steps = descriptor.steps;
      const rise = (top - bottom) / (2 * steps);
      const going = run / (steps - 1);
      if (!Number.isInteger(steps) || steps < 2 || rise <= 0 || rise > 0.19 + 1e-6 || going < 0.25 - 1e-6) {
        throw new Error('Connected fire escape flight exceeds its rise or going limits.');
      }
      const mid = (bottom + top) / 2;
      const name = `${descriptor.fromFloor}-${descriptor.toFloor}`;
      const index = descriptor.fromFloor;
      platform(part(`turn:${name}`, index), steel, farStart, escape.width, depth, mid);
      const rail = part(`turn-rails:${name}`, index);
      guard(rail, steel, [farStart, mid, 0.04], [escape.width - 0.04, mid, 0.04]);
      guard(rail, steel, [escape.width - 0.04, mid, 0.04], [escape.width - 0.04, mid, depth - 0.04]);
      guard(rail, steel, [farStart, mid, depth - 0.04], [escape.width - 0.04, mid, depth - 0.04]);
      guard(rail, steel, [farStart, mid, nearLane[1] + 0.045], [farStart, mid, outerLane[0] - 0.045]);
      guard(rail, steel, [farStart, mid, outerLane[1] + 0.045], [farStart, mid, depth - 0.04]);
      brackets(part(`turn-braces:${name}`, index), steel, farStart, escape.width, depth, mid);

      const flight = (suffix: string, start: number, end: number, low: number, high: number, lane: [number, number]): void => {
        const treads = part(`flight:${name}:${suffix}:treads`, index);
        const structure = part(`flight:${name}:${suffix}:stringers`, index);
        const rails = part(`flight:${name}:${suffix}:rails`, index);
        for (let step = 1; step < steps; step++) {
          const t = (step - 0.5) / (steps - 1);
          const u = start + (end - start) * t;
          const y = low + (high - low) * step / steps;
          // Each top is horizontal and the steel occupies only its own tread;
          // the vertical gap to the next tread stays visibly and physically open.
          box(treads, steel, u - going / 2, u + going / 2,
            y - TREAD_THICKNESS, y, lane[0], lane[1]);
          for (const d of [lane[0] + 0.08, lane[1] - 0.08]) {
            const stringerY = low + (high - low) * t - 0.30;
            beam(structure, steel, [u, stringerY, d], [u, y - TREAD_THICKNESS, d], 0.055);
          }
        }
        for (const d of [lane[0] + 0.08, lane[1] - 0.08]) {
          beam(structure, steel, [start, low - 0.30, d], [end, high - 0.30, d], 0.12);
          for (const [u, y] of [[start, low], [end, high]]) {
            beam(structure, steel, [u!, y! - 0.30, d], [u!, y! - TREAD_THICKNESS, d], 0.07);
          }
        }
        for (const d of [lane[0] - 0.045, lane[1] + 0.045]) {
          stairGuard(rails, steel, start, end, low, high, d, steps);
        }
      };
      flight('outbound', landingDepth, farStart, bottom, mid, nearLane);
      flight('return', farStart, landingDepth, mid, top, outerLane);
    }
  } finally {
    // Positive facade depth can reflect the local XYZ frame. A reflected map
    // also reverses triangle winding; correct only this assembly's faces.
    if (direction[0] * normal[1] - direction[1] * normal[0] < 0) {
      for (const part of authored) for (const primitive of part.prims.values()) {
        for (let i = 0; i < primitive.indices.length; i += 3) {
          [primitive.indices[i + 1], primitive.indices[i + 2]] = [primitive.indices[i + 2]!, primitive.indices[i + 1]!];
        }
        for (let i = 0; i < primitive.normals.length; i++) primitive.normals[i] = -primitive.normals[i]!;
      }
    }
    builder.floor = previousFloor;
  }
}

function box(sink: PartSink, material: string, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number): void {
  sink.box(material, [(u0 + u1) / 2, (y0 + y1) / 2, (d0 + d1) / 2],
    [(u1 - u0) / 2, 0, 0], [0, (y1 - y0) / 2, 0], [0, 0, (d1 - d0) / 2]);
}

function beam(sink: PartSink, material: string, start: V3, end: V3, size: number): void {
  if (Math.hypot(...start.map((value, index) => value - end[index]!)) < 1e-6) return;
  const across: V3 = Math.abs(end[2] - start[2]) > Math.abs(end[0] - start[0]) ? [1, 0, 0] : [0, 0, 1];
  sink.slantedBox(material, start, end, across, size, size);
}

function platform(sink: PartSink, material: string, u0: number, u1: number, depth: number, y: number): void {
  // The deck top, including at the wall threshold, is exactly the floor level.
  box(sink, material, u0, u1, y - TREAD_THICKNESS, y, 0, depth);
  for (const u of [u0 + 0.07, u1 - 0.07]) {
    box(sink, material, u - 0.055, u + 0.055, y - 0.18, y - TREAD_THICKNESS, 0, depth);
  }
  for (const d of [0.055, depth - 0.055]) {
    box(sink, material, u0, u1, y - 0.18, y - TREAD_THICKNESS, d - 0.055, d + 0.055);
  }
}

function guard(sink: PartSink, material: string, start: V3, end: V3): void {
  const length = Math.hypot(end[0] - start[0], end[2] - start[2]);
  if (length <= 1e-6) return;
  for (const h of [0.53, RAIL_HEIGHT]) {
    beam(sink, material, [start[0], start[1] + h, start[2]], [end[0], end[1] + h, end[2]], RAIL_SIZE);
  }
  const spans = Math.max(1, Math.ceil(length / 0.85));
  for (let i = 0; i <= spans; i++) {
    const u = start[0] + (end[0] - start[0]) * i / spans;
    const d = start[2] + (end[2] - start[2]) * i / spans;
    beam(sink, material, [u, start[1] - TREAD_THICKNESS, d], [u, start[1] + RAIL_HEIGHT, d], POST_SIZE);
  }
}

function stairGuard(sink: PartSink, material: string, start: number, end: number, bottom: number, top: number, d: number, steps: number): void {
  // Rail ends join the landing at the mouth. Posts stand outside the full tread
  // width, so their diagonal handrails never narrow either walking lane.
  for (const h of [0.53, RAIL_HEIGHT]) {
    beam(sink, material, [start, bottom + h, d], [end, top + h, d], RAIL_SIZE);
  }
  const spans = Math.max(1, Math.ceil(Math.abs(end - start) / 0.85));
  for (let i = 0; i <= spans; i++) {
    const t = i / spans;
    const u = start + (end - start) * t;
    const deckY = i === 0 ? bottom : i === spans ? top
      : bottom + (top - bottom) * Math.ceil(t * (steps - 1)) / steps;
    const handY = bottom + (top - bottom) * t + RAIL_HEIGHT;
    beam(sink, material, [u, deckY - TREAD_THICKNESS, d], [u, handY, d], POST_SIZE);
  }
}

function brackets(sink: PartSink, material: string, u0: number, u1: number, depth: number, y: number): void {
  for (const u of [u0 + 0.13, u1 - 0.13]) {
    box(sink, material, u - 0.10, u + 0.10, y - 1.05, y - 0.14, -0.035, 0.035);
    beam(sink, material, [u, y - 0.98, 0.055], [u, y - 0.19, depth - 0.10], 0.09);
  }
}
