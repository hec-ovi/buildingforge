// GLB assembly with @gltf-transform/core. Materials carry no textures, only
// the canonical theme/kind/tier name the materials index resolves.

import { Document } from '@gltf-transform/core';
import type { MeshBuilder } from '../mesh/primitives.ts';
import type { Layout } from '../layout/model.ts';

export async function writeGlb(layout: Layout, mb: MeshBuilder): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer('data');
  const scene = doc.createScene('scene');
  const root = doc.createNode(`building:${layout.request.buildingId}`);
  scene.addChild(root);

  const materials = new Map<string, ReturnType<Document['createMaterial']>>();
  const materialOf = (key: string) => {
    let m = materials.get(key);
    if (!m) {
      m = doc.createMaterial(key).setDoubleSided(false).setMetallicFactor(0).setRoughnessFactor(1);
      materials.set(key, m);
    }
    return m;
  };

  for (const part of mb.parts) {
    if (part.prims.size === 0) continue;
    const mesh = doc.createMesh(part.name);
    for (const [key, prim] of [...part.prims.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (prim.indices.length === 0) continue;
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
    }
    const node = doc.createNode(part.name).setMesh(mesh);
    root.addChild(node);
  }

  // Wire anchors: empty named nodes at the attach points.
  for (const a of layout.anchors) {
    root.addChild(doc.createNode(`anchor:${a.id}`).setTranslation([a.position[0], a.position[1], a.position[2]]));
  }

  // NodeIO touches node:fs; WebIO is the browser twin. Same serializer, same bytes.
  const mod = await import('@gltf-transform/core');
  const io = typeof process !== 'undefined' && process.versions?.node ? new mod.NodeIO() : new mod.WebIO();
  return io.writeBinary(doc);
}
