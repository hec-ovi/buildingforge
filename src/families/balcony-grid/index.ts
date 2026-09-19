import type { BuildingFamily } from '../api.ts';
import { decorate } from './decorate.ts';
import { materials } from './materials.ts';
import { plan } from './plan.ts';

export const family: BuildingFamily = { id: 'balcony-grid', parapetHeight: 0.3, plan, decorate, materials };
