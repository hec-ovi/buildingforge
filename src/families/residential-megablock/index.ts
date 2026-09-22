import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'residential-megablock', groundFloorHeight: 4.2, parapetHeight: 0, wallBackingDepth: 0.36,
  plan, decorate,
  materials: {
    ground: 'cyberpunk/exterior-graphite-concrete/mid#native',
    wall: 'cyberpunk/concrete-monolith/mid#weathered',
    'inner-wall': 'cyberpunk/exterior-cast-concrete/mid#native',
    column: 'cyberpunk/concrete-monolith/mid#weathered',
    'wall-trim': 'cyberpunk/exterior-graphite-concrete/mid#native',
    'window-frame': 'cyberpunk/exterior-graphite-coating/mid#native',
    roof: 'cyberpunk/concrete-monolith/mid#weathered',
    'floor-slab': 'cyberpunk/exterior-graphite-concrete/mid#native',
    'megablock-service': 'cyberpunk/exterior-galvanized-steel/mid#native',
  },
};
