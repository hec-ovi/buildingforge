// Numeric rule tables from docs/RESEARCH.md (sourced real-world ranges).
// Every range is [min, max] in meters unless noted.

import type { Family, Tier } from './families.ts';

export interface FamilyRules {
  floorHeight: [number, number];
  groundFloorFactor: [number, number];
  minFloorHeight: number;
  windowToWall: [number, number];
  windowWidth: [number, number];
  windowHeight: [number, number];
  sill: [number, number];
  bayModule: [number, number];
  columnGrid: [number, number];
  columnWidth: [number, number];
  curtainWall: boolean;
  balconies: boolean;
  entranceGlass: boolean;
  minFootprintArea: number;
}

export const RULES: Record<Family, FamilyRules> = {
  residential: {
    floorHeight: [2.75, 3.05], groundFloorFactor: [1.3, 1.6], minFloorHeight: 2.6,
    windowToWall: [0.15, 0.4], windowWidth: [0.6, 1.2], windowHeight: [0.9, 1.8],
    sill: [0.75, 0.9], bayModule: [3.0, 4.5], columnGrid: [3.0, 4.5],
    columnWidth: [0.3, 0.45], curtainWall: false, balconies: true, entranceGlass: true,
    minFootprintArea: 40,
  },
  hotel: {
    floorHeight: [3.0, 3.3], groundFloorFactor: [1.5, 2.0], minFloorHeight: 2.8,
    windowToWall: [0.3, 0.5], windowWidth: [1.2, 1.8], windowHeight: [1.2, 1.8],
    sill: [0.6, 0.9], bayModule: [3.6, 4.5], columnGrid: [3.6, 4.5],
    columnWidth: [0.35, 0.5], curtainWall: false, balconies: true, entranceGlass: true,
    minFootprintArea: 120,
  },
  office: {
    floorHeight: [3.66, 4.0], groundFloorFactor: [1.3, 1.6], minFloorHeight: 3.4,
    windowToWall: [0.3, 0.8], windowWidth: [1.5, 2.5], windowHeight: [1.5, 2.0],
    sill: [0.7, 0.9], bayModule: [1.2, 1.8], columnGrid: [6.0, 9.0],
    columnWidth: [0.3, 0.6], curtainWall: true, balconies: false, entranceGlass: true,
    minFootprintArea: 100,
  },
  corpo: {
    floorHeight: [3.9, 4.27], groundFloorFactor: [1.5, 2.0], minFloorHeight: 3.6,
    windowToWall: [0.7, 0.95], windowWidth: [1.5, 1.8], windowHeight: [2.4, 3.0],
    sill: [0.0, 0.4], bayModule: [1.5, 1.8], columnGrid: [7.5, 9.0],
    columnWidth: [0.4, 0.7], curtainWall: true, balconies: false, entranceGlass: true,
    minFootprintArea: 200,
  },
  hospital: {
    floorHeight: [4.2, 4.5], groundFloorFactor: [1.2, 1.4], minFloorHeight: 3.8,
    windowToWall: [0.2, 0.35], windowWidth: [1.2, 1.8], windowHeight: [1.2, 1.6],
    sill: [0.7, 0.91], bayModule: [3.6, 4.8], columnGrid: [6.0, 7.5],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: true,
    minFootprintArea: 250,
  },
  security: {
    floorHeight: [3.2, 3.6], groundFloorFactor: [1.2, 1.5], minFloorHeight: 3.0,
    windowToWall: [0.1, 0.2], windowWidth: [0.6, 0.9], windowHeight: [0.9, 1.2],
    sill: [1.5, 2.0], bayModule: [3.0, 4.0], columnGrid: [4.5, 6.0],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: false,
    minFootprintArea: 120,
  },
  industrial: {
    floorHeight: [6.0, 9.0], groundFloorFactor: [1.0, 1.0], minFloorHeight: 4.5,
    windowToWall: [0.05, 0.15], windowWidth: [1.8, 3.0], windowHeight: [0.9, 1.5],
    sill: [2.5, 4.0], bayModule: [6.0, 9.0], columnGrid: [8.0, 12.0],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: false,
    minFootprintArea: 200,
  },
  commerce: {
    floorHeight: [3.4, 4.0], groundFloorFactor: [1.2, 1.5], minFloorHeight: 3.0,
    windowToWall: [0.4, 0.7], windowWidth: [1.5, 2.4], windowHeight: [1.5, 2.1],
    sill: [0.4, 0.8], bayModule: [2.4, 3.6], columnGrid: [7.5, 9.0],
    columnWidth: [0.3, 0.5], curtainWall: false, balconies: false, entranceGlass: true,
    minFootprintArea: 30,
  },
};

export const TIER_WWR_SHIFT: Record<Tier, number> = { poor: -0.35, mid: 0, rich: 0.35, high_rich: 0.7 };

export const DOORS = {
  single: { width: 0.95, height: 2.1 },
  double: { width: 1.85, height: 2.15 },
  grandPortal: { width: [2.4, 4.2] as [number, number], height: [2.6, 3.5] as [number, number] },
  loadingDock: { width: [2.4, 2.6] as [number, number], height: [2.7, 3.0] as [number, number] },
  rollerDrive: { width: [3.6, 5.4] as [number, number], height: [3.6, 5.0] as [number, number] },
};

export const BALCONY = {
  depth: { poor: [0, 0], mid: [1.2, 1.5], rich: [1.5, 2.0], high_rich: [1.8, 2.5] } as Record<Tier, [number, number]>,
  julietDepth: 0.15,
  railing: 1.07,
  maxCantilever: 2.0,
};

export const STRUCTURE = {
  concreteMaxFloors: 40,
  steelLook: 'thin' as const,
  columnTaperTopFactor: 0.7,
};

export const OPENING = { minPier: 0.3, cornerMargin: 0.6, headAlign: [2.1, 2.4] as [number, number] };

export const FIRE_ESCAPE = {
  maxFloors: 7,
  stairWidth: 0.56,
  platformWidth: 0.91,
  platformLength: 2.4,
  allowedFamilies: ['residential', 'industrial'] as string[],
  allowedTiers: ['poor', 'mid'] as string[],
};

export const LIGHTING = {
  accentSpacing: [4, 8] as [number, number],
  minSpacing: 2,
  maxSpacing: 12,
  entranceFixtures: [2, 4] as [number, number],
  accentFamilies: ['corpo', 'office', 'hotel', 'commerce'] as string[],
};

export const SIGNAGE = {
  letterPerDistance: 1 / 120,
  bandHeight: [0.6, 0.9] as [number, number],
  bandBase: [3.0, 4.5] as [number, number],
  letterAdvance: 0.7,
  maxChars: 40,
  logoRatios: { '1:1': 1, '3:2': 3 / 2, '16:9': 16 / 9 } as Record<string, number>,
  screenFamilies: ['corpo', 'office', 'hotel', 'commerce'] as string[],
};

export const PARAPET: [number, number] = [0.9, 1.1];

export interface RoofArtifactRule {
  kind: string;
  size: [[number, number], [number, number], [number, number]];
  chance: number;
}

export const ROOF_ARTIFACTS: Record<Family, RoofArtifactRule[]> = {
  residential: [
    { kind: 'bulkhead', size: [[2.5, 3.5], [2.5, 3.5], [2.6, 3.2]], chance: 1 },
    { kind: 'water-tank', size: [[3.0, 4.5], [3.0, 4.5], [3.5, 5.0]], chance: 0.6 },
    { kind: 'hvac', size: [[1.0, 1.6], [0.6, 1.0], [0.7, 1.0]], chance: 0.8 },
    { kind: 'antenna', size: [[0.1, 0.2], [0.1, 0.2], [3.0, 6.0]], chance: 0.7 },
    { kind: 'solar', size: [[2.0, 4.0], [1.0, 2.0], [0.15, 0.25]], chance: 0.3 },
  ],
  hotel: [
    { kind: 'bulkhead', size: [[3.0, 4.0], [3.0, 4.0], [2.8, 3.4]], chance: 1 },
    { kind: 'cooling-tower', size: [[2.5, 4.0], [2.5, 4.0], [2.0, 3.0]], chance: 0.8 },
    { kind: 'pool', size: [[4.0, 8.0], [3.0, 5.0], [0.3, 0.5]], chance: 0.35 },
    { kind: 'bar', size: [[3.0, 5.0], [2.5, 4.0], [2.8, 3.2]], chance: 0.25 },
  ],
  office: [
    { kind: 'penthouse-screen', size: [[6.0, 12.0], [4.0, 8.0], [2.5, 4.0]], chance: 1 },
    { kind: 'cooling-tower', size: [[3.0, 6.0], [3.0, 6.0], [2.5, 4.0]], chance: 0.8 },
    { kind: 'antenna', size: [[0.15, 0.3], [0.15, 0.3], [4.0, 8.0]], chance: 0.6 },
  ],
  corpo: [
    { kind: 'penthouse-screen', size: [[8.0, 14.0], [5.0, 9.0], [3.0, 4.5]], chance: 1 },
    { kind: 'cooling-tower', size: [[3.0, 6.0], [3.0, 6.0], [2.5, 4.0]], chance: 0.7 },
    { kind: 'helipad', size: [[12.0, 14.0], [12.0, 14.0], [0.3, 0.5]], chance: 0.5 },
    { kind: 'antenna', size: [[0.2, 0.4], [0.2, 0.4], [6.0, 12.0]], chance: 0.8 },
  ],
  hospital: [
    { kind: 'helipad', size: [[12.0, 14.0], [12.0, 14.0], [0.3, 0.5]], chance: 0.8 },
    { kind: 'hvac', size: [[3.0, 6.0], [2.0, 4.0], [1.5, 2.5]], chance: 1 },
    { kind: 'stack', size: [[0.6, 1.0], [0.6, 1.0], [3.0, 5.0]], chance: 0.6 },
  ],
  security: [
    { kind: 'antenna', size: [[0.8, 1.6], [0.8, 1.6], [5.0, 12.0]], chance: 1 },
    { kind: 'dish', size: [[1.5, 2.5], [1.5, 2.5], [1.5, 2.5]], chance: 0.7 },
    { kind: 'hvac', size: [[1.5, 2.5], [1.0, 1.8], [1.0, 1.5]], chance: 0.7 },
  ],
  industrial: [
    { kind: 'stack', size: [[1.0, 2.0], [1.0, 2.0], [5.0, 10.0]], chance: 0.9 },
    { kind: 'vent', size: [[1.0, 2.0], [1.0, 2.0], [1.0, 2.0]], chance: 1 },
    { kind: 'water-tank', size: [[3.0, 4.5], [3.0, 4.5], [3.5, 5.0]], chance: 0.5 },
  ],
  commerce: [
    { kind: 'hvac', size: [[1.2, 2.2], [0.8, 1.4], [0.8, 1.2]], chance: 1 },
    { kind: 'bulkhead', size: [[2.0, 3.0], [2.0, 3.0], [2.4, 2.8]], chance: 0.5 },
  ],
};

export interface CurtainDist { open: number; half: number; closed80: number }

export const CURTAINS = {
  day: { sunFacing: { open: 0.25, half: 0.35, closed80: 0.4 }, shaded: { open: 0.45, half: 0.3, closed80: 0.25 } },
  night: { sunFacing: { open: 0.35, half: 0.25, closed80: 0.4 }, shaded: { open: 0.4, half: 0.25, closed80: 0.35 } },
} as Record<'day' | 'night', { sunFacing: CurtainDist; shaded: CurtainDist }>;

export const AD_SCREEN = {
  families: ['corpo', 'office', 'hotel', 'commerce'] as string[],
  tiers: ['mid', 'rich', 'high_rich'] as string[],
  widthFraction: [0.35, 0.6] as [number, number],
  ratios: [16 / 9, 4 / 1, 3 / 2],
};
