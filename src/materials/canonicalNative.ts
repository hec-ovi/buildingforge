import { NativeFinishes } from './native/NativeFinishes.ts';
import { buildingMaterialVariants } from '../layout/materialPlan.ts';
import { materialSlot, splitMaterialSlot } from './slot.ts';
import type { MeshBuilder, Prim } from '../mesh/primitives.ts';
import type { Blueprint, BuildingRequest } from '../types.ts';

/** Portable native identities use the same source maps and alignment in every renderer. */
export class CanonicalNativeMaterials {
  private readonly native: NativeFinishes;
  private readonly selected: Record<string, string>;
  private readonly variants: Record<string, string> = {};

  constructor(request: BuildingRequest) {
    this.native = new NativeFinishes(request.seed, request.options!.exteriorStyle!);
    this.selected = buildingMaterialVariants(request.theme, request.building.tier, request.options!.exteriorStyle!);
  }

  apply(mesh: MeshBuilder): void {
    for (const part of mesh.parts) {
      const mapped = new Map<string, Prim>();
      for (const [slot, primitive] of part.prims) {
        const [key, variant, finish, mapping] = splitMaterialSlot(slot);
        const entry = this.native.resolve(key, variant ?? this.selected[key], finish);
        const publicKey = entry && (mapping === 'exact' ? entry.key.replace('/mid', '-exact/mid') : entry.key);
        const target = publicKey ? materialSlot(publicKey, entry!.variants[0]!.id, 'catalog') : slot;
        if (publicKey) this.variants[publicKey] = entry!.variants[0]!.id;
        const previous = mapped.get(target);
        if (!previous) mapped.set(target, primitive);
        else {
          const offset = previous.positions.length / 3;
          previous.positions = previous.positions.concat(primitive.positions);
          previous.normals = previous.normals.concat(primitive.normals);
          previous.uvs = previous.uvs.concat(primitive.uvs);
          previous.indices = previous.indices.concat(primitive.indices.map(i => i + offset));
        }
      }
      part.prims = mapped;
    }
  }

  blueprint(blueprint: Blueprint): void {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const object = value as Record<string, unknown>;
      if (typeof object.key === 'string' && typeof object.variantId === 'string') {
        const entry = this.native.resolve(object.key, object.variantId);
        if (entry) { object.key = entry.key; object.variantId = entry.variants[0]!.id; }
      }
      if (typeof object.material === 'string') {
        const entry = this.native.resolve(object.material, this.selected[object.material]);
        if (entry) object.material = entry.key;
      }
      Object.values(object).forEach(visit);
    };
    visit(blueprint);
    Object.assign(blueprint.materialVariants, this.variants);
  }
}
