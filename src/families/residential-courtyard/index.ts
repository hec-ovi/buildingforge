import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'residential-courtyard', groundFloorHeight: 3.6, parapetHeight: 0, wallBackingDepth: .22,
  plan, decorate,
  materials: {
    ground: 'cyberpunk/concrete-monolith/mid#weathered', wall: 'cyberpunk/concrete-monolith/mid#weathered',
    'inner-wall': 'cyberpunk/concrete-monolith/mid#cast', column: 'cyberpunk/concrete-monolith/mid#weathered',
    'wall-trim': 'cyberpunk/exterior-graphite-concrete/mid#native',
    'window-frame': 'cyberpunk/exterior-graphite-coating/mid#native',
    roof: 'cyberpunk/concrete-monolith/mid#weathered',
    'courtyard-shutter': 'cyberpunk/exterior-graphite-coating/mid#native',
    'courtyard-canopy': 'cyberpunk/exterior-galvanized-steel/mid#native',
    'courtyard-metal': 'cyberpunk/exterior-graphite-coating/mid#native',
    'fire-escape': 'cyberpunk/service-alloy/poor#brushed',
    'courtyard-cloth': 'cyberpunk/fabric/poor#flat',
  },
};
