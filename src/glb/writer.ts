// GLB assembly with @gltf-transform/core. Materials are named by the canonical
// theme/kind/tier key and, unless the caller asks for keys only, resolved
// through the materials box into real maps.

import { Document, type Material } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRTextureTransform,
} from '@gltf-transform/extensions';
import { createMaterials, type TextureMode, type TextureOptions } from '../materials/apply.ts';
import { autoSource } from '../materials/autoSource.ts';
import { writeBinaryWithUris } from './pack.ts';
import type { MeshBuilder, Prim } from '../mesh/primitives.ts';
import type { Layout } from '../layout/model.ts';

const EXTENSIONS = [KHRTextureTransform, KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsEmissiveStrength];

export interface GlbOutput {
  glb: Uint8Array;
  textures: { mode: TextureMode; reason?: string };
}

export async function writeGlb(layout: Layout, mb: MeshBuilder, options: TextureOptions = {}): Promise<GlbOutput> {
  const doc = new Document();
  const buffer = doc.createBuffer('data');
  const scene = doc.createScene('scene');
  const root = doc.createNode(`building:${layout.request.buildingId}`);
  scene.addChild(root);

  const source = options.source !== undefined ? options.source : await autoSource(layout.theme, options.dir);
  const plan = createMaterials(doc, mb.materialKeys(), layout.theme, layout.request.seed, options, source);
  const materialOf = (key: string): Material => plan.byKey.get(key)!;

  const addPrim = (mesh: ReturnType<Document['createMesh']>, key: string, prim: Prim) => {
    const position = doc.createAccessor()
      .setType('VEC3').setArray(new Float32Array(prim.positions)).setBuffer(buffer);
    const normal = doc.createAccessor()
      .setType('VEC3').setArray(new Float32Array(prim.normals)).setBuffer(buffer);
    const uv = doc.createAccessor()
      .setType('VEC2').setArray(new Float32Array(prim.uvs)).setBuffer(buffer);
    const indices = doc.createAccessor()
      .setType('SCALAR').setArray(new Uint32Array(prim.indices)).setBuffer(buffer);
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
      if (part.prims.size === 0 && !parents.has(part.name)) continue;
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
    // Runtime mode: everything concatenated into one mesh per material key,
    // except the parts the game animates, which keep their own nodes.
    const animated = new Set<string>();
    for (const part of mb.parts) if (part.pivot) animated.add(part.name);
    for (const part of mb.parts) if (part.parent && animated.has(part.parent)) animated.add(part.name);

    const byMaterial = new Map<string, Prim>();
    for (const part of mb.parts) {
      if (animated.has(part.name)) continue;
      for (const [key, prim] of part.prims) {
        if (prim.indices.length === 0) continue;
        let g = byMaterial.get(key);
        if (!g) { g = { positions: [], normals: [], uvs: [], indices: [] }; byMaterial.set(key, g); }
        const base = g.positions.length / 3;
        g.positions.push(...prim.positions);
        g.normals.push(...prim.normals);
        g.uvs.push(...prim.uvs);
        for (const i of prim.indices) g.indices.push(base + i);
      }
    }
    for (const key of [...byMaterial.keys()].sort()) {
      const mesh = doc.createMesh(`merged:${key}`);
      addPrim(mesh, key, byMaterial.get(key)!);
      root.addChild(doc.createNode(`merged:${key}`).setMesh(mesh));
    }
    emitParts(mb.parts.filter((p) => animated.has(p.name)).map((p) => ({ ...p, parent: undefined })));
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
