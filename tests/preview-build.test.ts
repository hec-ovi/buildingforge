// Preview contract: the browser entry's initial module graph contains no
// server-only filesystem adapter.

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

let output: string | undefined;

afterEach(() => {
  if (output) rmSync(output, { recursive: true, force: true });
  output = undefined;
});

describe('preview browser entry', () => {
  it('builds an initial module graph without the Node filesystem adapter', async () => {
    output = mkdtempSync(join(tmpdir(), 'urbe-exterior-preview-'));
    await build({
      configFile: resolve('vite.config.ts'),
      logLevel: 'silent',
      build: { outDir: output, emptyOutDir: true, manifest: true },
    });

    const manifest = JSON.parse(readFileSync(join(output, '.vite/manifest.json'), 'utf8')) as Record<
      string,
      { file: string; imports?: string[]; isEntry?: boolean }
    >;
    const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry);
    expect(entryKey).toBeTruthy();

    const pending = [entryKey as string];
    const seen = new Set<string>();
    let initialSource = '';
    while (pending.length > 0) {
      const key = pending.pop() as string;
      if (seen.has(key)) continue;
      seen.add(key);
      const chunk = manifest[key];
      expect(chunk).toBeTruthy();
      expect(chunk!.file).not.toContain('__vite-browser-external');
      initialSource += readFileSync(join(output, chunk!.file), 'utf8');
      pending.push(...(chunk!.imports ?? []));
    }
    expect(initialSource).not.toContain('readFileSync');
  });
});
