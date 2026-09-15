import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'white-grid',
  groundFloorHeight: 5,
  plan,
  decorate,
  materials: {
    ground: 'cyberpunk/facade-chrome/mid#native',
    wall: 'cyberpunk/facade-chrome/mid#native',
    'inner-wall': 'cyberpunk/paired-frame-metal/mid#surface',
    column: 'cyberpunk/ivory-panel/mid#native',
    'wall-trim': 'cyberpunk/facade-chrome/mid#native',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/ivory-panel/mid#native',
  },
};
