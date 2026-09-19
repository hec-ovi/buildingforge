import { mapSurfaceUvs } from '../mesh/surfaceUvs.ts';
import type { MeshBuilder, Prim } from '../mesh/primitives.ts';
import { buildResolver, type MaterialSource } from './theme.ts';
import { exactMaterialSlot, materialSlot, splitMaterialSlot } from './slot.ts';
import { selectMaterialVariant } from './variant.ts';

/** Bind names and UV conventions before welding, budgeting and serialization. */
export class MeshBindings {
  private readonly resolve: ReturnType<typeof buildResolver>;
  private readonly seed: string;
  private readonly selected: Record<string, string>;

  constructor(source: MaterialSource, seed: string, selected: Record<string, string> = {}) {
    this.resolve = buildResolver(source.index);
    this.seed = seed;
    this.selected = selected;
  }

  apply(builder: MeshBuilder): void {
    for (const part of builder.parts) {
      const bound = new Map<string, Prim>();
      for (const [slot, raw] of part.prims) {
        const [key, authored, finish, mapping] = splitMaterialSlot(slot);
        const entry = this.resolve(key);
        if (!entry) { bound.set(slot, raw); continue; }
        const variant = selectMaterialVariant(entry, key, this.seed, authored ?? this.selected[key]);
        const named = materialSlot(key, variant.id, finish);
        const target = mapping ? exactMaterialSlot(named) : named;
        const primitive = mapSurfaceUvs(raw, mapping ?? entry.alignment);
        const previous = bound.get(target);
        if (!previous) bound.set(target, primitive);
        else {
          const offset = previous.positions.length / 3;
          const first = previous.indices.length;
          for (const value of primitive.positions) previous.positions.push(value);
          for (const value of primitive.normals) previous.normals.push(value);
          for (const value of primitive.uvs) previous.uvs.push(value);
          for (const index of primitive.indices) previous.indices.push(offset + index);
          for (const face of primitive.faces!) previous.faces!.push({ first: first + face.first, count: face.count });
        }
      }
      part.prims = bound;
    }
  }
}
