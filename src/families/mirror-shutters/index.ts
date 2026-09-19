import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'mirror-shutters', parapetHeight: 0, plan, decorate,
  materials: {
    ground: 'cyberpunk/ivory-panel/mid#cool-grey',
    wall: 'cyberpunk/paired-window-black/mid#black',
    'inner-wall': 'cyberpunk/ivory-panel/mid#cool-grey',
    column: 'cyberpunk/exterior-brushed-bronze/mid#native',
    'wall-trim': 'cyberpunk/paired-cladding-metal/mid#surface',
    'window-frame': 'cyberpunk/exterior-brushed-bronze/mid#native',
    roof: 'cyberpunk/paired-cladding-metal/mid#surface',
    'light-fixture': 'cyberpunk/paired-light-warm/mid#surface',
  },
};
