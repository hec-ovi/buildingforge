import type { Opening } from '../types.ts';

/** Opaque pocket skins reserve space even where they hide the moving leaf. */
export function openingEnvelope(opening: Opening): { offset: number; sill: number; width: number; height: number } {
  return opening.door?.cassette ?? opening;
}
