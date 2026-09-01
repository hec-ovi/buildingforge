// TypeScript mirrors of schemas/building-request.schema.json and schemas/blueprint.schema.json.

import type { AtlasType, Tier } from './rules/families.ts';

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
    balconies?: 'auto' | 'on' | 'off';
    fireEscape?: boolean;
    windows?: 'auto' | 'none';
    signage?: Signage;
    adScreens?: 'auto' | 'on' | 'off';
    roofArtifacts?: 'auto' | 'off';
    curtains?: { profile?: 'day' | 'night'; sunAzimuthDeg?: number };
  };
}

export type OpeningKind = 'door' | 'window' | 'balconyDoor' | 'aperture';
export type CurtainState = 'open' | 'half' | 'closed80';

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
  balcony?: { depth: number; width: number };
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

export interface Blueprint {
  buildingId: string;
  seed: string;
  bounds: { footprint: P2[]; height: number };
  floors: Floor[];
  anchors: { id: string; position: P3; normal: P2 }[];
  signage: {
    mode: 'marquee' | 'logo';
    text?: string;
    ratio?: '1:1' | '3:2' | '16:9';
    letterHeight?: number;
    center: P3;
    width: number;
    height: number;
    normal: P2;
  }[];
  screens: { center: P3; width: number; height: number; normal: P2 }[];
  lights: { kind: 'entrance' | 'accent'; position: P3; normal: P2 }[];
  fireEscape: { edge: number; fromFloor: number; toFloor: number } | null;
  roof: { elevation: number; outline: P2[]; parapetHeight: number; artifacts: RoofArtifact[] };
  materials: string[];
}

export interface GenerateResult { glb: Uint8Array; blueprint: Blueprint }
