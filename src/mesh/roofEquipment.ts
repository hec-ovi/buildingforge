import type { RoofArtifact } from '../types.ts';
import { add, scale, type PartSink, type V3 } from './primitives.ts';
import { tubeSegment } from './tube.ts';

interface Frame {
  center: [number, number];
  top: number;
  u: V3;
  v: V3;
}

const CIRCLE_SEGMENTS = 16;
const TUBE_SEGMENTS = 8;

/** Builds ordinary roof artifacts from their fitted box without exceeding it. */
export function meshRoofEquipment(
  sink: PartSink, artifact: RoofArtifact, top: number, solid: string, metal: string,
): void {
  const frame = artifactFrame(artifact, top);
  const [width, depth, height] = artifact.size;
  switch (artifact.kind) {
    case 'hvac':
      meshHvac(sink, frame, width, depth, height, solid, metal);
      return;
    case 'cooling-tower':
      meshCoolingTower(sink, frame, width, depth, height, solid, metal);
      return;
    case 'water-tank':
      meshWaterTank(sink, frame, width, depth, height, solid, metal);
      return;
    case 'solar':
      meshSolarPanel(sink, frame, width, depth, height, solid, metal);
      return;
    case 'dish':
      meshDish(sink, frame, width, depth, height, solid, metal);
      return;
    case 'vent':
      meshVent(sink, frame, width, depth, height, solid, metal);
      return;
    case 'stack':
      meshStack(sink, frame, width, depth, height, solid, metal);
      return;
    case 'penthouse-screen':
      meshScreen(sink, frame, width, depth, height, solid, metal);
      return;
    case 'helipad':
      meshHelipad(sink, frame, width, depth, height, solid, metal);
      return;
    case 'pool':
      meshPool(sink, frame, width, depth, height, solid);
      return;
    case 'bar':
      meshRoofBar(sink, frame, width, depth, height, solid, metal);
      return;
    default:
      box(sink, solid, frame, 0, height / 2, 0, width, height, depth);
  }
}

function meshHvac(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const foot = Math.min(width, depth) * 0.08;
  for (const side of [-1, 1]) {
    box(sink, metal, frame, side * width * 0.28, height * 0.06, 0,
      foot, height * 0.12, depth * 0.78);
  }
  box(sink, solid, frame, 0, height * 0.43, 0, width * 0.78, height * 0.62, depth * 0.72);
  box(sink, metal, frame, width * 0.43, height * 0.38, 0,
    width * 0.14, height * 0.3, depth * 0.34);
  topFan(sink, metal, frame, height * 0.78, Math.min(width, depth) * 0.25);
}

function meshCoolingTower(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  box(sink, metal, frame, 0, height * 0.06, 0, width * 0.92, height * 0.12, depth * 0.92);
  box(sink, solid, frame, 0, height * 0.39, 0, width * 0.82, height * 0.54, depth * 0.82);
  box(sink, solid, frame, 0, height * 0.72, 0, width * 0.7, height * 0.16, depth * 0.7);
  for (const y of [0.24, 0.38, 0.52]) {
    box(sink, metal, frame, 0, height * y, depth * 0.421,
      width * 0.7, height * 0.035, depth * 0.018);
    box(sink, metal, frame, 0, height * y, -depth * 0.421,
      width * 0.7, height * 0.035, depth * 0.018);
  }
  topFan(sink, metal, frame, height * 0.86, Math.min(width, depth) * 0.27);
}

function meshWaterTank(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const radius = Math.min(width, depth) * 0.38;
  const leg = Math.min(width, depth) * 0.07;
  for (const u of [-1, 1]) {
    for (const v of [-1, 1]) {
      box(sink, metal, frame, u * radius * 0.62, height * 0.1, v * radius * 0.62,
        leg, height * 0.2, leg);
    }
  }
  verticalCylinder(sink, solid, frame, 0, 0, height * 0.18, height * 0.88, radius, true);
  for (const y of [0.26, 0.54, 0.84]) horizontalRing(sink, metal, frame, 0, height * y, 0, radius, 0.025);
  tubeSegment(sink, metal,
    at(frame, radius * 0.78, height * 0.18, 0),
    at(frame, radius * 0.78, height * 0.04, 0), Math.max(0.025, radius * 0.035));
}

function meshSolarPanel(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const low = at(frame, 0, height * 0.25, -depth * 0.36);
  const high = at(frame, 0, height * 0.78, depth * 0.36);
  sink.slantedBox(solid, low, high, frame.u, width * 0.9, Math.min(0.035, height * 0.16));
  for (const side of [-1, 1]) {
    const u = side * width * 0.34;
    tubeSegment(sink, metal, at(frame, u, 0.02, -depth * 0.3),
      at(frame, u, height * 0.22, -depth * 0.3), 0.018);
    tubeSegment(sink, metal, at(frame, u, 0.02, depth * 0.3),
      at(frame, u, height * 0.66, depth * 0.3), 0.018);
  }
}

function meshDish(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const radius = Math.min(width * 0.4, depth * 0.4, height * 0.28);
  verticalCylinder(sink, metal, frame, 0, 0, height * 0.06, height * 0.58,
    Math.min(width, depth) * 0.035, true);
  const center = at(frame, 0, height * 0.58, 0);
  const normal = add(scale(frame.v, 0.74), [0, 0.67, 0]);
  const rise = add(scale(frame.v, -0.67), [0, 0.74, 0]);
  const bowl = add(center, scale(normal, -radius * 0.16));
  for (let index = 0; index < CIRCLE_SEGMENTS; index++) {
    const a = index * Math.PI * 2 / CIRCLE_SEGMENTS;
    const b = (index + 1) * Math.PI * 2 / CIRCLE_SEGMENTS;
    const edgeA = add(center, add(scale(frame.u, Math.cos(a) * radius), scale(rise, Math.sin(a) * radius)));
    const edgeB = add(center, add(scale(frame.u, Math.cos(b) * radius), scale(rise, Math.sin(b) * radius)));
    sink.triFacing(solid, bowl, edgeA, edgeB, normal, [[0.5, 0.5], [0, 0], [1, 0]]);
    sink.triFacing(solid, bowl, edgeB, edgeA, scale(normal, -1), [[0.5, 0.5], [1, 0], [0, 0]]);
    tubeSegment(sink, metal, edgeA, edgeB, 0.02);
  }
  tubeSegment(sink, metal, bowl, add(center, scale(normal, radius * 0.46)), 0.018);
}

function meshVent(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const radius = Math.min(width, depth) * 0.26;
  verticalCylinder(sink, solid, frame, 0, 0, height * 0.08, height * 0.74, radius, true);
  box(sink, metal, frame, 0, height * 0.8, 0, width * 0.72, height * 0.12, depth * 0.72);
  box(sink, metal, frame, 0, height * 0.91, 0, width * 0.52, height * 0.1, depth * 0.52);
}

function meshStack(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  const radius = Math.min(width, depth) * 0.28;
  box(sink, metal, frame, 0, height * 0.025, 0, width * 0.82, height * 0.05, depth * 0.82);
  verticalCylinder(sink, solid, frame, 0, 0, height * 0.05, height * 0.94, radius, true);
  for (const y of [0.2, 0.5, 0.8, 0.94]) horizontalRing(sink, metal, frame, 0, height * y, 0, radius, 0.025);
}

function meshScreen(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  box(sink, solid, frame, 0, height * 0.4, 0, width * 0.58, height * 0.72, depth * 0.58);
  const post = Math.min(width, depth) * 0.035;
  for (const u of [-1, 1]) {
    for (const v of [-1, 1]) {
      box(sink, metal, frame, u * width * 0.44, height / 2, v * depth * 0.44,
        post, height, post);
    }
  }
  for (const y of [0.18, 0.38, 0.58, 0.78]) {
    box(sink, metal, frame, 0, height * y, depth * 0.44,
      width * 0.9, height * 0.055, post);
    box(sink, metal, frame, 0, height * y, -depth * 0.44,
      width * 0.9, height * 0.055, post);
    box(sink, metal, frame, width * 0.44, height * y, 0,
      post, height * 0.055, depth * 0.9);
    box(sink, metal, frame, -width * 0.44, height * y, 0,
      post, height * 0.055, depth * 0.9);
  }
}

function meshHelipad(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  box(sink, solid, frame, 0, height * 0.42, 0, width, height * 0.84, depth);
  const y = height * 0.88;
  box(sink, metal, frame, -width * 0.14, y, 0, width * 0.07, height * 0.08, depth * 0.52);
  box(sink, metal, frame, width * 0.14, y, 0, width * 0.07, height * 0.08, depth * 0.52);
  box(sink, metal, frame, 0, y, 0, width * 0.32, height * 0.08, depth * 0.07);
}

function meshPool(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number, material: string,
): void {
  box(sink, material, frame, 0, height * 0.15, 0, width, height * 0.3, depth);
  const rim = Math.min(width, depth) * 0.08;
  const y = height * 0.65;
  box(sink, material, frame, 0, y, depth / 2 - rim / 2, width, height * 0.7, rim);
  box(sink, material, frame, 0, y, -depth / 2 + rim / 2, width, height * 0.7, rim);
  box(sink, material, frame, width / 2 - rim / 2, y, 0, rim, height * 0.7, depth - 2 * rim);
  box(sink, material, frame, -width / 2 + rim / 2, y, 0, rim, height * 0.7, depth - 2 * rim);
}

function meshRoofBar(
  sink: PartSink, frame: Frame, width: number, depth: number, height: number,
  solid: string, metal: string,
): void {
  box(sink, solid, frame, 0, height * 0.38, depth * 0.12,
    width * 0.76, height * 0.72, depth * 0.62);
  box(sink, metal, frame, 0, height * 0.82, 0, width * 0.94, height * 0.08, depth * 0.9);
  for (const u of [-1, 1]) {
    for (const v of [-1, 1]) {
      box(sink, metal, frame, u * width * 0.42, height * 0.42, v * depth * 0.4,
        width * 0.035, height * 0.8, depth * 0.035);
    }
  }
}

function topFan(
  sink: PartSink, material: string, frame: Frame, y: number, radius: number,
): void {
  const tubeRadius = Math.min(0.03, radius * 0.08);
  horizontalRing(sink, material, frame, 0, y, 0, radius, tubeRadius);
  const center = at(frame, 0, y, 0);
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    tubeSegment(sink, material, center,
      at(frame, Math.cos(angle) * radius, y, Math.sin(angle) * radius), tubeRadius * 0.45);
  }
  for (let index = 0; index < 5; index++) {
    const angle = index * Math.PI * 2 / 5;
    const radial: V3 = add(scale(frame.u, Math.cos(angle)), scale(frame.v, Math.sin(angle)));
    const tangent: V3 = add(scale(frame.u, -Math.sin(angle)), scale(frame.v, Math.cos(angle)));
    sink.slantedBox(material,
      add(center, scale(radial, radius * 0.12)),
      add(center, scale(radial, radius * 0.68)), tangent, radius * 0.18, tubeRadius);
  }
  box(sink, material, frame, 0, y, 0, radius * 0.16, tubeRadius * 2, radius * 0.16);
}

function verticalCylinder(
  sink: PartSink, material: string, frame: Frame, u: number, v: number,
  y0: number, y1: number, radius: number, capped: boolean,
): void {
  const bottom = at(frame, u, y0, v);
  const top = at(frame, u, y1, v);
  tubeSegment(sink, material, bottom, top, radius);
  if (!capped) return;
  for (let index = 0; index < TUBE_SEGMENTS; index++) {
    const a = index * Math.PI * 2 / TUBE_SEGMENTS;
    const b = (index + 1) * Math.PI * 2 / TUBE_SEGMENTS;
    const bottomA = at(frame, u + Math.cos(a) * radius, y0, v + Math.sin(a) * radius);
    const bottomB = at(frame, u + Math.cos(b) * radius, y0, v + Math.sin(b) * radius);
    const topA = at(frame, u + Math.cos(a) * radius, y1, v + Math.sin(a) * radius);
    const topB = at(frame, u + Math.cos(b) * radius, y1, v + Math.sin(b) * radius);
    sink.triFacing(material, top, topA, topB, [0, 1, 0], [[0.5, 0.5], [0, 0], [1, 0]]);
    sink.triFacing(material, bottom, bottomB, bottomA, [0, -1, 0], [[0.5, 0.5], [1, 0], [0, 0]]);
  }
}

function horizontalRing(
  sink: PartSink, material: string, frame: Frame,
  u: number, y: number, v: number, radius: number, tubeRadius: number,
): void {
  for (let index = 0; index < CIRCLE_SEGMENTS; index++) {
    const a = index * Math.PI * 2 / CIRCLE_SEGMENTS;
    const b = (index + 1) * Math.PI * 2 / CIRCLE_SEGMENTS;
    tubeSegment(sink, material,
      at(frame, u + Math.cos(a) * radius, y, v + Math.sin(a) * radius),
      at(frame, u + Math.cos(b) * radius, y, v + Math.sin(b) * radius), tubeRadius);
  }
}

function box(
  sink: PartSink, material: string, frame: Frame,
  u: number, y: number, v: number, width: number, height: number, depth: number,
): void {
  sink.box(material, at(frame, u, y, v),
    scale(frame.u, width / 2), [0, height / 2, 0], scale(frame.v, depth / 2));
}

function at(frame: Frame, u: number, y: number, v: number): V3 {
  return [
    frame.center[0] + frame.u[0] * u + frame.v[0] * v,
    frame.top + y,
    frame.center[1] + frame.u[2] * u + frame.v[2] * v,
  ];
}

function artifactFrame(artifact: RoofArtifact, top: number): Frame {
  const angle = artifact.rotationDeg * Math.PI / 180;
  return {
    center: artifact.center,
    top,
    u: [Math.cos(angle), 0, Math.sin(angle)],
    v: [-Math.sin(angle), 0, Math.cos(angle)],
  };
}
