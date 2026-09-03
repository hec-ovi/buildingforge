import { edgeDir, edgeNormal, type P2 } from '../core/polygon.ts';
import type { ServiceNetwork, ServiceUnit } from '../facade-services/index.ts';
import type { Layout } from '../layout/model.ts';
import { add, dot, norm, scale, sub, type MeshBuilder, type PartSink, type V3 } from './primitives.ts';
import { tubeSegment } from './tube.ts';

interface Frame {
  dir: P2;
  n: P2;
}

/** Builds the published fitted facade networks, their endpoint fittings, and supported clothes. */
export function meshFacadeServices(mb: MeshBuilder, layout: Layout): void {
  const details = layout.facadeServices;
  if (details.units.length === 0 && details.networks.length === 0 && details.clotheslines.length === 0) return;
  const sink = mb.part('facade-services');
  const byFloor = new Map(layout.floors.map((floor) => [floor.index, floor]));
  const wallEntries = new Set(details.units.filter((unit) => unit.kind === 'wall-entry').map((unit) => unit.id));

  for (const unit of details.units) {
    const floor = byFloor.get(unit.face.floor);
    if (!floor || unit.face.edge >= floor.outline.length) continue;
    const fr = faceFrame(floor.outline, unit.face.edge);
    meshServiceUnit(sink, unit, fr);
  }

  for (const network of details.networks) {
    const floor = byFloor.get(network.face.floor);
    if (!floor || network.face.edge >= floor.outline.length) continue;
    const fr = faceFrame(floor.outline, network.face.edge);
    if (network.profile.shape === 'bundle') {
      meshCableBundle(sink, network, fr, wallEntries);
    } else {
      meshPipeOrDuct(sink, network, fr);
    }
  }

  for (const line of details.clotheslines) {
    const floor = byFloor.get(line.face.floor);
    if (!floor || line.face.edge >= floor.outline.length) continue;
    const fr = faceFrame(floor.outline, line.face.edge);
    for (const support of line.supports) {
      tubeSegment(sink, line.supportMaterialKey, support.wall, support.tip, 0.025);
      sink.box(line.supportMaterialKey, support.wall,
        [fr.dir[0] * 0.06, 0, fr.dir[1] * 0.06], [0, 0.06, 0],
        [fr.n[0] * 0.02, 0, fr.n[1] * 0.02]);
    }
    for (let index = 1; index < line.line.length; index++) {
      tubeSegment(sink, line.lineMaterialKey, line.line[index - 1]!, line.line[index]!, line.diameter / 2);
    }
    for (const item of line.items) meshClothItem(sink, item, [fr.n[0], 0, fr.n[1]]);
  }
}

function meshServiceUnit(sink: PartSink, unit: ServiceUnit, fr: Frame): void {
  const [width, height, depth] = unit.size;
  const tangent: V3 = [fr.dir[0], 0, fr.dir[1]];
  const outward: V3 = [fr.n[0], 0, fr.n[1]];
  sink.box(unit.materialKey, unit.center,
    scale(tangent, width / 2), [0, height / 2, 0], scale(outward, depth / 2));
  if (unit.kind !== 'wall-entry') return;

  const front = add(unit.center, scale(outward, depth / 2 + 0.012));
  const plateWidth = width * 0.78;
  const plateHeight = height * 0.78;
  sink.box(unit.materialKey, front,
    scale(tangent, plateWidth / 2), [0, plateHeight / 2, 0], scale(outward, 0.012));
  for (const u of [-1, 1]) {
    for (const y of [-1, 1]) {
      sink.box(unit.materialKey,
        add(add(front, scale(tangent, u * plateWidth * 0.38)), [0, y * plateHeight * 0.38, 0]),
        scale(tangent, 0.012), [0, 0.012, 0], scale(outward, 0.018));
    }
  }
}

function meshPipeOrDuct(sink: PartSink, network: ServiceNetwork, fr: Frame): void {
  if (network.profile.shape === 'bundle') return;
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const radius = network.profile.shape === 'round'
    ? network.profile.diameter / 2 : Math.max(network.profile.width, network.profile.depth) / 2;
  for (const segment of network.segments) {
    const a = nodes.get(segment.from)!;
    const b = nodes.get(segment.to)!;
    if (network.profile.shape === 'round') {
      tubeSegment(sink, network.materialKey, a.position, b.position, network.profile.diameter / 2);
    } else {
      const axis = sub(b.position, a.position);
      const vertical = Math.abs(axis[1]) >= Math.hypot(axis[0], axis[2]);
      const normalRun = Math.abs(dot(norm(axis), [fr.n[0], 0, fr.n[1]])) > 0.7;
      const widthDir: V3 = vertical || normalRun ? [fr.dir[0], 0, fr.dir[1]] : [0, 1, 0];
      sink.slantedBox(network.materialKey, a.position, b.position, widthDir,
        network.profile.width, network.profile.depth);
    }
  }
  for (const node of network.nodes.filter((item) => item.kind !== 'endpoint')) {
    sink.box(network.materialKey, node.position,
      [fr.dir[0] * radius, 0, fr.dir[1] * radius], [0, radius, 0],
      [fr.n[0] * radius, 0, fr.n[1] * radius]);
  }
  for (const support of network.supports) {
    sink.slantedBox(network.materialKey, support.wallPosition, support.position,
      [fr.dir[0], 0, fr.dir[1]], 0.04, 0.04);
  }
}

function meshCableBundle(
  sink: PartSink, network: ServiceNetwork, fr: Frame, wallEntries: Set<string>,
): void {
  if (network.profile.shape !== 'bundle') return;
  const profile = network.profile;
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const tangent: V3 = [fr.dir[0], 0, fr.dir[1]];
  const outward: V3 = [fr.n[0], 0, fr.n[1]];
  const columns = Math.ceil(profile.cableCount / profile.rows);
  const strands: { end?: V3 }[] = Array.from({ length: profile.cableCount }, () => ({}));

  for (const segment of network.segments) {
    const a = nodes.get(segment.from)!;
    const b = nodes.get(segment.to)!;
    const axis = norm(sub(b.position, a.position));
    const normalRun = Math.abs(dot(axis, outward)) > 0.7;
    const vertical = Math.abs(axis[1]) > 0.7;
    const side: V3 = normalRun || vertical ? tangent : [0, 1, 0];
    const layer: V3 = normalRun ? [0, 1, 0] : outward;
    const facadeParallel = !normalRun;

    for (let cable = 0; cable < profile.cableCount; cable++) {
      const column = Math.floor(cable / profile.rows);
      const row = cable % profile.rows;
      const offset = add(
        scale(side, (column - (columns - 1) / 2) * profile.spacing),
        scale(layer, (row - (profile.rows - 1) / 2) * profile.spacing),
      );
      const start = add(a.position, offset);
      const end = add(b.position, offset);
      const prior = strands[cable]!.end;
      if (prior) tubeSegment(sink, network.materialKey, prior, start, profile.cableDiameter / 2);
      if (facadeParallel && segment.length > 0.3) {
        const middle = add(scale(add(start, end), 0.5), scale(outward, profile.slack));
        tubeSegment(sink, network.materialKey, start, middle, profile.cableDiameter / 2);
        tubeSegment(sink, network.materialKey, middle, end, profile.cableDiameter / 2);
      } else {
        tubeSegment(sink, network.materialKey, start, end, profile.cableDiameter / 2);
      }
      strands[cable]!.end = end;
    }
  }

  for (const support of network.supports) {
    const segment = network.segments.find((candidate) => candidate.id === support.segmentId);
    const a = segment ? nodes.get(segment.from) : undefined;
    const b = segment ? nodes.get(segment.to) : undefined;
    const vertical = a && b
      ? Math.abs(b.position[1] - a.position[1]) > Math.hypot(
        b.position[0] - a.position[0], b.position[2] - a.position[2])
      : false;
    const holder = vertical ? tangent : [0, 1, 0] as V3;
    sink.slantedBox(network.materialKey, support.wallPosition, support.position,
      tangent, 0.035, 0.035);
    sink.box(network.materialKey, support.position,
      scale(holder, profile.width / 2 + 0.025),
      scale(vertical ? [0, 1, 0] : tangent, 0.012),
      scale(outward, profile.depth / 2 + 0.012));
  }

  for (const endpoint of network.nodes.filter((node) => node.targetId && wallEntries.has(node.targetId))) {
    const radius = Math.max(profile.width, profile.depth) / 2 + 0.02;
    for (let index = 0; index < 12; index++) {
      const a = index * Math.PI * 2 / 12;
      const b = (index + 1) * Math.PI * 2 / 12;
      const ringPoint = (angle: number): V3 => add(endpoint.position,
        add(scale(tangent, Math.cos(angle) * radius), [0, Math.sin(angle) * radius, 0]));
      tubeSegment(sink, network.materialKey, ringPoint(a), ringPoint(b), 0.01);
    }
  }
}

function meshClothItem(
  sink: PartSink, item: Layout['facadeServices']['clotheslines'][number]['items'][number], outward: V3,
): void {
  const [tl, tr, br, bl] = item.positions;
  const mix = (a: V3, b: V3, t: number): V3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const quad = (a: V3, b: V3, c: V3, d: V3) => {
    const width = Math.max(0.001, distance(a, b));
    const height = Math.max(0.001, (distance(a, d) + distance(b, c)) / 2);
    sink.quadFacing(item.materialKey, d, c, b, a, outward,
      [[0, height], [width, height], [width, 0], [0, 0]]);
  };
  if (item.variant === 'sheet') {
    quad(tl, tr, br, bl);
  } else if (item.variant === 'shirt') {
    quad(tl, tr, mix(tr, br, 0.88), mix(tl, bl, 0.88));
  } else {
    const leftMid = mix(tl, bl, 0.45);
    const rightMid = mix(tr, br, 0.45);
    quad(tl, tr, rightMid, leftMid);
    quad(leftMid, mix(leftMid, rightMid, 0.43), mix(bl, br, 0.43), bl);
    quad(mix(leftMid, rightMid, 0.57), rightMid, br, mix(bl, br, 0.57));
  }
}

function faceFrame(outline: P2[], edge: number): Frame {
  return { dir: edgeDir(outline, edge), n: edgeNormal(outline, edge) };
}

function distance(a: V3, b: V3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}
