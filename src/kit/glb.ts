// GLB output for the piece path.
//
// A piece keeps one node per part, the way the named shell does. An assembled
// building keeps one mesh per distinct piece and one node per placement, so the
// bytes hold each piece once however many times the building repeats it.

import { Document, type Material, type Mesh } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRMeshQuantization, KHRTextureTransform,
} from '@gltf-transform/extensions';
import { createMaterials, type TextureMode, type TextureOptions } from '../materials/apply.ts';
import { autoSource } from '../materials/autoSource.ts';
import { writeBinaryWithUris } from './../glb/pack.ts';
import { quantizedNormals, weld, UINT16_LIMIT } from '../glb/weld.ts';
import { groupByMaterial, keptParts } from '../glb/measure.ts';
import type { MeshBuilder, Prim } from '../mesh/primitives.ts';
import type { Placement } from './types.ts';

const EXTENSIONS = [KHRTextureTransform, KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsEmissiveStrength, KHRMeshQuantization];

export interface KitGlb { glb: Uint8Array; textures: { mode: TextureMode; reason?: string } }

interface Writer {
  doc: Document;
  addPrim(mesh: Mesh, slot: string, prim: Prim): void;
  materialOf(slot: string): Material;
}

async function open(name: string, slots: string[], theme: string, seed: string, options: TextureOptions): Promise<{ writer: Writer; root: ReturnType<Document['createNode']>; mode: TextureMode; reason?: string; finish(): Promise<Uint8Array> }> {
  const doc = new Document();
  const buffer = doc.createBuffer('data');
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const scene = doc.createScene('scene');
  const root = doc.createNode(name);
  scene.addChild(root);
  const source = options.source !== undefined ? options.source : await autoSource(theme, options.dir);
  const plan = createMaterials(doc, slots, theme, seed, options, source);
  const writer: Writer = {
    doc,
    materialOf: (slot) => plan.bySlot.get(slot)!,
    addPrim(mesh, slot, raw) {
      const prim = weld(raw);
      const count = prim.positions.length / 3;
      mesh.addPrimitive(doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(prim.positions)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(quantizedNormals(prim.normals)).setNormalized(true).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(prim.uvs)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR')
          .setArray(count < UINT16_LIMIT ? new Uint16Array(prim.indices) : new Uint32Array(prim.indices)).setBuffer(buffer))
        .setMaterial(plan.bySlot.get(slot)!));
    },
  };
  return {
    writer, root, mode: plan.mode, ...(plan.reason ? { reason: plan.reason } : {}),
    async finish() {
      const mod = await import('@gltf-transform/core');
      const io = typeof process !== 'undefined' && process.versions?.node ? new mod.NodeIO() : new mod.WebIO();
      io.registerExtensions(EXTENSIONS);
      return writeBinaryWithUris(io, doc, plan.imageUris);
    },
  };
}

/** One node per part, pivots kept as translations, parents as the recipe asked. */
function emitParts(writer: Writer, root: ReturnType<Document['createNode']>, mb: MeshBuilder): void {
  const nodes = new Map<string, ReturnType<Document['createNode']>>();
  const parents = new Set(mb.parts.map(p => p.parent).filter((n): n is string => !!n));
  for (const part of mb.parts) {
    if (part.prims.size === 0 && !parents.has(part.name)) continue;
    const node = writer.doc.createNode(part.name);
    if (part.pivot) node.setTranslation([part.pivot[0], part.pivot[1], part.pivot[2]]);
    if (part.prims.size > 0) {
      const mesh = writer.doc.createMesh(part.name);
      for (const [slot, prim] of [...part.prims.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (prim.indices.length > 0) writer.addPrim(mesh, slot, prim);
      }
      if (mesh.listPrimitives().length > 0) node.setMesh(mesh);
    }
    nodes.set(part.name, node);
  }
  for (const part of mb.parts) {
    const node = nodes.get(part.name);
    if (node) (part.parent ? nodes.get(part.parent) ?? root : root).addChild(node);
  }
}

export async function writePieceGlb(mb: MeshBuilder, id: string, theme: string, seed: string, options: TextureOptions = {}): Promise<KitGlb> {
  const session = await open(`piece:${id}`, mb.materialSlots(), theme, seed, options);
  emitParts(session.writer, session.root, mb);
  return { glb: await session.finish(), textures: { mode: session.mode, ...(session.reason ? { reason: session.reason } : {}) } };
}

export interface AssemblyGlbInput {
  name: string;
  theme: string;
  seed: string;
  /** Distinct pieces by manifest id; each becomes one mesh drawn by every instance. */
  kinds: Map<string, MeshBuilder>;
  placements: Placement[];
  /** Per-building parts: floor slabs, the entrance, wire anchors. */
  building: MeshBuilder;
}

export async function writeAssemblyGlb(input: AssemblyGlbInput, options: TextureOptions = {}): Promise<KitGlb> {
  const slots = new Set(input.building.materialSlots());
  for (const mb of input.kinds.values()) for (const slot of mb.materialSlots()) slots.add(slot);
  const session = await open(input.name, [...slots].sort(), input.theme, input.seed, options);
  const meshes = new Map<string, Mesh>();
  for (const [id, mb] of [...input.kinds.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const mesh = session.writer.doc.createMesh(`piece:${id}`);
    const byMaterial = groupByMaterial(mb.parts.filter(p => !keptParts(mb).has(p.name)));
    for (const slot of [...byMaterial.keys()].sort()) session.writer.addPrim(mesh, slot, byMaterial.get(slot)!);
    meshes.set(id, mesh);
  }
  for (const [index, placement] of input.placements.entries()) {
    const mesh = meshes.get(placement.piece);
    if (!mesh || mesh.listPrimitives().length === 0) continue;
    const half = placement.rotation / 2;
    session.root.addChild(session.writer.doc.createNode(`place:${index}:${placement.piece}`)
      .setTranslation(placement.position)
      .setRotation([0, Math.sin(half), 0, Math.cos(half)])
      .setMesh(mesh));
  }
  emitParts(session.writer, session.root, input.building);
  return { glb: await session.finish(), textures: { mode: session.mode, ...(session.reason ? { reason: session.reason } : {}) } };
}
