// Consumer view of the materials box: the theme index shape it publishes
// (../materials/schema/material-entry.schema.json) plus key resolution.
// Pure: no filesystem, no network, so the browser preview shares this code.

export interface MaterialVariant {
  id: string;
  resolution: [number, number];
  maps: Partial<Record<'basecolor' | 'normal' | 'roughness' | 'metallic' | 'height' | 'ao' | 'emission', string>>;
}

export interface MaterialPhysical {
  breakable?: boolean;
  metallicFactor?: number;
  roughnessFactor?: number;
  transmission?: number;
  ior?: number;
  tint?: string;
  emissiveStrength?: number;
  alphaMode?: 'OPAQUE' | 'BLEND' | 'MASK';
}

export interface MaterialEntry {
  key: string;
  aliases?: string[];
  alignment: 'tile' | 'exact';
  tiling?: { worldSize: [number, number] };
  aspect?: [number, number];
  physical: MaterialPhysical;
  variants: MaterialVariant[];
}

export interface ThemeIndex {
  theme: string;
  entries: Record<string, MaterialEntry>;
}

/** Where map bytes and the index come from: a directory on disk, a fetch, a test double. */
export interface MaterialSource {
  index: ThemeIndex;
  /** Bytes of a map path (relative to the theme folder), or null when unreadable. */
  readMap(path: string): Uint8Array | null;
}

/** Key lookup including the aliases an entry declares. Built once per generation. */
export function buildResolver(index: ThemeIndex): (key: string) => MaterialEntry | null {
  const byKey = new Map<string, MaterialEntry>();
  for (const entry of Object.values(index.entries)) {
    byKey.set(entry.key, entry);
    for (const alias of entry.aliases ?? []) if (!byKey.has(alias)) byKey.set(alias, entry);
  }
  return (key) => byKey.get(key) ?? null;
}
