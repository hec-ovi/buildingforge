import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';
import { materials } from './materials.ts';

export const family: BuildingFamily = {
  id: 'residential-serviced', groundFloorHeight: 3.6, parapetHeight: 0, wallBackingDepth: 0.78, plan, decorate,
  materials,
};
