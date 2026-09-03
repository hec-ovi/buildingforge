// TypeScript mirrors of schemas/building-request.schema.json and schemas/blueprint.schema.json.

import type { AtlasType, Tier } from './rules/families.ts';
import type { TextureMode, TextureOptions } from './materials/apply.ts';

export type P2 = [number, number];
export type P3 = [number, number, number];

export type ApertureKind = 'bridge' | 'ac-tube' | 'wire-anchor' | 'tunnel';

export interface Aperture {
  id: string;
  buildingId: string;
  floor: number;
  face: number;
  kind: ApertureKind;
  u: number;
  base: number;
  width: number;
  height: number;
  shape: 'rect' | 'circle';
  cut: { polygon: P3[]; axisDir: P3 };
  linkId: string;
}

export type Signage =
  | { mode: 'marquee'; text: string }
  | { mode: 'logo'; ratio: '1:1' | '3:2' | '16:9' }
  | null;

export interface BuildingRequest {
  seed: string;
  buildingId: string;
  parcel: { footprint: P2[]; accessPoint: P2; maxHeight: number };
  building: {
    type: AtlasType;
    tier: Tier;
    floors: number;
    basements?: number;
    floorKinds?: string[];
  };
  theme: string;
  apertures?: Aperture[];
  options?: {
    shape?: 'auto' | 'box' | 'octagon' | 'cylinder' | 'pyramid' | 'setback';
    glb?: 'named' | 'merged';
    balconies?: 'auto' | 'on' | 'off';
    balconyStyle?: 'auto' | 'bay' | 'full';
    openFront?: 'auto' | 'on' | 'off';
    fireEscape?: boolean | 'auto' | 'on' | 'off';
    windows?: 'auto' | 'none';
    signage?: Signage;
    adScreens?: 'auto' | 'on' | 'off';
    roofArtifacts?: 'auto' | 'off';
    curtains?: { profile?: 'day' | 'night'; sunAzimuthDeg?: number };
  };
}

export type OpeningKind = 'door' | 'window' | 'balconyDoor' | 'openFront' | 'aperture';
export type CurtainState = 'open' | 'half' | 'closed80';
export type DoorSet = 'plain' | 'layered' | 'glazed-grid' | 'industrial-ribbed' | 'illuminated';

export interface DoorAssembly {
  set: DoorSet;
  frameWidth: number;
  frameDepth: number;
  recessDepth: number;
  thresholdHeight: number;
  motion: {
    kind: 'swing' | 'roller';
    maxTravel: number;
    clearDepth: number;
  };
}

export interface Opening {
  id: string;
  kind: OpeningKind;
  edge: number;
  offset: number;
  width: number;
  height: number;
  sill: number;
  apertureKind?: Exclude<ApertureKind, 'wire-anchor'>;
  state?: CurtainState;
  /** mullion grid of a glazed opening: cols x rows panes, each within the tier's pane limit */
  panes?: { cols: number; rows: number };
  /** curtain-wall bay: opaque spandrel band at the bottom of the opening; vision glass starts above it */
  spandrel?: number;
  /** curtain-wall bay: opaque band at the top of the opening, covering the slab of the floor above */
  head?: number;
  /** door and balconyDoor: swinging leaves, one node subtree each in the GLB */
  leaves?: number;
  /** door and balconyDoor: exact fixed-frame and movement envelope selected for this building */
  door?: DoorAssembly;
  /** door only: how the interior and navigation layers connect the opening */
  doorRole?: 'main' | 'secondary' | 'service';
  /** permanently open business frontage: fixed surround and traversable clearance */
  portal?: {
    frameWidth: number;
    frameDepth: number;
    recessDepth: number;
    clearWidth: number;
    clearHeight: number;
    clearDepth: number;
  };
  /** permanently open frontage: navigation connection supplied instead of a door */
  accessRole?: 'main';
  /** door: glazed transom light carried above the head, part of this opening */
  transom?: number;
  balcony?: { depth: number; width: number; bandId?: string };
  material?: string;
}

export interface Floor {
  index: number;
  kind: string;
  elevation: number;
  height: number;
  outline: P2[];
  openings: Opening[];
}

export interface RoofArtifact { kind: string; center: P2; size: P3; rotationDeg: number }

export interface BalconyBand {
  id: string;
  floor: number;
  edge: number;
  offset: number;
  width: number;
  depth: number;
  slabThickness: number;
  railHeight: number;
  style: 'bay' | 'full' | 'juliet';
  doors: string[];
}

/**
 * Roof access. `center` and `axis` (a unit vector along `width`) place an
 * axis-free rectangle on the roof plane: the cutout the interior stair head
 * lands in. The housing standing over it carries one door onto the roof.
 */
export interface Bulkhead {
  center: P2;
  axis: P2;
  width: number;
  depth: number;
  housingHeight: number;
  doorNormal: P2;
  doorWidth: number;
  doorHeight: number;
}

/** Surface-mounted equipment on a facade: positioned like an opening, sized [w, h, depth]. */
export interface FacadeArtifact {
  /** `utility-box` or `ac-unit` */
  kind: string;
  floor: number;
  edge: number;
  offset: number;
  sill: number;
  size: P3;
  /** where the back of the housing sits, when it has to clear relief under it */
  standoff?: number;
}

export interface Blueprint {
  buildingId: string;
  seed: string;
  bounds: { footprint: P2[]; height: number };
  floors: Floor[];
  balconyBands: BalconyBand[];
  anchors: { id: string; position: P3; normal: P2 }[];
  signage: {
    mode: 'marquee' | 'logo';
    /** ground outline edge the sign is mounted on */
    edge: number;
    /** marquee only: horizontal band over the entrance, or a blade sign edge-on to the facade */
    orientation?: 'horizontal' | 'vertical';
    text?: string;
    ratio?: '1:1' | '3:2' | '16:9';
    /** marquee only: one letter cell, N letters = N cells along the orientation */
    cellSize?: number;
    letterHeight?: number;
    /** marquee only: fitted metal case around every non-blank luminous glyph */
    glyphCase?: { size: number; depth: number; inset: number };
    center: P3;
    width: number;
    height: number;
    /** how far the sign stands out from the wall face */
    depth?: number;
    /** where its back plane sits, clear of any relief it crosses */
    standoff: number;
    normal: P2;
  }[];
  screens: { edge: number; center: P3; width: number; height: number; standoff: number; normal: P2 }[];
  lights: {
    kind: 'entrance' | 'accent';
    /** carrying ground-outline edge */
    edge: number;
    /** centre of the fixture's rear mounting face on the facade plane */
    position: P3;
    normal: P2;
    /** width, height, outward depth */
    size: P3;
    /** distance from the wall plane to the mounting face, for a flush relief mount */
    standoff: number;
  }[];
  facade: {
    style: 'megablock' | 'panel' | 'glass' | 'curtain-wall';
    panelModule: number;
    /** how far the deepest opening unit reaches behind the outline skin, measured on the built geometry */
    wallDepth: number;
    /** the opaque band kept at every floor line, so an interior slab never reads through the glass */
    slabBand: { below: number; above: number };
    /** exact per-floor face grids and opening-free seats for facade-aligned interior partitions */
    grids: {
      floor: number;
      edge: number;
      length: number;
      panelWidth: number;
      panelHeight: number;
      horizontal: number[];
      vertical: number[];
      solid: P2[];
      partitionAnchors: { offset: number; width: number }[];
    }[];
  };
  facadeArtifacts: FacadeArtifact[];
  fireEscape: { edge: number; fromFloor: number; toFloor: number; offset: number; width: number } | null;
  roof: {
    elevation: number;
    outline: P2[];
    parapetHeight: number;
    /** stair-head cutout in the roof plane, with the housing that covers it */
    bulkhead: Bulkhead | null;
    artifacts: RoofArtifact[];
  };
  materials: string[];
}

export interface GenerateOptions {
  textures?: TextureOptions;
}

export interface GenerateResult {
  glb: Uint8Array;
  blueprint: Blueprint;
  /** which texture mode the GLB actually carries, and why when it is not the one asked for */
  textures: { mode: TextureMode; reason?: string };
}
