import type { BuildingFamily } from '../api.ts';
import { decorateFloors } from './facade.ts';
import { plan } from './plan.ts';
import { decoratePodium } from './podium.ts';
import { decorateScreen } from './screen.ts';

export const family: BuildingFamily = {
  id: 'corporate-sectors',
  wallBackingDepth: 1.6,
  plan,
  materials: {
    ground: 'cyberpunk/corporate-panel/mid#native',
    wall: 'cyberpunk/corporate-panel/mid#native',
    'inner-wall': 'cyberpunk/corporate-panel/mid#native',
    column: 'cyberpunk/paired-frame-metal/mid#surface',
    'wall-trim': 'cyberpunk/paired-cladding-metal/mid#surface',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/paired-cladding-metal/mid#surface',
    light: 'cyberpunk/paired-light-cool/mid#surface',
    screen: 'cyberpunk/corporate-screen/mid#native',
  },
  decorate(context) {
    const previous = context.builder.floor;
    try {
      const instances = decoratePodium(context);
      decorateFloors(context);
      decorateScreen(context);
      return { instances };
    } finally { context.builder.floor = previous; }
  },
};
