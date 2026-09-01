// One frozen style per building: dimensions vary between buildings, never within one.

import { Rng } from '../core/rng.ts';
import { RULES, TIER_WWR_SHIFT, BALCONY, PARAPET, STRUCTURE } from '../rules/tables.ts';
import { quant } from '../core/polygon.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Style } from './model.ts';

export function buildStyle(seed: string, family: Family, tier: Tier, floors: number): Style {
  const rng = new Rng(seed, 'style');
  const r = RULES[family];

  const floorHeight = quant(rng.range(...r.floorHeight));
  const groundFloorHeight = quant(floorHeight * rng.range(...r.groundFloorFactor));

  const wwrSpan = r.windowToWall[1] - r.windowToWall[0];
  const wwrMid = r.windowToWall[0] + wwrSpan / 2;
  const wwr = Math.min(r.windowToWall[1], Math.max(r.windowToWall[0], wwrMid + TIER_WWR_SHIFT[tier] * wwrSpan / 2));

  const curtainWall = r.curtainWall && (tier === 'rich' || tier === 'high_rich' || rng.chance(0.5));

  // Concrete shows fat perimeter columns; steel or curtain wall reads thin (docs/RESEARCH.md structure rules).
  const concrete = floors <= STRUCTURE.concreteMaxFloors && !curtainWall;
  const columnWidth = quant(concrete ? rng.range(...r.columnWidth) : r.columnWidth[0] * 0.8);

  const depthRange = BALCONY.depth[tier];
  const balconyDepth = quant(Math.min(rng.range(...depthRange), BALCONY.maxCantilever));

  return {
    floorHeight,
    groundFloorHeight,
    windowWidth: quant(rng.range(...r.windowWidth)),
    windowHeight: quant(rng.range(...r.windowHeight)),
    sill: quant(rng.range(...r.sill)),
    bayModule: quant(rng.range(...r.bayModule)),
    wwr,
    curtainWall,
    columnSpacing: quant(rng.range(...r.columnGrid)),
    columnWidth,
    showColumns: concrete,
    balconyDepth,
    balconyWidth: quant(rng.range(2.4, 4.0)),
    juliet: tier === 'poor',
    parapetHeight: quant(rng.range(...PARAPET)),
  };
}
