import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'industrial-solid', groundFloorHeight: 4.4, parapetHeight: 0, wallBackingDepth: 0.2, plan, decorate,
  materials: {
    ground: 'cyberpunk/concrete-monolith/mid#weathered',
    wall: 'cyberpunk/concrete-monolith/mid#weathered',
    'inner-wall': 'cyberpunk/concrete-monolith/mid#weathered',
    column: 'cyberpunk/concrete-monolith/mid#graphite',
    'wall-trim': 'cyberpunk/paired-frame-metal/mid#surface',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/concrete-monolith/mid#graphite',
  },
};
