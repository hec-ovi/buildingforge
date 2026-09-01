// Default materials source. On node it reads the materials box from disk; in a
// browser there is no filesystem, so the caller (the preview) supplies its own
// source and this returns null without ever loading the node module.

import type { MaterialSource } from './theme.ts';

export async function autoSource(theme: string, dir?: string): Promise<MaterialSource | null> {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  const { fileSource, defaultMaterialsDir } = await import('./fileSource.ts');
  return fileSource(theme, dir ?? defaultMaterialsDir());
}
