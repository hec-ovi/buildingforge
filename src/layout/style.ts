// One frozen style per building: dimensions vary between buildings, never within one.

import { Rng } from '../core/rng.ts';
import { RULES, TIER_WWR_SHIFT, BALCONY, FACADE, FACADE_STYLE, GLAZING, PARAPET, STRUCTURE } from '../rules/tables.ts';
import { PROPORTIONS, proportionsOf } from '../rules/proportions.ts';
import { quant } from '../core/polygon.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Style } from './model.ts';

export function buildStyle(seed: string, family: Family, tier: Tier, floors: number): Style {
  const rng = new Rng(seed, 'style');
  const r = RULES[family];
  const p = proportionsOf(family);

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
    windowWidth: quant(rng.range(...p.windowWidth)),
    windowFraction: rng.range(...p.windowHeight),
    sill: quant(rng.range(...p.sill)),
    storefrontFraction: rng.range(...PROPORTIONS.storefront.windowHeight),
    storefrontSill: quant(rng.range(...PROPORTIONS.storefront.sill)),
    entrancePick: rng.next(),
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
    facade: buildFacade(seed, tier),
    glazing: buildGlazing(seed, tier),
  };
}

/** One facade style per building, its relief drawn once so every face agrees. */
function buildFacade(seed: string, tier: Tier): Style['facade'] {
  const kind = FACADE_STYLE[tier];
  const s = FACADE.styles[kind];
  const rng = new Rng(seed, 'facade');
  return {
    kind,
    panelModule: FACADE.panelModule,
    ribWidth: quant(rng.range(...s.ribWidth)),
    ribDepth: quant(rng.range(...s.ribDepth)),
    bandHeight: quant(rng.range(...s.bandHeight)),
    bandProud: quant(rng.range(...s.bandProud)),
    windowRecess: quant(rng.range(...s.windowRecess)),
    utilityChance: s.utilityChance,
  };
}

/** Profile sections and pane limits, one draw per building so a facade stays consistent. */
function buildGlazing(seed: string, tier: Tier): Style['glazing'] {
  const rng = new Rng(seed, 'glazing');
  const round = (v: number) => Math.round(v * 200) / 200; // 5 mm grid: profiles are small
  return {
    frameWidth: round(rng.range(...GLAZING.frameWidth)),
    frameProud: round(rng.range(...GLAZING.frameProud)),
    mullionWidth: round(rng.range(...GLAZING.mullionWidth)),
    glassInset: round(rng.range(...GLAZING.glassInset)),
    maxPaneWidth: GLAZING.maxPaneWidth[tier],
    maxPaneHeight: GLAZING.maxPaneHeight[tier],
  };
}
