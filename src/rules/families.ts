// Atlas parcel types map onto template families that share facade logic.

export type AtlasType =
  | 'residential' | 'hotel' | 'offices' | 'corpo' | 'hospital' | 'clinic'
  | 'police' | 'military' | 'factory' | 'commerce' | 'mall' | 'restaurant' | 'coffee_shop';

export type Tier = 'poor' | 'mid' | 'rich' | 'high_rich';

export type Family =
  | 'residential' | 'hotel' | 'office' | 'corpo' | 'hospital'
  | 'security' | 'industrial' | 'commerce';

export const FAMILY: Record<AtlasType, Family> = {
  residential: 'residential',
  hotel: 'hotel',
  offices: 'office',
  corpo: 'corpo',
  hospital: 'hospital',
  clinic: 'hospital',
  police: 'security',
  military: 'security',
  factory: 'industrial',
  commerce: 'commerce',
  mall: 'commerce',
  restaurant: 'commerce',
  coffee_shop: 'commerce',
};
