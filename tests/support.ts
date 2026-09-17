import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import {
  KHRMaterialsEmissiveStrength, KHRMaterialsIOR, KHRMaterialsTransmission, KHRMeshQuantization, KHRTextureTransform,
} from '@gltf-transform/extensions';
import type { BuildingRequest } from '../src/index.ts';

/** A reader carrying the extensions the export uses, quantized normals included. */
export const glbIO = (): NodeIO => new NodeIO().registerExtensions(
  [KHRTextureTransform, KHRMaterialsTransmission, KHRMaterialsIOR, KHRMaterialsEmissiveStrength, KHRMeshQuantization]);

export const keys = { textures: { mode: 'keys' as const } };
export const fixture = (name: string): BuildingRequest => JSON.parse(readFileSync(
  new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));
/** Vertex normals as a loader reads them: the export stores them normalized. */
export function normalsOf(primitive: { getAttribute(name: string): { getCount(): number; getElement(index: number, target: number[]): number[] } | null }): number[][] {
  const accessor = primitive.getAttribute('NORMAL')!;
  return Array.from({ length: accessor.getCount() }, (_, index) => accessor.getElement(index, []));
}

export function glbJson(glb: Uint8Array): Record<string, any> {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + view.getUint32(12, true))));
}
