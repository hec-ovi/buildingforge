import type { BuildingFamily } from './api.ts';
import { family as corporate } from './corporate-sectors/index.ts';
import { family as faceted } from './faceted-bays/index.ts';
import { family as white } from './white-grid/index.ts';
import { family as balcony } from './balcony-grid/index.ts';
import { family as shutters } from './mirror-shutters/index.ts';
import { family as mirror } from './mirror-frame/index.ts';
import { family as courtyard } from './residential-courtyard/index.ts';
import { family as serviced } from './residential-serviced/index.ts';
import { family as megablock } from './residential-megablock/index.ts';
import { family as framed } from './industrial-framed/index.ts';
import { family as solid } from './industrial-solid/index.ts';
import { family as storage } from './service-storage/index.ts';

export const FAMILY_IDS = ['corporate-sectors', 'faceted-bays', 'white-grid', 'balcony-grid', 'mirror-shutters', 'mirror-frame',
  'residential-courtyard', 'residential-serviced', 'residential-megablock', 'industrial-framed', 'industrial-solid', 'service-storage'] as const;
export type FamilyArchitecture = typeof FAMILY_IDS[number];
const families = new Map<string, BuildingFamily>([corporate, faceted, white, balcony, shutters, mirror,
  courtyard, serviced, megablock, framed, solid, storage].map(f => [f.id, f]));
export function buildingFamily(id: string | undefined): BuildingFamily | undefined { return id ? families.get(id) : undefined; }
export function isFamilyArchitecture(id: string | undefined): id is FamilyArchitecture { return !!buildingFamily(id); }
