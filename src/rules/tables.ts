// Numeric rule tables from docs/RESEARCH.md (sourced real-world ranges).
// Every range is [min, max] in meters unless noted.

import { FEASIBILITY, type FeasibilityConstants, type Family, type Tier } from './families.ts';
import { PROPORTIONS } from './proportions.ts';

// Opening sizes (window width and height, sill, entrance height) live in
// schemas/proportions.json, the published proportion table; these rules cover
// what the table does not: storey heights, structure and bay rhythm.
interface StyleRules {
  floorHeight: [number, number];
  groundFloorFactor: [number, number];
  windowToWall: [number, number];
  bayModule: [number, number];
  columnGrid: [number, number];
  columnWidth: [number, number];
  curtainWall: boolean;
  balconies: boolean;
  entranceGlass: boolean;
}

export interface FamilyRules extends StyleRules, FeasibilityConstants {}

const STYLE_RULES: Record<Family, StyleRules> = {
  residential: {
    floorHeight: [2.9, 3.2], groundFloorFactor: [1.3, 1.6],
    windowToWall: [0.15, 0.4], bayModule: [3.0, 4.5], columnGrid: [3.0, 4.5],
    columnWidth: [0.3, 0.45], curtainWall: false, balconies: true, entranceGlass: true,
  },
  hotel: {
    floorHeight: [3.1, 3.4], groundFloorFactor: [1.5, 2.0],
    windowToWall: [0.3, 0.5], bayModule: [3.6, 4.5], columnGrid: [3.6, 4.5],
    columnWidth: [0.35, 0.5], curtainWall: false, balconies: true, entranceGlass: true,
  },
  office: {
    floorHeight: [3.66, 4.0], groundFloorFactor: [1.3, 1.6],
    windowToWall: [0.3, 0.8], bayModule: [1.8, 2.6], columnGrid: [6.0, 9.0],
    columnWidth: [0.3, 0.6], curtainWall: true, balconies: false, entranceGlass: true,
  },
  corpo: {
    floorHeight: [3.9, 4.27], groundFloorFactor: [1.5, 2.0],
    windowToWall: [0.7, 0.95], bayModule: [1.8, 2.4], columnGrid: [7.5, 9.0],
    columnWidth: [0.4, 0.7], curtainWall: true, balconies: false, entranceGlass: true,
  },
  hospital: {
    floorHeight: [4.2, 4.5], groundFloorFactor: [1.2, 1.4],
    windowToWall: [0.2, 0.35], bayModule: [3.6, 4.8], columnGrid: [6.0, 7.5],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: true,
  },
  security: {
    floorHeight: [3.2, 3.6], groundFloorFactor: [1.2, 1.5],
    windowToWall: [0.1, 0.2], bayModule: [3.0, 4.0], columnGrid: [4.5, 6.0],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: false,
  },
  industrial: {
    floorHeight: [6.0, 9.0], groundFloorFactor: [1.0, 1.0],
    windowToWall: [0.05, 0.15], bayModule: [6.0, 9.0], columnGrid: [8.0, 12.0],
    columnWidth: [0.4, 0.6], curtainWall: false, balconies: false, entranceGlass: false,
  },
  commerce: {
    floorHeight: [3.4, 4.0], groundFloorFactor: [1.2, 1.5],
    windowToWall: [0.4, 0.7], bayModule: [2.4, 3.6], columnGrid: [7.5, 9.0],
    columnWidth: [0.3, 0.5], curtainWall: false, balconies: false, entranceGlass: true,
  },
};

export const RULES = Object.fromEntries(
  (Object.keys(STYLE_RULES) as Family[]).map((f) => [f, { ...STYLE_RULES[f], ...FEASIBILITY[f] }]),
) as Record<Family, FamilyRules>;

export const TIER_WWR_SHIFT: Record<Tier, number> = { poor: -0.35, mid: 0, rich: 0.35, high_rich: 0.7 };

/**
 * Entrance widths come from the proportion table; heights come from the family
 * row there too, so every entrance lands in its published range. Service doors
 * are their own thing: a roller shutter is sized by the truck, not by a person.
 */
export const DOORS = {
  width: PROPORTIONS.entranceWidth,
  /** one swinging leaf: wider than this and the entrance takes two */
  maxLeafWidth: 1.2,
  rollerDrive: { width: [3.6, 5.4] as [number, number], height: [3.6, 5.0] as [number, number] },
};

export const BALCONY = {
  depth: { poor: [0, 0], mid: [1.2, 1.5], rich: [1.5, 2.0], high_rich: [1.8, 2.5] } as Record<Tier, [number, number]>,
  julietDepth: 0.15,
  railing: 1.07,
  maxCantilever: 2.0,
};

export const STRUCTURE = { concreteMaxFloors: 40 };

/**
 * Facade styles across the tier spectrum. `panelModule` is the concrete panel
 * width and the wall material's tile size at once, so the joints painted in the
 * map land exactly on the geometry that sits on the same grid.
 * - megablock (poor): heavy ribbed panel grid, many small deep-set windows
 *   scattered inside the cells, surface-mounted utility boxes.
 * - panel (mid): the same grid read thin, moderate reveals, few boxes.
 * - glass (rich, high_rich): clean mullioned glazing on flush panels.
 */
export const FACADE = {
  panelModule: 3.0,
  styles: {
    megablock: {
      ribWidth: [0.35, 0.5] as [number, number],
      ribDepth: [0.2, 0.35] as [number, number],
      bandHeight: [0.25, 0.4] as [number, number],
      bandProud: [0.1, 0.18] as [number, number],
      windowRecess: [0.25, 0.4] as [number, number],
      utilityChance: 0.14,
    },
    panel: {
      ribWidth: [0.18, 0.28] as [number, number],
      ribDepth: [0.07, 0.13] as [number, number],
      bandHeight: [0.16, 0.26] as [number, number],
      bandProud: [0.04, 0.09] as [number, number],
      windowRecess: [0.1, 0.18] as [number, number],
      utilityChance: 0.04,
    },
    glass: {
      ribWidth: [0, 0] as [number, number],
      ribDepth: [0, 0] as [number, number],
      bandHeight: [0, 0] as [number, number],
      bandProud: [0, 0] as [number, number],
      windowRecess: [0, 0.03] as [number, number], // glazing sits nearly flush, mullions read proud
      utilityChance: 0,
    },
  },
  /** megablock cells: the proportion table's small deep openings, semi-irregular inside the panel grid */
  megablockWindow: {
    width: PROPORTIONS.megablock.windowWidth,
    height: PROPORTIONS.megablock.windowHeight,
    minSill: PROPORTIONS.megablock.minSill,
    density: 0.55,
  },
  utilityBox: {
    width: [0.35, 0.6] as [number, number],
    height: [0.25, 0.45] as [number, number],
    depth: [0.14, 0.26] as [number, number],
  },
};

export const FACADE_STYLE: Record<Tier, keyof typeof FACADE.styles> = {
  poor: 'megablock', mid: 'panel', rich: 'glass', high_rich: 'glass',
};

/**
 * Window units. A pane is limited by what the glass thickness and the tier's
 * budget carry, so wider or taller openings get a mullion grid instead of one
 * sheet. Profile dimensions are the aluminium sections real curtain walls use.
 */
export const GLAZING = {
  maxPaneWidth: { poor: 0.85, mid: 1.2, rich: 1.55, high_rich: 1.9 } as Record<Tier, number>,
  maxPaneHeight: { poor: 1.1, mid: 1.55, rich: 2.1, high_rich: 2.6 } as Record<Tier, number>,
  frameWidth: [0.05, 0.09] as [number, number],
  frameProud: [0.04, 0.08] as [number, number],
  mullionWidth: [0.035, 0.06] as [number, number],
  glassInset: [0.03, 0.06] as [number, number],
};

export const OPENING = { minPier: 0.3, cornerMargin: 0.6 };

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
  accentFamilies: ['corpo', 'office', 'hotel', 'commerce'] as string[],
};

/**
 * Signs are modular: one letter, one 1x1 cell, N letters N cells. They run
 * horizontally as a marquee over the entrance or stack into a blade sign
 * protruding edge-on from the facade, framed like the reference hotel sign.
 */
export const SIGNAGE = {
  cellSize: [0.5, 0.85] as [number, number],
  /** legibility floor: a storefront sign is read at ~25 m (letter height ~ distance / 120) */
  minCellSize: 0.28,
  framePad: 0.12,
  glyphFill: 0.72,
  marqueeProud: 0.16,
  bladeDepth: [0.8, 1.4] as [number, number],
  bladeThickness: 0.22,
  /** families that hang a blade sign when the facade is not much wider than it is tall */
  bladeFamilies: ['hotel', 'commerce', 'residential'] as string[],
  maxChars: 40,
  logoRatios: { '1:1': 1, '3:2': 3 / 2, '16:9': 16 / 9 } as Record<string, number>,
  /**
   * Letter atlas from ../materials: `<theme>/letter-atlas/<tier>` is one exact
   * sheet of lit glyph cells, row-major over the charset. A glyph quad shows the
   * cell of its character; the trailing space is the blank cell everything off
   * the charset falls back to. 47 characters in 48 cells.
   */
  letterAtlas: {
    kind: 'letter-atlas',
    cols: 8,
    rows: 6,
    charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.,'!?:/&+ ",
  },
};

export const PARAPET: [number, number] = [0.9, 1.1];

/**
 * Roof access: the cutout the interior stair head lands in, and the housing that
 * covers it. Sized for a stair shaft plus its landing, with walk space kept
 * clear around the housing and in front of its door.
 */
export const ROOF_ACCESS = {
  width: [2.4, 3.0] as [number, number],
  depth: [3.0, 3.8] as [number, number],
  housingHeight: [2.4, 2.9] as [number, number],
  doorWidth: 0.95,
  doorHeight: 2.05,
  clearance: 0.9,
};

export interface RoofArtifactRule {
  kind: string;
  size: [[number, number], [number, number], [number, number]];
  chance: number;
}

export const ROOF_ARTIFACTS: Record<Family, RoofArtifactRule[]> = {
  residential: [
    { kind: 'water-tank', size: [[3.0, 4.5], [3.0, 4.5], [3.5, 5.0]], chance: 0.6 },
    { kind: 'hvac', size: [[1.0, 1.6], [0.6, 1.0], [0.7, 1.0]], chance: 0.8 },
    { kind: 'antenna', size: [[0.1, 0.2], [0.1, 0.2], [3.0, 6.0]], chance: 0.7 },
    { kind: 'solar', size: [[2.0, 4.0], [1.0, 2.0], [0.15, 0.25]], chance: 0.3 },
  ],
  hotel: [
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
