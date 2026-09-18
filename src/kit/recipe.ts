// What a family hands the piece builder: its band heights, its material roles
// and one authoring call per piece.

import type { PartSink } from '../mesh/primitives.ts';
import type { Cell } from './cell.ts';
import type { Band, PieceKind } from './module.ts';
import type { PieceOpening, SignAnchor } from './types.ts';

export interface PieceContext {
  readonly family: string;
  readonly band: Band;
  readonly piece: PieceKind;
  /** One run for a bay, two arms for a corner; a corner arm starts at the corner. */
  readonly runs: Cell[];
  /** Floor-to-floor height of the band, a crown's cap included. */
  readonly height: number;
  /** Final catalog slot for a family role. */
  material(role: string): string;
  part(name: string, options?: { parent?: string; pivot?: [number, number, number]; keepNode?: boolean }): PartSink;
  anchor(anchor: SignAnchor): void;
  opening(opening: Omit<PieceOpening, 'id'> & { id?: string }): void;
}

export interface KitRecipe {
  family: string;
  /** Final catalog slots by role, normally the registered family's own map. */
  materials: Record<string, string>;
  /** Preferred floor-to-floor heights; a caller's height overrides them. */
  heights: { ground: number; middle: number; crown: number };
  /** Shell thickness: the plane the inner lining sits on. */
  backing: number;
  build(context: PieceContext): void;
}
