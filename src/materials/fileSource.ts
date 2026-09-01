// Node materials source: the materials box as a directory on disk.
// vite.config.ts swaps this module for browserSource.ts in the preview bundle.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaterialSource, ThemeIndex } from './theme.ts';

/** URBE_MATERIALS_DIR, else the sibling materials box next to this repo. */
export function defaultMaterialsDir(): string {
  const fromEnv = typeof process !== 'undefined' ? process.env?.URBE_MATERIALS_DIR : undefined;
  if (fromEnv) return fromEnv;
  return new URL('../../../materials/', import.meta.url).pathname;
}

/** Null when the theme index is absent: callers degrade to key-only materials. */
export function fileSource(theme: string, dir: string = defaultMaterialsDir()): MaterialSource | null {
  const themeDir = join(dir, 'themes', theme);
  const indexPath = join(themeDir, 'theme.json');
  if (!existsSync(indexPath)) return null;
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as ThemeIndex;
  return {
    index,
    readMap(path) {
      const full = join(themeDir, path);
      return existsSync(full) ? new Uint8Array(readFileSync(full)) : null;
    },
  };
}
