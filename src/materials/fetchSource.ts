// Browser materials source: the theme index over HTTP. Map bytes stay with the
// viewer (external mode writes URIs and the GLTF loader fetches them), so this
// source serves the index only.

import type { MaterialSource, ThemeIndex } from './theme.ts';

export async function fetchSource(theme: string, baseUrl: string): Promise<MaterialSource | null> {
  const response = await fetch(`${baseUrl}themes/${theme}/theme.json`);
  if (!response.ok) return null;
  const index = await response.json() as ThemeIndex;
  return { index, readMap: () => null };
}
