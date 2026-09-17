// What a family hands the piece builder: its band heights, its material roles
// and one authoring call per piece.

import type { MeshBuilder, PartSink } from '../mesh/primitives.ts';
import type { Rng } from '../core/rng.ts';
import type { Cell } from './cell.ts';
import type { Band, PieceKind } from './module.ts';
import type { DoorRecord, SignAnchor } from './types.ts';

export interface PieceContext {
  readonly family: string;
  readonly band: Band;
  readonly piece: PieceKind;
  readonly builder: MeshBuilder;
  /** One run for a bay, two arms for a corner; a corner arm starts at the corner. */
  readonly runs: Cell[];
  /** Floor-to-floor height of the band, a crown's cap included. */
  readonly height: number;
  readonly rng: Rng;
  /** Final catalog slot for a family role. */
  material(role: string): string;
  part(name: string, options?: { parent?: string; pivot?: [number, number, number]; keepNode?: boolean }): PartSink;
  anchor(anchor: SignAnchor): void;
  door(door: DoorRecord): void;
}

export interface KitRecipe {
  family: string;
  /** Final catalog slots by role, normally the registered family's own map. */
  materials: Record<string, string>;
  /** Preferred floor-to-floor heights; a caller's height overrides them. */
  heights: { ground: number; middle: number; crown: number };
  /** Structural backing behind the family skin. */
  backing: number;
  /** Width of the pier the run boundary cuts in half. */
  jointPier: number;
  build(context: PieceContext): void;
}
