// TypeScript mirrors of schemas/building-request.schema.json and schemas/blueprint.schema.json.

import type { AtlasType, Tier } from './rules/families.ts';
import type { TextureMode, TextureOptions } from './materials/apply.ts';
import type { FacadeServicesOutput, WindowDamage } from './facade-services/index.ts';

export type P2 = [number, number];
export type P3 = [number, number, number];

export type ExteriorStyleId =
  | 'residential-salvaged' | 'residential-weathered' | 'residential-modest'
  | 'premium-obsidian' | 'premium-office' | 'premium-mineral'
  | 'civic-utility' | 'civic-institutional' | 'civic-industrial';

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

export interface CurtainOverride {
  /** stable opening id from the generated facade */
  openingId: string;
  /** visible opening requested by the caller; coverage is its exact complement */
  openPercent: number;
}

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
    shape?: 'auto' | 'box' | 'rounded-box' | 'octagon' | 'cylinder' | 'pyramid' | 'setback';
    exteriorStyle?: ExteriorStyleId;
    glb?: 'named' | 'merged';
    balconies?: 'auto' | 'on' | 'off';
    balconyStyle?: 'auto' | 'bay' | 'full';
    openFront?: 'auto' | 'on' | 'off';
    entranceLayout?: 'single' | 'repeated';
    fireEscape?: boolean | 'auto' | 'on' | 'off';
    windows?: 'auto' | 'none';
    signage?: Signage;
    adScreens?: 'auto' | 'on' | 'off';
    roofArtifacts?: 'auto' | 'off';
    facadeServices?: 'auto' | 'on' | 'off';
    hangingClothes?: 'auto' | 'on' | 'off';
    windowDamage?: 'off' | 'sparse';
    curtains?: {
      profile?: 'day' | 'night';
      sunAzimuthDeg?: number;
      overrides?: CurtainOverride[];
    };
  };
}

export type OpeningKind = 'door' | 'window' | 'balconyDoor' | 'openFront' | 'aperture';
export type CurtainState = 'open' | 'partial' | 'half' | 'closed80' | 'closed';
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
  /** Exact covering travel; authoritative over the legacy categorical state. */
  curtain?: { style: 'roller-shade' | 'venetian-blind'; closurePercent: number };
  windowTreatment?: { privacy: 'shell-only'; nodeId: string };
  glazing?: { offset: number; sill: number; width: number; height: number; glassDepth: number; housingBackDepth: number };
  exteriorCovering?: { style: 'metal-louvre'; placement: 'exterior'; depth: number; standoff: number; material: string };
  state?: CurtainState;
  /** mullion grid of a glazed opening: cols x rows panes, each within the tier's pane limit */
  panes?: { cols: number; rows: number };
  /** curtain-wall bay: compatibility lower opaque band, always zero */
  spandrel?: number;
  /** curtain-wall bay: opaque head spandrel covering its ceiling plenum and the slab above */
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
  /** Explicit pane damage. Absent means the complete pane grid remains intact. */
  damage?: Omit<WindowDamage, 'openingId' | 'face' | 'materialKey'>;
}

export interface Floor {
  index: number;
  kind: string;
  elevation: number;
  height: number;
  outline: P2[];
  openings: Opening[];
}

export type MastVariant = 'whip' | 'crossarm-mast';
export type RoofArtifactKind =
  | 'water-tank' | 'bulkhead' | 'hvac' | 'cooling-tower' | 'antenna' | 'mast' | 'dish'
  | 'solar' | 'helipad' | 'vent' | 'stack' | 'penthouse-screen' | 'pool' | 'bar';

export interface FittedSegment {
  from: P3;
  to: P3;
}

export interface FittedCable {
  id: string;
  path: P3[];
}

export type ExternalAttachment = {
  id: string;
  position: P3;
  orientation: 'omnidirectional';
  clearanceRadius: number;
} | {
  id: string;
  position: P3;
  orientation: 'directional';
  normal: P3;
  clearanceRadius: number;
};

/** Exact support and cable routes for an antenna or utility mast. */
export interface MastAssembly {
  variant: MastVariant;
  mast: FittedSegment;
  arms: FittedSegment[];
  supports: FittedSegment[];
  cableAttachments: P3[];
  cables: FittedCable[];
  externalAttachments: ExternalAttachment[];
}

export interface RoofArtifact {
  id: string;
  kind: RoofArtifactKind;
  center: P2;
  size: P3;
  rotationDeg: number;
  mastAssembly?: MastAssembly;
}

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
  /** stable equipment endpoint id */
  id: string;
  kind: 'utility-box' | 'ac-unit';
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
    surfacePattern: { kind: 'continuous' } | { kind: 'panel'; width: number; height: number; jointWidth: number };
    groundMaterial: { key: string; variantId: string };
    exteriorStyle: ExteriorStyleId;
    style: 'megablock' | 'panel' | 'glass' | 'curtain-wall';
    panelModule: number;
    panelPattern: {
      width: number;
      height: number;
      jointWidth: number;
      origin: 'face-floor';
      boundary: 'centered-solid-border';
    };
    materialPlan: {
      palette: 'neutral-dystopian';
      field: { key: string; variantId: string };
      border: { key: string; variantId: string };
      trim: { key: string; variantId: string };
    };
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
      horizontalBorders: P2;
      verticalBorders: P2;
      solid: P2[];
      /** The only permitted full-thickness partition endpoints on this face. */
      partitionAnchors: { offset: number; width: number }[];
    }[];
  };
  facadeArtifacts: FacadeArtifact[];
  facadeServices: FacadeServicesOutput;
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
  /** Explicit named variants for surfaces whose appearance must not be seed-random. */
  materialVariants: Record<string, string>;
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
