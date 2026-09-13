import { readFileSync } from 'node:fs';
import type { BuildingRequest } from '../src/index.ts';

export const keys = { textures: { mode: 'keys' as const } };
export const fixture = (name: string): BuildingRequest => JSON.parse(readFileSync(
  new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));
export function glbJson(glb: Uint8Array): Record<string, any> {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + view.getUint32(12, true))));
}
