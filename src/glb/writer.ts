// GLB assembly with @gltf-transform/core. Materials are named by the canonical
// theme/kind/tier key and, unless the caller asks for keys only, resolved
// through the materials box into real maps.

import { Document, type Material } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRMeshQuantization, KHRTextureTransform,
} from '@gltf-transform/extensions';
import { createMaterials, type TextureMode, type TextureOptions } from '../materials/apply.ts';
import { NativeFinishes } from '../materials/native/NativeFinishes.ts';
import { splitMaterialSlot } from '../materials/slot.ts';
import { buildResolver } from '../materials/theme.ts';
import { selectMaterialVariant } from '../materials/variant.ts';
import { autoSource } from '../materials/autoSource.ts';
import { writeBinaryWithUris } from './pack.ts';
import { weld, quantizedNormals, UINT16_LIMIT } from './weld.ts';
import { groupByMaterial, keptParts } from './measure.ts';
import type { MeshBuilder, Prim } from '../mesh/primitives.ts';
import type { Layout } from '../layout/model.ts';
import { buildingMaterialVariants } from '../layout/materialPlan.ts';

const EXTENSIONS = [KHRTextureTransform, KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsEmissiveStrength, KHRMeshQuantization];

export interface GlbOutput {
  glb: Uint8Array;
  textures: { mode: TextureMode; reason?: string };
}

export async function writeGlb(layout: Layout, mb: MeshBuilder, options: TextureOptions = {}): Promise<GlbOutput> {
  const doc = new Document();
  const buffer = doc.createBuffer('data');
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const scene = doc.createScene('scene');
  const root = doc.createNode(`building:${layout.request.buildingId}`);
  scene.addChild(root);

  const source = options.source !== undefined ? options.source : await autoSource(layout.theme, options.dir);
  const selected = buildingMaterialVariants(layout.theme, layout.tier, layout.request.options!.exteriorStyle!);
  const slots = mb.materialSlots();
  let native: NativeFinishes | undefined;
  if (source && options.mode !== 'keys' && (options.nativeFinishes ?? source.nativeFinishes)) {
    native = new NativeFinishes(layout.request.seed, layout.request.options!.exteriorStyle!);
    const resolve = buildResolver(source.index);
    const entries = slots.flatMap((slot) => {
      const [key, authored, finish] = splitMaterialSlot(slot);
      const sourceEntry = resolve(key);
      if (!sourceEntry) return [];
      const variant = selectMaterialVariant(sourceEntry, key, layout.request.seed, authored ?? selected[key]);
      const entry = native!.resolve(key, variant.id, finish);
      return entry ? [entry] : [];
    });
    await native.load(entries, options.nativeBaseUrl);
  }
  const plan = createMaterials(doc, slots, layout.theme, layout.request.seed, options, source, selected, native);
  const materialOf = (slot: string): Material => plan.bySlot.get(slot)!;

  const addPrim = (mesh: ReturnType<Document['createMesh']>, key: string, raw: Prim) => {
    const prim = weld(raw);
    const count = prim.positions.length / 3;
    const short = count < UINT16_LIMIT;
    const position = doc.createAccessor()
      .setType('VEC3').setArray(new Float32Array(prim.positions)).setBuffer(buffer);
    const normal = doc.createAccessor()
      .setType('VEC3').setArray(quantizedNormals(prim.normals)).setNormalized(true).setBuffer(buffer);
    const uv = doc.createAccessor()
      .setType('VEC2').setArray(new Float32Array(prim.uvs)).setBuffer(buffer);
    const indices = doc.createAccessor()
      .setType('SCALAR')
      .setArray(short ? new Uint16Array(prim.indices) : new Uint32Array(prim.indices))
      .setBuffer(buffer);
    mesh.addPrimitive(
      doc.createPrimitive()
        .setAttribute('POSITION', position)
        .setAttribute('NORMAL', normal)
        .setAttribute('TEXCOORD_0', uv)
        .setIndices(indices)
        .setMaterial(materialOf(key)),
    );
  };

  /** One node per part, parented as the mesher asked, pivots kept as translations. */
  const emitParts = (parts: typeof mb.parts) => {
    const nodes = new Map<string, ReturnType<Document['createNode']>>();
    const parents = new Set(parts.map((p) => p.parent).filter((n): n is string => !!n));
    for (const part of parts) {
      if (part.prims.size === 0 && !part.keepNode && !part.pivot && !parents.has(part.name)) continue;
      const node = doc.createNode(part.name);
      if (part.pivot) node.setTranslation([part.pivot[0], part.pivot[1], part.pivot[2]]);
      if (part.prims.size > 0) {
        const mesh = doc.createMesh(part.name);
        for (const [key, prim] of [...part.prims.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
          if (prim.indices.length === 0) continue;
          addPrim(mesh, key, prim);
        }
        if (mesh.listPrimitives().length > 0) node.setMesh(mesh);
      }
      nodes.set(part.name, node);
    }
    for (const part of parts) {
      const node = nodes.get(part.name);
      if (!node) continue;
      (part.parent ? nodes.get(part.parent) ?? root : root).addChild(node);
    }
  };

  if (layout.request.options?.glb === 'merged') {
    // Runtime mode: everything concatenated into one mesh per material slot,
    // except the parts a consumer addresses by node (swinging leaves, wire
    // anchors, the floor slabs the interior replaces), which keep their own.
    const kept = keptParts(mb);
    const byMaterial = groupByMaterial(mb.parts.filter((p) => !kept.has(p.name)));
    for (const key of [...byMaterial.keys()].sort()) {
      const mesh = doc.createMesh(`merged:${key}`);
      addPrim(mesh, key, byMaterial.get(key)!);
      root.addChild(doc.createNode(`merged:${key}`).setMesh(mesh));
    }
    emitParts(mb.parts.filter((p) => kept.has(p.name)).map((p) => ({ ...p, parent: undefined })));
  } else {
    emitParts(mb.parts);
  }

  // NodeIO touches node:fs; WebIO is the browser twin. Same serializer, same bytes.
  const mod = await import('@gltf-transform/core');
  const io = typeof process !== 'undefined' && process.versions?.node ? new mod.NodeIO() : new mod.WebIO();
  io.registerExtensions(EXTENSIONS);
  const glb = await writeBinaryWithUris(io, doc, plan.imageUris);
  return { glb, textures: { mode: plan.mode, ...(plan.reason ? { reason: plan.reason } : {}) } };
}
