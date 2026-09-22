import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'residential-serviced', groundFloorHeight: 3.6, parapetHeight: 0, wallBackingDepth: 0.78, plan, decorate,
  materials: {
    ground: 'cyberpunk/concrete-monolith/mid#weathered',
    wall: 'cyberpunk/concrete-monolith/mid#weathered',
    'inner-wall': 'cyberpunk/concrete-monolith/mid#weathered',
    column: 'cyberpunk/exterior-graphite-coating/mid#native',
    'wall-trim': 'cyberpunk/paired-frame-metal/mid#surface',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/exterior-graphite-coating/mid#native',
    service: 'cyberpunk/service-alloy/poor#brushed',
    'service-dark': 'cyberpunk/paired-frame-metal/mid#surface',
  },
};
