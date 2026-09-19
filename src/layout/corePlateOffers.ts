import { coreAdjacency } from './coreAdjacency.ts';
import type { BuildingRequest, CoreAdjacency } from '../types.ts';

/**
 * Plates one request may be built on, in order. Interior fits the smallest core
 * the plate it receives can hold, down to a single stair, so a plate that holds
 * none is offered again: first with the whole lot, where the balcony setback
 * goes to the plate, then with the core's glazing reservation narrowed to half
 * and to nothing. A lot too small for any of them keeps the closed refusal.
 */
export function corePlateOffers(request: BuildingRequest): BuildingRequest[] {
  const offers = [request];
  const widest = request.options?.balconies === 'off'
    ? request
    : { ...request, options: { ...request.options, balconies: 'off' as const } };
  if (widest !== request) offers.push(widest);
  // An explicit reservation belongs to the caller; only the published default narrows.
  if (request.options?.coreAdjacency) return offers;
  const policy = coreAdjacency(request);
  for (const share of [0.5, 0]) {
    offers.push({ ...widest, options: { ...widest.options, coreAdjacency: narrow(policy, share) } });
  }
  return offers;
}

/** The same reservation scaled: zero lets the core stand against the glazing. */
function narrow(policy: CoreAdjacency, share: number): CoreAdjacency {
  return { glazing: { ...policy.glazing, clearDepth: Math.round(policy.glazing.clearDepth * share * 10) / 10 } };
}
