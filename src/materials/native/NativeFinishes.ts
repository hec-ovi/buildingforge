import catalog from '../../../public/native-materials/themes/cyberpunk/theme.json' with { type: 'json' };
import bindings from '../../../assets/native/bindings.json' with { type: 'json' };
import { ExteriorError } from '../../core/errors.ts';
import { MAP_SLOTS } from '../maps.ts';
import type { MaterialEntry, ThemeIndex } from '../theme.ts';

const entries = (catalog as unknown as ThemeIndex).entries;
const surfaces: Record<string, string> = bindings.surfaces;

/** Selects bundled surface images while retaining the consumer's canonical keys. */
export class NativeFinishes {
  private readonly bytes = new Map<string, Uint8Array>();

  resolve(key: string, variant?: string, finish?: string): MaterialEntry | undefined {
    const [theme, kind] = key.split('/');
    if (theme !== catalog.theme) return undefined;
    const id = finish ?? surfaces[`${kind}#${variant}`] ?? surfaces[kind!];
    if (!id) return undefined;
    const entry = entries[`${theme}/exterior-${id}/mid`];
    if (!entry) throw new ExteriorError('E_MATERIAL_UNRESOLVED', `native finish ${id} is absent`, { key, finish: id });
    return entry;
  }

  async load(selected: Iterable<MaterialEntry>, baseUrl?: string): Promise<void> {
    const paths = new Set<string>();
    for (const entry of selected) for (const slot of MAP_SLOTS) {
      const path = entry.variants[0]!.maps[slot];
      if (path) paths.add(path);
    }
    const node = typeof process !== 'undefined' && !!process.versions?.node;
    const read = node ? (await import('./fileMaps.ts')).readNativeMap : undefined;
    const results = await Promise.allSettled([...paths].map(async (path) => {
      try {
        let bytes: Uint8Array;
        if (read) bytes = await read(catalog.theme, path);
        else {
          const root = baseUrl ?? new URL('native-materials/', document.baseURI).href;
          const response = await fetch(`${root}themes/${catalog.theme}/${path}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          bytes = new Uint8Array(await response.arrayBuffer());
        }
        this.bytes.set(path, bytes);
      } catch (cause) {
        throw new ExteriorError('E_MATERIAL_UNRESOLVED', `native finish map ${path} is unreadable`, { path, cause: String(cause) });
      }
    }));
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }

  readMap(path: string): Uint8Array | null {
    return this.bytes.get(path) ?? null;
  }
}
