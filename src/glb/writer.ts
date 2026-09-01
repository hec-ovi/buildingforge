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
    const uv = doc.createAccessor()
      .setType('VEC2').setArray(new Float32Array(prim.uvs)).setBuffer(buffer);
    const indices = doc.createAccessor()
      .setType('SCALAR').setArray(new Uint32Array(prim.indices)).setBuffer(buffer);
    mesh.addPrimitive(
      doc.createPrimitive()
        .setAttribute('POSITION', position)
        .setAttribute('TEXCOORD_0', uv)
        .setIndices(indices)
        .setMaterial(materialOf(key)),
    );
  };

  if (layout.request.options?.glb === 'merged') {
    // Runtime mode: everything concatenated into one mesh per material key.
    const byMaterial = new Map<string, Prim>();
    for (const part of mb.parts) {
      for (const [key, prim] of part.prims) {
        if (prim.indices.length === 0) continue;
        let g = byMaterial.get(key);
        if (!g) { g = { positions: [], uvs: [], indices: [] }; byMaterial.set(key, g); }
        const base = g.positions.length / 3;
        g.positions.push(...prim.positions);
        g.uvs.push(...prim.uvs);
        for (const i of prim.indices) g.indices.push(base + i);
      }
    }
    for (const key of [...byMaterial.keys()].sort()) {
      const mesh = doc.createMesh(`merged:${key}`);
      addPrim(mesh, key, byMaterial.get(key)!);
      root.addChild(doc.createNode(`merged:${key}`).setMesh(mesh));
    }
  } else {
    for (const part of mb.parts) {
      if (part.prims.size === 0) continue;
      const mesh = doc.createMesh(part.name);
      for (const [key, prim] of [...part.prims.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (prim.indices.length === 0) continue;
        addPrim(mesh, key, prim);
      }
      root.addChild(doc.createNode(part.name).setMesh(mesh));
    }
  }

  // Wire anchors: empty named nodes at the attach points.
  for (const a of layout.anchors) {
    root.addChild(doc.createNode(`anchor:${a.id}`).setTranslation([a.position[0], a.position[1], a.position[2]]));
  }

  // NodeIO touches node:fs; WebIO is the browser twin. Same serializer, same bytes.
  const mod = await import('@gltf-transform/core');
  const io = typeof process !== 'undefined' && process.versions?.node ? new mod.NodeIO() : new mod.WebIO();
  io.registerExtensions(EXTENSIONS);
  const glb = await writeBinaryWithUris(io, doc, plan.imageUris);
  return { glb, textures: { mode: plan.mode, ...(plan.reason ? { reason: plan.reason } : {}) } };
}
