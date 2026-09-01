// Atlas parcel types map onto template families that share facade logic.
// The map and the feasibility constants live in schemas/floor-constants.json,
// the contract surface assemblers read; this module types the same data.

import constants from '../../schemas/floor-constants.json' with { type: 'json' };

export type AtlasType =
  | 'residential' | 'hotel' | 'offices' | 'corpo' | 'hospital' | 'clinic'
  | 'police' | 'military' | 'factory' | 'commerce' | 'mall' | 'restaurant' | 'coffee_shop';

export type Tier = 'poor' | 'mid' | 'rich' | 'high_rich';

export type Family =
  | 'residential' | 'hotel' | 'office' | 'corpo' | 'hospital'
  | 'security' | 'industrial' | 'commerce';

export const FAMILY = constants.families as Record<AtlasType, Family>;

export interface FeasibilityConstants {
  minFloorHeight: number;
  maxFloorHeight: number;
  minFootprintArea: number;
}

export const FEASIBILITY = constants.constants as Record<Family, FeasibilityConstants>;
