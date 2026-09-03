import type {
  ArtifactInput, ClothesItem, Clothesline, FacadeServiceLimits, FacadeServicesInput,
  FacadeServicesOutput, FacadeServicesStats, FaceInput, FaceRef, NetworkNode, NetworkSegment,
  P2, P3, ReservationInput, RouteSupport, ServiceNetwork, ServiceUnit, WindowDamage,
} from './types.ts';

const EPS = 1e-8;
const CLEARANCE = 0.1;
const PIPE_DIAMETER = 0.06;
const PIPE_RADIUS = PIPE_DIAMETER / 2;
const DUCT_WIDTH = 0.22;
const DUCT_DEPTH = 0.16;
const UNIT_WIDTH = 0.44;
const UNIT_HEIGHT = 0.42;
const UNIT_DEPTH = 0.18;
const SUPPORT_SPACING = 1.2;

export const DEFAULT_FACADE_SERVICE_LIMITS: Readonly<FacadeServiceLimits> = Object.freeze({
  maxNetworks: 12,
  maxSegments: 96,
  maxSupports: 96,
  maxUnits: 24,
  maxClotheslines: 4,
  maxClothItems: 16,
  maxDamagedWindows: 3,
  maxTriangles: 6000,
  maxMaterialKeys: 3,
  maxDrawCalls: 3,
});

type Rect = [number, number, number, number];
type MutableOutput = Omit<FacadeServicesOutput, 'stats'>;

export function generateFacadeServices(input: FacadeServicesInput): FacadeServicesOutput {
  validateInput(input);
  const faces = new Map(input.faces.map((face) => [faceKey(face), face]));
  const reservations = new Map<string, ReservationInput[]>();
  for (const reservation of input.reservations) addReservation(reservations, reservation);
  for (const artifact of input.artifacts) {
    addReservation(reservations, {
      id: artifact.id,
      face: artifact.face,
      kind: 'artifact',
      rect: artifact.rect,
      depth: artifact.standoff + artifact.depth,
    });
  }

  const output: MutableOutput = {
    version: 1,
    units: [],
    networks: [],
    clotheslines: [],
    damagedWindows: [],
    limits: { ...input.limits },
  };

  if (input.modes.services === 'on') {
    buildPipeNetworks(input, faces, reservations, output);
    buildDuctNetworks(input, faces, reservations, output);
  }
  if (input.modes.clothes === 'on') buildClotheslines(input, faces, reservations, output);
  if (input.modes.windowDamage === 'sparse') buildDamage(input, output);

  pruneToBudgets(output);
  const stats = measure(output);
  const result: FacadeServicesOutput = { ...output, stats };
  checkOutput(input, faces, result);
  return result;
}

function buildPipeNetworks(
  input: FacadeServicesInput,
  faces: Map<string, FaceInput>,
  reservations: Map<string, ReservationInput[]>,
  output: MutableOutput,
): void {
  const ac = input.artifacts.filter((artifact) => artifact.kind === 'ac-unit');
  const groups = new Map<string, ArtifactInput[]>();
  for (const artifact of ac) {
    const key = faceKey(artifact.face);
    const list = groups.get(key) ?? [];
    list.push(artifact);
    groups.set(key, list);
  }

  const clusters: ArtifactInput[][] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.rect[0] - b.rect[0]);
    let cluster: ArtifactInput[] = [];
    for (const artifact of sorted) {
      const prior = cluster.at(-1);
      if (prior && (artifact.rect[0] - prior.rect[2] > 0.21
        || Math.abs(artifact.rect[1] - prior.rect[1]) > 0.02)) {
        clusters.push(cluster);
        cluster = [];
      }
      cluster.push(artifact);
    }
    if (cluster.length > 0) clusters.push(cluster);
  }
  clusters.sort((a, b) => stable(input.seed, `pipe:${a[0]!.id}`) - stable(input.seed, `pipe:${b[0]!.id}`));

  for (const cluster of clusters) {
    if (output.networks.length >= input.limits.maxNetworks
      || output.units.length >= input.limits.maxUnits) break;
    if (stable01(input.seed, `pipe-density:${cluster[0]!.id}`) > input.density) continue;
    const face = faces.get(faceKey(cluster[0]!.face));
    if (!face) continue;
    const made = makePipeNetwork(input, face, cluster, reservations.get(faceKey(face)) ?? [], output.networks.length);
    if (!made || countSegments(output.networks) + made.network.segments.length > input.limits.maxSegments
      || countSupports(output.networks) + made.network.supports.length > input.limits.maxSupports) continue;
    output.units.push(made.unit);
    output.networks.push(made.network);
    registerUnitAndNetwork(reservations, made.unit, made.network);
  }
}

function makePipeNetwork(
  input: FacadeServicesInput, face: FaceInput, cluster: ArtifactInput[],
  reservations: ReservationInput[], ordinal: number,
): { unit: ServiceUnit; network: ServiceNetwork } | null {
  const u0 = Math.min(...cluster.map((item) => item.rect[0]));
  const u1 = Math.max(...cluster.map((item) => item.rect[2]));
  const v1 = Math.max(...cluster.map((item) => item.rect[3]));
  const trunkV = mm(v1 + 0.18);
  if (trunkV + UNIT_HEIGHT / 2 + CLEARANCE > face.height) return null;
  const clusterIds = new Set(cluster.map((item) => item.id));
  const candidates = stable01(input.seed, `pipe-side:${faceKey(face)}:${ordinal}`) < 0.5
    ? (['left', 'right'] as const) : (['right', 'left'] as const);

  for (const side of candidates) {
    const centerU = side === 'left'
      ? mm(u0 - 0.18 - UNIT_WIDTH / 2)
      : mm(u1 + 0.18 + UNIT_WIDTH / 2);
    const rect: Rect = [centerU - UNIT_WIDTH / 2, trunkV - UNIT_HEIGHT / 2,
      centerU + UNIT_WIDTH / 2, trunkV + UNIT_HEIGHT / 2];
    if (!insideFace(face, rect, 0.15) || blocked(reservations, rect, CLEARANCE, clusterIds)) continue;
    const corridor: Rect = [Math.min(centerU, u0) - PIPE_RADIUS, trunkV - PIPE_RADIUS,
      Math.max(centerU, u1) + PIPE_RADIUS, trunkV + PIPE_RADIUS];
    if (blocked(reservations, corridor, CLEARANCE, clusterIds)) continue;

    const reliefDepth = crossed(reservations, rect, 0)
      .filter((reservation) => reservation.kind === 'relief')
      .reduce((depth, reservation) => Math.max(depth, reservation.depth), 0);
    const standoff = mm(reliefDepth > 0 ? reliefDepth + 0.04 : 0);
    const unitFront = standoff + UNIT_DEPTH;
    const equipmentFront = Math.max(...cluster.map((item) => item.standoff + item.depth));
    const routeDepth = mm(Math.max(unitFront, equipmentFront) + PIPE_RADIUS + 0.02);
    const reachU0 = Math.min(rect[0], u0);
    const reachU1 = Math.max(rect[2], u1);
    if (!insideParcel(input.parcel, face, reachU0, reachU1, routeDepth + PIPE_RADIUS)) continue;

    const unitId = `service-unit:pipe:${face.floor}:${face.edge}:${ordinal}`;
    const unit: ServiceUnit = {
      id: unitId,
      kind: 'junction-box',
      face: ref(face),
      rect: rect.map(mm) as Rect,
      size: [UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH],
      standoff,
      center: world(face, [centerU, trunkV, standoff + UNIT_DEPTH / 2]),
      materialKey: input.materials.metal,
    };

    const nodes: NetworkNode[] = [];
    const segments: NetworkSegment[] = [];
    const addNode = (kind: NetworkNode['kind'], local: P3, targetId?: string): NetworkNode => {
      const node: NetworkNode = {
        id: `n${nodes.length}`,
        kind,
        ...(targetId ? { targetId } : {}),
        local: local.map(mm) as P3,
        position: world(face, local),
      };
      nodes.push(node);
      return node;
    };
    const addSegment = (a: NetworkNode, b: NetworkNode) => segments.push(segment(segments.length, a, b, 0.08));
    const trunkNodes: NetworkNode[] = [];
    for (const artifact of [...cluster].sort((a, b) => a.rect[0] - b.rect[0])) {
      const u = mm((artifact.rect[0] + artifact.rect[2]) / 2);
      const sourceV = mm(artifact.rect[3] - 0.14);
      const surface = addNode('endpoint', [u, sourceV, artifact.standoff + artifact.depth], artifact.id);
      const proud = addNode('bend', [u, sourceV, routeDepth]);
      const trunk = addNode('junction', [u, trunkV, routeDepth]);
      addSegment(surface, proud);
      addSegment(proud, trunk);
      trunkNodes.push(trunk);
    }
    const targetSurface = addNode('endpoint', [centerU, trunkV, unitFront], unitId);
    const targetProud = addNode('junction', [centerU, trunkV, routeDepth]);
    addSegment(targetSurface, targetProud);
    const chain = [...trunkNodes, targetProud].sort((a, b) => a.local[0] - b.local[0]);
    for (let i = 1; i < chain.length; i++) addSegment(chain[i - 1]!, chain[i]!);
    const supports = supportsFor(face, nodes, segments, SUPPORT_SPACING);
    const network: ServiceNetwork = {
      id: `service-network:pipe:${face.floor}:${face.edge}:${ordinal}`,
      kind: 'pipe', face: ref(face), profile: { shape: 'round', diameter: PIPE_DIAMETER },
      materialKey: input.materials.metal, nodes, segments, supports,
      length: mm(segments.reduce((sum, item) => sum + item.length, 0)),
    };
    return { unit, network };
  }
  return null;
}

function buildDuctNetworks(
  input: FacadeServicesInput,
  faces: Map<string, FaceInput>,
  reservations: Map<string, ReservationInput[]>,
  output: MutableOutput,
): void {
  if (input.profile === 'residential') return;
  const ordered = [...faces.values()]
    .filter((face) => face.floor >= 1)
    .sort((a, b) => stable(input.seed, `duct:${faceKey(a)}`) - stable(input.seed, `duct:${faceKey(b)}`));
  for (const face of ordered) {
    if (output.networks.length >= input.limits.maxNetworks
      || output.units.length + 2 > input.limits.maxUnits) break;
    if (stable01(input.seed, `duct-density:${faceKey(face)}`) > input.density) continue;
    const made = makeDuctNetwork(input, face, reservations.get(faceKey(face)) ?? [], output.networks.length);
    if (!made || countSegments(output.networks) + made.network.segments.length > input.limits.maxSegments
      || countSupports(output.networks) + made.network.supports.length > input.limits.maxSupports) continue;
    output.units.push(...made.units);
    output.networks.push(made.network);
    for (const unit of made.units) registerUnitAndNetwork(reservations, unit, undefined);
    registerUnitAndNetwork(reservations, undefined, made.network);
    break;
  }
}

function makeDuctNetwork(
  input: FacadeServicesInput, face: FaceInput, reservations: ReservationInput[], ordinal: number,
): { units: [ServiceUnit, ServiceUnit]; network: ServiceNetwork } | null {
  const vCandidates = face.panelV.slice(1, -1).map((value) => mm(value - 0.28))
    .concat([mm(face.height * 0.35), mm(face.height * 0.65)]);
  for (const v of unique(vCandidates)) {
    if (v - UNIT_HEIGHT / 2 < 0.2 || v + UNIT_HEIGHT / 2 > face.height - 0.2) continue;
    const occupied = reservations
      .filter((item) => item.kind !== 'relief'
        && item.rect[1] < v + UNIT_HEIGHT / 2 + CLEARANCE
        && item.rect[3] > v - UNIT_HEIGHT / 2 - CLEARANCE)
      .map((item) => [item.rect[0] - CLEARANCE, item.rect[2] + CLEARANCE] as P2);
    const spans = complement(0.25, face.length - 0.25, occupied)
      .filter(([a, b]) => b - a >= 2 * UNIT_WIDTH + 1.2)
      .sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    for (const [start, end] of spans) {
      const leftU = mm(start + UNIT_WIDTH / 2);
      const rightU = mm(end - UNIT_WIDTH / 2);
      const leftRect: Rect = [leftU - UNIT_WIDTH / 2, v - UNIT_HEIGHT / 2, leftU + UNIT_WIDTH / 2, v + UNIT_HEIGHT / 2];
      const rightRect: Rect = [rightU - UNIT_WIDTH / 2, v - UNIT_HEIGHT / 2, rightU + UNIT_WIDTH / 2, v + UNIT_HEIGHT / 2];
      const relief = [...crossed(reservations, leftRect, 0), ...crossed(reservations, rightRect, 0)]
        .filter((item) => item.kind === 'relief')
        .reduce((depth, item) => Math.max(depth, item.depth), 0);
      const standoff = mm(relief > 0 ? relief + 0.04 : 0);
      const front = standoff + UNIT_DEPTH;
      const routeDepth = mm(front + DUCT_DEPTH / 2 + 0.02);
      if (!insideParcel(input.parcel, face, leftRect[0], rightRect[2], routeDepth + DUCT_DEPTH / 2)) continue;
      const ids = [0, 1].map((side) => `service-unit:duct:${face.floor}:${face.edge}:${ordinal}:${side}`) as [string, string];
      const units = [
        serviceUnit(input, face, ids[0], leftRect, standoff),
        serviceUnit(input, face, ids[1], rightRect, standoff),
      ] as [ServiceUnit, ServiceUnit];
      const nodes: NetworkNode[] = [
        networkNode(face, 'n0', 'endpoint', [leftRect[2], v, front], ids[0]),
        networkNode(face, 'n1', 'bend', [leftRect[2], v, routeDepth]),
        networkNode(face, 'n2', 'bend', [rightRect[0], v, routeDepth]),
        networkNode(face, 'n3', 'endpoint', [rightRect[0], v, front], ids[1]),
      ];
      const segments = [segment(0, nodes[0]!, nodes[1]!, 0.1), segment(1, nodes[1]!, nodes[2]!, 0.1),
        segment(2, nodes[2]!, nodes[3]!, 0.1)];
      const supports = supportsFor(face, nodes, segments, SUPPORT_SPACING);
      return {
        units,
        network: {
          id: `service-network:duct:${face.floor}:${face.edge}:${ordinal}`,
          kind: 'duct', face: ref(face), profile: { shape: 'rect', width: DUCT_WIDTH, depth: DUCT_DEPTH },
          materialKey: input.materials.metal, nodes, segments, supports,
          length: mm(segments.reduce((sum, item) => sum + item.length, 0)),
        },
      };
    }
  }
  return null;
}

function buildClotheslines(
  input: FacadeServicesInput,
  faces: Map<string, FaceInput>,
  reservations: Map<string, ReservationInput[]>,
  output: MutableOutput,
): void {
  const ordered = [...faces.values()].filter((face) => face.floor >= 1)
    .sort((a, b) => stable(input.seed, `clothes:${faceKey(a)}`) - stable(input.seed, `clothes:${faceKey(b)}`));
  for (const face of ordered) {
    if (output.clotheslines.length >= input.limits.maxClotheslines
      || countItems(output.clotheslines) >= input.limits.maxClothItems) break;
    if (stable01(input.seed, `clothes-density:${faceKey(face)}`) > input.density) continue;
    const line = makeClothesline(input, face, reservations.get(faceKey(face)) ?? [], output.clotheslines.length,
      input.limits.maxClothItems - countItems(output.clotheslines));
    if (!line) continue;
    output.clotheslines.push(line);
    addReservation(reservations, {
      id: line.id, face: line.face, kind: 'route', rect: line.clearanceRect,
      depth: Math.max(...line.lineLocal.map((point) => point[2])),
    });
  }
}

function makeClothesline(
  input: FacadeServicesInput, face: FaceInput, reservations: ReservationInput[], ordinal: number,
  itemBudget: number,
): Clothesline | null {
  if (itemBudget <= 0) return null;
  const width = mm(1.4 + stable01(input.seed, `clothes-width:${faceKey(face)}`) * 0.8);
  const height = mm(0.62 + stable01(input.seed, `clothes-height:${faceKey(face)}`) * 0.24);
  const depth = 0.34;
  const uCandidates = face.panelU.slice(1, -1).map((u) => mm(u - width / 2))
    .concat([mm((face.length - width) / 2)]);
  const vCandidates = face.panelV.slice(1).map((v) => mm(v - 0.18));
  for (const lineV of unique(vCandidates).sort((a, b) => b - a)) {
    for (const start of unique(uCandidates)) {
      const rect: Rect = [start, lineV - height, start + width, lineV + 0.08];
      if (!insideFace(face, rect, 0.18) || blocked(reservations, rect, CLEARANCE)) continue;
      if (!insideParcel(input.parcel, face, rect[0], rect[2], depth + 0.03)) continue;
      const id = `clothesline:${face.floor}:${face.edge}:${ordinal}`;
      const sag = mm(0.04 + stable01(input.seed, `${id}:sag`) * 0.05);
      const lineLocal: P3[] = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        lineLocal.push([mm(start + width * t), mm(lineV - 4 * sag * t * (1 - t)), depth]);
      }
      const count = Math.min(itemBudget, Math.max(2, Math.min(4, Math.floor(width / 0.48))));
      const items: ClothesItem[] = [];
      const slot = width / count;
      const variants: ClothesItem['variant'][] = ['sheet', 'shirt', 'trousers'];
      for (let i = 0; i < count; i++) {
        const itemWidth = mm(Math.min(slot * 0.72, 0.48));
        const center = start + slot * (i + 0.5);
        const left = mm(center - itemWidth / 2);
        const right = mm(center + itemWidth / 2);
        const itemHeight = mm(height * (0.62 + stable01(input.seed, `${id}:item-height:${i}`) * 0.28));
        const topLeft = lineY(start, width, lineV, sag, left);
        const topRight = lineY(start, width, lineV, sag, right);
        const local: [P3, P3, P3, P3] = [
          [left, topLeft, depth], [right, topRight, depth],
          [right, mm(topRight - itemHeight), depth], [left, mm(topLeft - itemHeight), depth],
        ];
        items.push({
          id: `${id}:item:${i}`,
          variant: variants[stable(input.seed, `${id}:variant:${i}`) % variants.length]!,
          local,
          positions: local.map((point) => world(face, point)) as [P3, P3, P3, P3],
          materialKey: input.materials.fabric,
        });
      }
      const supports = [start, start + width].map((u) => {
        const wallLocal: P3 = [mm(u), lineV, 0];
        const tipLocal: P3 = [mm(u), lineV, depth];
        return { wallLocal, tipLocal, wall: world(face, wallLocal), tip: world(face, tipLocal) };
      });
      return {
        id, face: ref(face), diameter: 0.018,
        supportMaterialKey: input.materials.metal, lineMaterialKey: input.materials.metal,
        lineLocal, line: lineLocal.map((point) => world(face, point)), supports, items,
        clearanceRect: rect.map(mm) as Rect,
      };
    }
  }
  return null;
}

function buildDamage(input: FacadeServicesInput, output: MutableOutput): void {
  const candidates = input.windows.filter((window) => window.face.floor >= 1
    && window.panes.cols > 0 && window.panes.rows > 0)
    .sort((a, b) => stable(input.seed, `damage:${a.openingId}`) - stable(input.seed, `damage:${b.openingId}`));
  if (candidates.length === 0) return;
  const sparseCount = Math.min(input.limits.maxDamagedWindows, Math.max(1, Math.floor(candidates.length / 40)));
  for (const window of candidates.slice(0, sparseCount)) {
    const col = stable(input.seed, `damage-col:${window.openingId}`) % window.panes.cols;
    const row = stable(input.seed, `damage-row:${window.openingId}`) % window.panes.rows;
    const missing = stable01(input.seed, `damage-kind:${window.openingId}`) < 0.35;
    output.damagedWindows.push({
      openingId: window.openingId,
      face: window.face,
      pane: { col, row },
      variant: missing ? 'missing-pane' : 'fractured-pane',
      collision: missing ? 'open' : 'solid',
      materialKey: input.materials.glass,
    });
  }
}

function supportsFor(
  face: FaceInput, nodes: NetworkNode[], segments: NetworkSegment[], spacing: number,
): RouteSupport[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const supports: RouteSupport[] = [];
  for (const item of segments) {
    const a = byId.get(item.from)!;
    const b = byId.get(item.to)!;
    // Normal connectors already end on equipment. Wall brackets support the facade-parallel runs.
    if (Math.abs(a.local[2] - b.local[2]) > Math.abs(a.local[0] - b.local[0])
      + Math.abs(a.local[1] - b.local[1])) continue;
    const count = Math.max(0, Math.floor(item.length / spacing));
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const local = lerp3(a.local, b.local, t);
      const wallLocal: P3 = [local[0], local[1], 0];
      supports.push({
        segmentId: item.id,
        local,
        position: world(face, local),
        wallPosition: world(face, wallLocal),
      });
    }
  }
  return supports;
}

function registerUnitAndNetwork(
  reservations: Map<string, ReservationInput[]>, unit?: ServiceUnit, network?: ServiceNetwork,
): void {
  if (unit) addReservation(reservations, {
    id: unit.id, face: unit.face, kind: 'artifact', rect: unit.rect, depth: unit.standoff + unit.size[2],
  });
  if (!network) return;
  const byId = new Map(network.nodes.map((node) => [node.id, node]));
  const radius = network.profile.shape === 'round' ? network.profile.diameter / 2 : network.profile.width / 2;
  for (const item of network.segments) {
    const a = byId.get(item.from)!, b = byId.get(item.to)!;
    addReservation(reservations, {
      id: `${network.id}:${item.id}`, face: network.face, kind: 'route',
      rect: [Math.min(a.local[0], b.local[0]) - radius, Math.min(a.local[1], b.local[1]) - radius,
        Math.max(a.local[0], b.local[0]) + radius, Math.max(a.local[1], b.local[1]) + radius],
      depth: Math.max(a.local[2], b.local[2]) + radius,
    });
  }
}

function serviceUnit(
  input: FacadeServicesInput, face: FaceInput, id: string, rect: Rect, standoff: number,
): ServiceUnit {
  const u = (rect[0] + rect[2]) / 2, v = (rect[1] + rect[3]) / 2;
  return {
    id, kind: 'junction-box', face: ref(face), rect: rect.map(mm) as Rect,
    size: [UNIT_WIDTH, UNIT_HEIGHT, UNIT_DEPTH], standoff,
    center: world(face, [u, v, standoff + UNIT_DEPTH / 2]), materialKey: input.materials.metal,
  };
}

function networkNode(
  face: FaceInput, id: string, kind: NetworkNode['kind'], local: P3, targetId?: string,
): NetworkNode {
  return { id, kind, ...(targetId ? { targetId } : {}), local, position: world(face, local) };
}

function segment(index: number, a: NetworkNode, b: NetworkNode, bendRadius: number): NetworkSegment {
  return {
    id: `s${index}`, from: a.id, to: b.id,
    length: mm(distance(a.local, b.local)), bendRadius,
  };
}

function pruneToBudgets(output: MutableOutput): void {
  for (;;) {
    const stats = measure(output);
    if (stats.triangles <= output.limits.maxTriangles
      && stats.materialKeys <= output.limits.maxMaterialKeys
      && stats.drawCalls <= output.limits.maxDrawCalls) return;
    if (output.clotheslines.length > 0) {
      output.clotheslines.pop();
      continue;
    }
    if (output.damagedWindows.length > 0) {
      output.damagedWindows.pop();
      continue;
    }
    const network = output.networks.pop();
    if (!network) return;
    const targets = new Set(network.nodes.filter((node) => node.kind === 'endpoint').map((node) => node.targetId));
    output.units = output.units.filter((unit) => !targets.has(unit.id));
  }
}

function measure(output: MutableOutput): FacadeServicesStats {
  const segments = countSegments(output.networks);
  const supports = countSupports(output.networks);
  const clothItems = countItems(output.clotheslines);
  const pipeSegments = output.networks.filter((network) => network.kind === 'pipe')
    .reduce((sum, network) => sum + network.segments.length, 0);
  const ductSegments = segments - pipeSegments;
  const lineSegments = output.clotheslines.reduce((sum, line) => sum + line.line.length - 1, 0);
  const triangles = output.units.length * 12 + pipeSegments * 16 + ductSegments * 12
    + supports * 12 + output.networks.reduce((sum, network) => sum + network.nodes.length * 12, 0)
    + output.clotheslines.length * 24 + lineSegments * 16 + clothItems * 4
    + output.damagedWindows.length * 8;
  const keys = new Set<string>();
  for (const unit of output.units) keys.add(unit.materialKey);
  for (const network of output.networks) keys.add(network.materialKey);
  for (const line of output.clotheslines) {
    keys.add(line.supportMaterialKey);
    keys.add(line.lineMaterialKey);
    for (const item of line.items) keys.add(item.materialKey);
  }
  for (const damage of output.damagedWindows) keys.add(damage.materialKey);
  return {
    networks: output.networks.length,
    segments,
    supports,
    units: output.units.length,
    clotheslines: output.clotheslines.length,
    clothItems,
    damagedWindows: output.damagedWindows.length,
    triangles,
    materialKeys: keys.size,
    drawCalls: (output.networks.length + output.units.length > 0 ? 1 : 0)
      + (output.clotheslines.length > 0 ? 1 : 0)
      + (output.damagedWindows.length > 0 ? 1 : 0),
  };
}

function checkOutput(
  input: FacadeServicesInput, faces: Map<string, FaceInput>, output: FacadeServicesOutput,
): void {
  const stats = output.stats;
  const limits = output.limits;
  const within = stats.networks <= limits.maxNetworks && stats.segments <= limits.maxSegments
    && stats.supports <= limits.maxSupports && stats.units <= limits.maxUnits
    && stats.clotheslines <= limits.maxClotheslines && stats.clothItems <= limits.maxClothItems
    && stats.damagedWindows <= limits.maxDamagedWindows && stats.triangles <= limits.maxTriangles
    && stats.materialKeys <= limits.maxMaterialKeys && stats.drawCalls <= limits.maxDrawCalls;
  if (!within) throw new Error('facade-services invariant: output exceeds a published budget');
  const materialKeys = new Set(Object.values(input.materials));
  const used = [
    ...output.units.map((item) => item.materialKey),
    ...output.networks.map((item) => item.materialKey),
    ...output.clotheslines.flatMap((item) => [item.supportMaterialKey, item.lineMaterialKey,
      ...item.items.map((cloth) => cloth.materialKey)]),
    ...output.damagedWindows.map((item) => item.materialKey),
  ];
  if (used.some((key) => !materialKeys.has(key))) {
    throw new Error('facade-services invariant: output invented a material key');
  }
  for (const unit of output.units) {
    const face = faces.get(faceKey(unit.face));
    if (!face || !insideFace(face, unit.rect, 0) || !matchesWorld(face,
      [(unit.rect[0] + unit.rect[2]) / 2, (unit.rect[1] + unit.rect[3]) / 2,
        unit.standoff + unit.size[2] / 2], unit.center)) {
      throw new Error(`facade-services invariant: invalid unit ${unit.id}`);
    }
  }
  for (const network of output.networks) {
    const face = faces.get(faceKey(network.face));
    if (!face) throw new Error(`facade-services invariant: missing face for ${network.id}`);
    const nodes = new Map(network.nodes.map((node) => [node.id, node]));
    const graph = new Map<string, string[]>();
    let length = 0;
    for (const node of network.nodes) {
      if (!insideLocal(face, node.local) || !matchesWorld(face, node.local, node.position)) {
        throw new Error(`facade-services invariant: invalid node ${network.id}/${node.id}`);
      }
      graph.set(node.id, []);
    }
    for (const item of network.segments) {
      const a = nodes.get(item.from), b = nodes.get(item.to);
      if (!a || !b || Math.abs(distance(a.local, b.local) - item.length) > 0.0011) {
        throw new Error(`facade-services invariant: disconnected segment ${network.id}/${item.id}`);
      }
      graph.get(item.from)!.push(item.to);
      graph.get(item.to)!.push(item.from);
      length += item.length;
    }
    const endpoints = network.nodes.filter((node) => node.kind === 'endpoint');
    if (endpoints.length < 2 || !connected(graph, endpoints.map((node) => node.id))
      || Math.abs(length - network.length) > 0.002) {
      throw new Error(`facade-services invariant: network ${network.id} does not join its endpoints`);
    }
    for (const support of network.supports) {
      if (!nodes.has(network.segments.find((item) => item.id === support.segmentId)?.from ?? '')
        || !matchesWorld(face, support.local, support.position)
        || !matchesWorld(face, [support.local[0], support.local[1], 0], support.wallPosition)) {
        throw new Error(`facade-services invariant: floating support on ${network.id}`);
      }
    }
  }
  const windows = new Map(input.windows.map((window) => [window.openingId, window]));
  if (new Set(output.damagedWindows.map((item) => item.openingId)).size !== output.damagedWindows.length) {
    throw new Error('facade-services invariant: a window has more than one damage state');
  }
  for (const damage of output.damagedWindows) {
    const window = windows.get(damage.openingId);
    if (!window || damage.pane.col >= window.panes.cols || damage.pane.row >= window.panes.rows
      || (damage.variant === 'missing-pane') !== (damage.collision === 'open')) {
      throw new Error(`facade-services invariant: invalid damage on ${damage.openingId}`);
    }
  }
  const maxSparse = input.windows.length === 0 ? 0
    : Math.min(input.limits.maxDamagedWindows, Math.max(1, Math.floor(input.windows.length / 40)));
  if (output.damagedWindows.length > maxSparse) {
    throw new Error('facade-services invariant: window damage is not sparse');
  }
  for (const line of output.clotheslines) {
    const face = faces.get(faceKey(line.face));
    if (!face || line.supports.length !== 2
      || !equal3(line.supports[0]!.tip, line.line[0]!)
      || !equal3(line.supports[1]!.tip, line.line.at(-1)!)) {
      throw new Error(`facade-services invariant: clothesline ${line.id} has no connected supports`);
    }
    for (const item of line.items) {
      if (!linePointContains(line.lineLocal, item.local[0]) || !linePointContains(line.lineLocal, item.local[1])) {
        throw new Error(`facade-services invariant: ${item.id} is not attached to its line`);
      }
    }
  }
}

function validateInput(input: FacadeServicesInput): void {
  if (!input || typeof input !== 'object' || !input.seed) throw new Error('facade-services input: seed is required');
  if (!Number.isFinite(input.density) || input.density < 0 || input.density > 1) {
    throw new Error('facade-services input: density must be between 0 and 1');
  }
  const material = /^[a-z0-9_-]+\/[a-z0-9_-]+\/[a-z0-9_-]+$/;
  if (Object.values(input.materials).some((key) => !material.test(key))) {
    throw new Error('facade-services input: materials must be database keys');
  }
  const ids = new Set<string>();
  for (const face of input.faces) {
    const key = faceKey(face);
    if (ids.has(key) || face.floor < 0 || face.edge < 0 || face.length <= 0 || face.height <= 0
      || Math.abs(length3(face.tangent) - 1) > 1e-6 || Math.abs(length3(face.normal) - 1) > 1e-6
      || Math.abs(dot3(face.tangent, face.normal)) > 1e-6
      || Math.abs(face.tangent[1]) > EPS || Math.abs(face.normal[1]) > EPS
      || face.panelU[0] !== 0 || Math.abs(face.panelU.at(-1)! - face.length) > 0.001
      || face.panelV[0] !== 0 || Math.abs(face.panelV.at(-1)! - face.height) > 0.001) {
      throw new Error(`facade-services input: invalid face ${key}`);
    }
    ids.add(key);
  }
  for (const limit of Object.values(input.limits)) {
    if (!Number.isInteger(limit) || limit < 0) throw new Error('facade-services input: limits must be non-negative integers');
  }
}

function linePointContains(line: P3[], point: P3): boolean {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!;
    const span = distance(a, b);
    if (Math.abs(distance(a, point) + distance(point, b) - span) < 0.002) return true;
  }
  return false;
}

function connected(graph: Map<string, string[]>, targets: string[]): boolean {
  const seen = new Set<string>();
  const pending = [targets[0]!];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(graph.get(id) ?? []));
  }
  return targets.every((id) => seen.has(id));
}

function addReservation(map: Map<string, ReservationInput[]>, reservation: ReservationInput): void {
  const key = faceKey(reservation.face);
  const list = map.get(key) ?? [];
  list.push(reservation);
  map.set(key, list);
}

function crossed(reservations: ReservationInput[], rect: Rect, margin: number): ReservationInput[] {
  return reservations.filter((item) => overlap(item.rect, rect, margin));
}

function blocked(
  reservations: ReservationInput[], rect: Rect, margin: number, allowed = new Set<string>(),
): boolean {
  return crossed(reservations, rect, margin)
    .some((item) => item.kind !== 'relief' && !allowed.has(item.id));
}

function overlap(a: Rect, b: Rect, margin: number): boolean {
  return a[0] < b[2] + margin && a[2] > b[0] - margin
    && a[1] < b[3] + margin && a[3] > b[1] - margin;
}

function insideFace(face: FaceInput, rect: Rect, margin: number): boolean {
  return rect[0] >= margin - EPS && rect[1] >= margin - EPS
    && rect[2] <= face.length - margin + EPS && rect[3] <= face.height - margin + EPS;
}

function insideLocal(face: FaceInput, point: P3): boolean {
  return point[0] >= -EPS && point[0] <= face.length + EPS
    && point[1] >= -EPS && point[1] <= face.height + EPS && point[2] >= -EPS;
}

function insideParcel(parcel: P2[], face: FaceInput, u0: number, u1: number, depth: number): boolean {
  const a = world(face, [u0, 0, depth]);
  const b = world(face, [u1, 0, depth]);
  return segmentInsidePolygon(parcel, [a[0], a[2]], [b[0], b[2]]);
}

function world(face: FaceInput, local: P3): P3 {
  return [
    mm(face.origin[0] + face.tangent[0] * local[0] + face.normal[0] * local[2]),
    mm(face.origin[1] + local[1]),
    mm(face.origin[2] + face.tangent[2] * local[0] + face.normal[2] * local[2]),
  ];
}

function matchesWorld(face: FaceInput, local: P3, position: P3): boolean {
  return equal3(world(face, local), position);
}

function equal3(a: P3, b: P3): boolean {
  return distance(a, b) < 0.0011;
}

function faceKey(face: FaceRef): string {
  return `${face.floor}:${face.edge}`;
}

function ref(face: FaceRef): FaceRef {
  return { floor: face.floor, edge: face.edge };
}

function countSegments(networks: ServiceNetwork[]): number {
  return networks.reduce((sum, network) => sum + network.segments.length, 0);
}

function countSupports(networks: ServiceNetwork[]): number {
  return networks.reduce((sum, network) => sum + network.supports.length, 0);
}

function countItems(lines: Clothesline[]): number {
  return lines.reduce((sum, line) => sum + line.items.length, 0);
}

function complement(lo: number, hi: number, intervals: P2[]): P2[] {
  const sorted = intervals.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)] as P2)
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const out: P2[] = [];
  let cursor = lo;
  for (const [a, b] of sorted) {
    if (a > cursor) out.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < hi) out.push([cursor, hi]);
  return out;
}

function unique(values: number[]): number[] {
  return [...new Set(values.map(mm))];
}

function lineY(start: number, width: number, lineV: number, sag: number, u: number): number {
  const t = Math.max(0, Math.min(1, (u - start) / width));
  return mm(lineV - 4 * sag * t * (1 - t));
}

function lerp3(a: P3, b: P3, t: number): P3 {
  return [mm(a[0] + (b[0] - a[0]) * t), mm(a[1] + (b[1] - a[1]) * t),
    mm(a[2] + (b[2] - a[2]) * t)];
}

function distance(a: P3, b: P3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function length3(a: P3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function dot3(a: P3, b: P3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function stable(seed: string, label: string): number {
  let hash = 2166136261;
  const text = `${seed}\u0000${label}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0);
}

function stable01(seed: string, label: string): number {
  return stable(seed, label) / 0x1_0000_0000;
}

function mm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pointInPolygon(poly: P2[], point: P2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: P2, a: P2, b: P2): boolean {
  const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > 1e-7) return false;
  const dot = (point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1]);
  const length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return dot >= -EPS && dot <= length + EPS;
}

function inOrOn(poly: P2[], point: P2): boolean {
  return poly.some((a, index) => pointOnSegment(point, a, poly[(index + 1) % poly.length]!))
    || pointInPolygon(poly, point);
}

function segmentInsidePolygon(poly: P2[], a: P2, b: P2): boolean {
  if (!inOrOn(poly, a) || !inOrOn(poly, b)) return false;
  // The midpoint check is sufficient for facade-parallel spans inside the simple
  // parcel offsets supplied here. Quarter points catch concave notches.
  return [0.25, 0.5, 0.75].every((t) => inOrOn(poly,
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
}
