import { Rng } from '../core/rng.ts';
import type { BuildingRequest, ExteriorStyleId } from '../types.ts';
import type { Family, Tier } from '../rules/families.ts';
import type { Style } from './model.ts';

export const EXTERIOR_STYLE_IDS: ExteriorStyleId[] = [
  'residential-salvaged', 'residential-weathered', 'residential-modest',
  'premium-obsidian', 'premium-office', 'premium-mineral',
  'civic-utility', 'civic-institutional', 'civic-industrial',
];

interface Policy {
  facade: Style['facade']['kind'];
  shape?: 'rounded-box' | 'box';
  covering: 'venetian-blind' | 'roller-shade';
}

export const EXTERIOR_STYLES: Record<ExteriorStyleId, Policy> = {
  'residential-salvaged': { facade: 'megablock', covering: 'roller-shade' },
  'residential-weathered': { facade: 'panel', covering: 'roller-shade' },
  'residential-modest': { facade: 'panel', covering: 'venetian-blind' },
  'premium-obsidian': { facade: 'curtain-wall', shape: 'box', covering: 'roller-shade' },
  'premium-office': { facade: 'curtain-wall', covering: 'venetian-blind' },
  'premium-mineral': { facade: 'panel', shape: 'rounded-box', covering: 'venetian-blind' },
  'civic-utility': { facade: 'panel', shape: 'box', covering: 'venetian-blind' },
  'civic-institutional': { facade: 'panel', shape: 'box', covering: 'venetian-blind' },
  'civic-industrial': { facade: 'megablock', shape: 'box', covering: 'venetian-blind' },
};

export function selectExteriorStyle(request: BuildingRequest, family: Family, tier: Tier): ExteriorStyleId {
  if (request.options?.exteriorStyle) return request.options.exteriorStyle;
  const rng = new Rng(request.seed, 'exterior-style');
  if (family === 'industrial') return rng.pick(['civic-utility', 'civic-industrial']);
  if (family === 'hospital' || family === 'security') return rng.pick(['civic-utility', 'civic-institutional']);
  if (family === 'office' || family === 'corpo' || tier === 'rich' || tier === 'high_rich') {
    return rng.pick(['premium-obsidian', 'premium-office', 'premium-mineral']);
  }
  if (tier === 'poor') return 'residential-salvaged';
  return rng.pick(['residential-weathered', 'residential-modest']);
}
