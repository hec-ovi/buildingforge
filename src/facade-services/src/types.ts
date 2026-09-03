export type P2 = [number, number];
export type P3 = [number, number, number];
export type FaceRef = { floor: number; edge: number };

export type ReservationKind = 'opening' | 'access' | 'fixture' | 'relief' | 'artifact' | 'route';

export interface FaceInput extends FaceRef {
  origin: P3;
  tangent: P3;
  normal: P3;
  length: number;
  height: number;
  panelU: number[];
  panelV: number[];
}

export interface ReservationInput {
  id: string;
  face: FaceRef;
  kind: ReservationKind;
  rect: [number, number, number, number];
  depth: number;
}

export interface ArtifactInput {
  id: string;
  face: FaceRef;
  kind: 'ac-unit' | 'utility-box';
  rect: [number, number, number, number];
  depth: number;
  standoff: number;
}

export interface WindowInput {
  openingId: string;
  face: FaceRef;
  rect: [number, number, number, number];
  panes: { cols: number; rows: number };
}

export interface FacadeServiceLimits {
  maxNetworks: number;
  maxSegments: number;
  maxSupports: number;
  maxUnits: number;
  maxClotheslines: number;
  maxClothItems: number;
  maxDamagedWindows: number;
  maxTriangles: number;
  maxMaterialKeys: number;
  maxDrawCalls: number;
}

export interface FacadeServicesInput {
  seed: string;
  profile: 'residential' | 'industrial' | 'generic';
  density: number;
  modes: {
    services: 'off' | 'on';
    clothes: 'off' | 'on';
    windowDamage: 'off' | 'sparse';
  };
  parcel: P2[];
  materials: { metal: string; fabric: string; glass: string };
  faces: FaceInput[];
  reservations: ReservationInput[];
  artifacts: ArtifactInput[];
  windows: WindowInput[];
  limits: FacadeServiceLimits;
}

export interface ServiceUnit {
  id: string;
  kind: 'junction-box' | 'wall-entry';
  face: FaceRef;
  rect: [number, number, number, number];
  size: P3;
  standoff: number;
  center: P3;
  materialKey: string;
}

export interface NetworkNode {
  id: string;
  kind: 'endpoint' | 'bend' | 'junction';
  targetId?: string;
  local: P3;
  position: P3;
}

export interface NetworkSegment {
  id: string;
  from: string;
  to: string;
  length: number;
  bendRadius: number;
}

export interface RouteSupport {
  segmentId: string;
  local: P3;
  position: P3;
  wallPosition: P3;
}

export interface ServiceNetwork {
  id: string;
  kind: 'pipe' | 'duct' | 'cable-bundle';
  face: FaceRef;
  profile:
    | { shape: 'round'; diameter: number }
    | { shape: 'rect'; width: number; depth: number }
    | {
      shape: 'bundle';
      width: number;
      depth: number;
      cableCount: 12 | 15;
      cableDiameter: number;
      spacing: number;
      rows: 3;
      slack: number;
    };
  materialKey: string;
  nodes: NetworkNode[];
  segments: NetworkSegment[];
  supports: RouteSupport[];
  length: number;
}

export interface ClothesItem {
  id: string;
  variant: 'sheet' | 'shirt' | 'trousers';
  local: [P3, P3, P3, P3];
  positions: [P3, P3, P3, P3];
  materialKey: string;
}

export interface Clothesline {
  id: string;
  face: FaceRef;
  diameter: number;
  supportMaterialKey: string;
  lineMaterialKey: string;
  lineLocal: P3[];
  line: P3[];
  supports: { wallLocal: P3; tipLocal: P3; wall: P3; tip: P3 }[];
  items: ClothesItem[];
  clearanceRect: [number, number, number, number];
}

export interface WindowDamage {
  openingId: string;
  face: FaceRef;
  pane: { col: number; row: number };
  variant: 'fractured-pane' | 'missing-pane';
  collision: 'solid' | 'open';
  materialKey: string;
}

export interface FacadeServicesStats {
  networks: number;
  segments: number;
  supports: number;
  units: number;
  clotheslines: number;
  clothItems: number;
  damagedWindows: number;
  triangles: number;
  materialKeys: number;
  drawCalls: number;
}

export interface FacadeServicesOutput {
  version: 1;
  units: ServiceUnit[];
  networks: ServiceNetwork[];
  clotheslines: Clothesline[];
  damagedWindows: WindowDamage[];
  stats: FacadeServicesStats;
  limits: FacadeServiceLimits;
}
