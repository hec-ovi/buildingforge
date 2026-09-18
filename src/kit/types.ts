// Published shapes of the piece path: what one piece is, and what a building
// assembled from pieces places where.

import type { Band, PieceKind } from './module.ts';
import type { TextureMode } from '../materials/apply.ts';
import type { Blueprint, BuildingRequest, Opening } from '../types.ts';

export type P3 = [number, number, number];

/** Where a consumer letters a building. Signage is never baked into a piece. */
export interface SignAnchor {
  id: string;
  kind: 'marquee' | 'logo' | 'screen';
  /** Centre of the sign field, piece-local metres. */
  position: P3;
  /** Metres across the facing plane, then up it. */
  size: [number, number];
  /** Outward unit normal of the field. */
  facing: P3;
}

export interface DoorRecord {
  id: string;
  /** Clear passage. */
  width: number;
  height: number;
  leaves: number;
  /** Centre of the threshold, piece-local metres. */
  position: P3;
  facing: P3;
}

/** Opening dimensions from the mesh author, with its bottom centre in piece space. */
export interface PieceOpening extends Omit<Opening, 'edge' | 'offset' | 'sill' | 'kind'> {
  kind: 'window' | 'door';
  position: P3;
  facing: P3;
}

export interface Geometry { vertices: number; triangles: number; bytes: number }

export interface PieceManifest {
  /** `<family>/<band>/<piece>`. */
  id: string;
  family: string;
  band: Band;
  piece: PieceKind;
  seed: string;
  /** Run length of each facade arm: one for a bay, two for a corner. */
  arms: number[];
  /** Floor-to-floor height of the band, including a crown's cap. */
  height: number;
  /** Inward depth of the structural backing plane. */
  depth: number;
  geometry: Geometry;
  /** Node names the piece exports. */
  parts: string[];
  materials: string[];
  signAnchors: SignAnchor[];
  doors: DoorRecord[];
  openings: PieceOpening[];
  /**
   * Mating sections, as a hash of merged edge intervals on each boundary plane,
   * including materials for run boundaries. Two runs join when the end
   * section of one equals the start section of the next; two bands stack when
   * the top section of one equals the bottom section of the next.
   */
  sections: { start: string; end: string; bottom: string; top: string };
}

export interface PieceRequest {
  family: string;
  piece: PieceKind;
  band: Band;
  seed?: string;
  theme?: string;
  /** Floor-to-floor height of the band; the family's own default when absent. */
  height?: number;
}

export interface PieceResult {
  glb: Uint8Array;
  manifest: PieceManifest;
  textures: { mode: TextureMode; reason?: string };
}

/** One piece put somewhere on a building: translation plus a turn about Y. */
export interface Placement {
  family: string;
  /** Manifest id of the piece this instance draws. */
  piece: string;
  /** Storey this instance belongs to, ground being 0. */
  floor: number;
  position: P3;
  /** Radians about +Y. */
  rotationY: number;
  /** Parcel footprint edge index; legacy lots start with the +X run. */
  face: number;
  /** Zero based bay along the face; null identifies its starting corner. */
  bayIndex: number | null;
}

/** JSON output described by schemas/placement.schema.json. */
export interface AssemblyPlan {
  blueprint: Blueprint;
  family: string;
  bands: { band: Band; floor: number; base: number; height: number }[];
  placements: Placement[];
  signAnchors: (SignAnchor & { placement: number })[];
  doors: (DoorRecord & { placement: number })[];
}

interface AssemblyOptions {
  family: string;
  buildingId: string;
  seed?: string;
  theme?: string;
  /** Parcel edge (0..3) carrying the entrance; otherwise selected from accessPoint. */
  entranceEdge?: number;
  groundHeight?: number;
  floorHeight?: number;
  /** Wire anchors in parcel face coordinates. */
  anchors?: { id: string; edge: number; u: number; y: number }[];
}

export type AssemblyRequest = AssemblyOptions & (
  | { parcel: BuildingRequest['parcel']; building: BuildingRequest['building']; lot?: never; floors?: never }
  | { lot: { width: number; depth: number }; floors: number; parcel?: never; building?: never }
);

export interface AssemblyResult {
  blueprint: Blueprint;
  glb: Uint8Array;
  pieces: PieceManifest[];
  placements: Placement[];
  signAnchors: AssemblyPlan['signAnchors'];
  doors: AssemblyPlan['doors'];
  /** What the assembled building costs: unique piece geometry plus per-building parts. */
  geometry: Geometry & { instances: number; uniquePieces: number };
  textures: { mode: TextureMode; reason?: string };
}
