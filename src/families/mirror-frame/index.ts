import type { BuildingFamily } from '../api.ts';
import { plan } from './plan.ts';
import { decorate } from './decorate.ts';

export const family: BuildingFamily = {
  id: 'mirror-frame', plan, decorate,
  materials: {
    ground: 'cyberpunk/paired-cladding-metal/mid#obsidian',
    wall: 'cyberpunk/paired-cladding-metal/mid#obsidian',
    'inner-wall': 'cyberpunk/paired-cladding-metal/mid#obsidian',
    column: 'cyberpunk/paired-cladding-metal/mid#obsidian',
    'wall-trim': 'cyberpunk/paired-frame-metal/mid#surface',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/paired-frame-metal/mid#surface',
    'portal-trim': 'cyberpunk/portal-limestone/mid#native',
    'portal-light': 'cyberpunk/paired-light-cool/mid#surface',
  },
};
