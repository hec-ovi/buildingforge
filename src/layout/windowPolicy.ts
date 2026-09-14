import { GENERATION_POLICY } from '../rules/generationPolicy.ts';
import type { Style } from './model.ts';

/** Ordinary facades use broad glazing fields and one shared pier per bay. */
export function applyWindowPolicy(style: Style): void {
  const policy = GENERATION_POLICY.windows;
  style.bayModule = Math.max(style.bayModule, policy.minimumBayWidth);
  style.windowWidth = Math.max(style.windowWidth, policy.minimumBayWidth - policy.sharedPierWidth);
  style.windowFraction = Math.max(style.windowFraction, policy.targetHeightFraction);
  style.sill = Math.min(style.sill, policy.preferredSill);
  style.wwr = Math.max(style.wwr, policy.minimumWindowToWall);
  style.glazing.maxPaneWidth = Math.max(style.glazing.maxPaneWidth, policy.preferredPaneWidth);
  style.glazing.maxPaneHeight = Math.max(style.glazing.maxPaneHeight, policy.preferredPaneHeight);
  if (style.facade.kind === 'curtain-wall') style.facade.spandrelHeight = GENERATION_POLICY.clearHeightAllowance;
}
