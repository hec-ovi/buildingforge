import type { BuildingFamily } from '../api.ts';
import { FacetedBayPlanner } from './plan.ts';
import { FacetedBayDecoration } from './decorate.ts';

const planner = new FacetedBayPlanner();
const decoration = new FacetedBayDecoration();

export const family: BuildingFamily = {
  id: 'faceted-bays',
  parapetHeight: 0,
  plan: input => planner.plan(input),
  decorate: context => decoration.decorate(context),
  materials: {
    ground: 'cyberpunk/exterior-cast-concrete/mid#native',
    wall: 'cyberpunk/ivory-panel/mid#cool-grey',
    'inner-wall': 'cyberpunk/ivory-panel/mid#cool-grey',
    column: 'cyberpunk/ivory-panel/mid#cool-grey',
    'wall-trim': 'cyberpunk/exterior-cast-concrete/mid#native',
    'window-frame': 'cyberpunk/paired-frame-metal/mid#surface',
    roof: 'cyberpunk/exterior-cast-concrete/mid#native',
    screen: 'cyberpunk/corporate-screen/mid#native',
  },
};
