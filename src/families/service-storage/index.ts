import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'service-storage', groundFloorHeight: 4.5, parapetHeight: 0, wallBackingDepth: 0.12,
  plan, decorate,
  materials: {
    ground: 'cyberpunk/concrete-monolith/mid#weathered',
    wall: 'cyberpunk/concrete-monolith/mid#weathered',
    'inner-wall': 'cyberpunk/concrete-monolith/mid#weathered',
    column: 'cyberpunk/concrete-monolith/mid#weathered',
    'wall-trim': 'cyberpunk/concrete-monolith/mid#weathered',
    'window-frame': 'cyberpunk/metal/mid#paint',
    roof: 'cyberpunk/concrete-monolith/mid#weathered',
    shutter: 'cyberpunk/exterior-louvre/mid#metal',
    'service-metal': 'cyberpunk/metal/mid#paint',
    'service-light': 'cyberpunk/paired-light-warm/mid#surface',
  },
};
