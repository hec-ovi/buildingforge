// The six authored piece sets, one per registered building family.

import { ExteriorError } from '../../core/errors.ts';
import { recipe as corporate } from './corporate-sectors.ts';
import { recipe as faceted } from './faceted-bays.ts';
import { recipe as white } from './white-grid.ts';
import { recipe as balcony } from './balcony-grid.ts';
import { recipe as shutters } from './mirror-shutters.ts';
import { recipe as mirror } from './mirror-frame.ts';
import type { KitRecipe } from '../recipe.ts';

const recipes = new Map<string, KitRecipe>(
  [corporate, faceted, white, balcony, shutters, mirror].map(recipe => [recipe.family, recipe]));

export const KIT_FAMILIES = [...recipes.keys()].sort();

export function recipeFor(family: string): KitRecipe {
  const recipe = recipes.get(family);
  if (!recipe) throw new ExteriorError('E_SCHEMA', `no piece set for family "${family}"`, { family, known: KIT_FAMILIES });
  return recipe;
}
