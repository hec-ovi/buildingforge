// Internal layout model: everything the mesher and blueprint builder consume.

import type { P2, P3, Opening, Blueprint, BuildingRequest, Aperture, BalconyBand } from '../types.ts';
import type { Relief } from './relief.ts';
import type { AnchorMount } from './anchors.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { FacadeServicesOutput } from '../facade-services/index.ts';

export interface Style {
  floorHeight: number;
  groundFloorHeight: number;
  windowWidth: number;
  /** window height as a fraction of a floor's clear height (schemas/proportions.json) */
  windowFraction: number;
  sill: number;
  /** ground-floor storefront: the sill its glass stands on, the glass reaching the head band */
  storefrontSill: number;
  /** where this building sits inside its family's entrance height range, 0..1 */
  entrancePick: number;
  bayModule: number;
  wwr: number;
  columnSpacing: number;
  columnWidth: number;
  showColumns: boolean;
  balconyDepth: number;
  balconyWidth: number;
  juliet: boolean;
  parapetHeight: number;
  /** facade relief and window placement style, frozen per building */
  facade: {
    kind: 'megablock' | 'panel' | 'glass' | 'curtain-wall';
    panelModule: number;
    panelWidth: number;
    panelHeight: number;
    panelJointWidth: number;
    panelOrigin: 'face-floor';
    panelBoundary: 'centered-solid-border';
    ribWidth: number;
    ribDepth: number;
    bandHeight: number;
    bandProud: number;
    windowRecess: number;
    utilityChance: number;
    /** curtain wall only: the opaque band at each slab edge */
    spandrelHeight: number;
  };
  /** window unit profile, frozen per building */
  glazing: {
    frameWidth: number;
    frameProud: number;
    mullionWidth: number;
    glassInset: number;
    maxPaneWidth: number;
    maxPaneHeight: number;
  };
}

export interface FloorLayout {
  index: number;
  kind: string;
  elevation: number;
  height: number;
  outline: P2[];
  openings: Opening[];
}

/** An aperture hole to carve, resolved to world geometry. */
export interface CarvedAperture {
  aperture: Aperture;
  facePoly: P2[]; // cut polygon in face-plane [u, y] coords (u from footprint vertex, y absolute)
}

export interface Layout {
  request: BuildingRequest;
  family: Family;
  tier: Tier;
  theme: string;
  style: Style;
  /** ribs, columns and floor bands, the one source both the mesher and the placement scan read */
  relief: Relief;
  floors: FloorLayout[];
  balconyBands: BalconyBand[];
  carved: CarvedAperture[];
  anchors: AnchorMount[];
  signage: Blueprint['signage'];
  screens: Blueprint['screens'];
  lights: Blueprint['lights'];
  facadeArtifacts: Blueprint['facadeArtifacts'];
  facadeServices: FacadeServicesOutput;
  fireEscape: Blueprint['fireEscape'];
  roof: Blueprint['roof'];
}

export function materialKey(theme: string, kind: string, tier: Tier): string {
  return `${theme}/${kind}/${tier}`;
}

export type FaceFrame = {
  origin: P3;      // bottom-left corner seen from outside
  right: P3;       // unit, horizontal, along the face
  up: P3;          // unit +Y
  normal: P3;      // unit outward
  length: number;  // face width in meters
};
