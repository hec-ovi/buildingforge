// CLI contract: request file in, GLB + blueprint files out, textured by default.

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cwd = new URL('..', import.meta.url).pathname;

function run(args: string[]): { out: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'exterior-'));
  const out = execFileSync(process.execPath, [
    '--experimental-strip-types', 'src/cli.ts',
    'fixtures/residential-mid.request.json', dir, ...args,
  ], { cwd, encoding: 'utf8' });
  return { out, dir };
}

/** The glTF JSON chunk of a GLB file. */
function glbJson(path: string): Record<string, any> {
  const glb = new Uint8Array(readFileSync(path));
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + view.getUint32(12, true))));
}

describe('cli', () => {
  it('writes <buildingId>.glb and <buildingId>.blueprint.json, textured against the materials box', () => {
    const { out, dir } = run([]);
    expect(existsSync(join(dir, 'p101.glb'))).toBe(true);
    const bp = JSON.parse(readFileSync(join(dir, 'p101.blueprint.json'), 'utf8'));
    expect(bp.buildingId).toBe('p101');
    expect(out).toContain('textures: external');
    for (const image of glbJson(join(dir, 'p101.glb')).images) {
      expect(image.uri).toContain('themes/cyberpunk/assets/');
    }
  });

  it('--keys-only leaves the material keys for the consumer to resolve', () => {
    const { out, dir } = run(['--keys-only']);
    expect(out).toContain('textures: keys');
    expect(glbJson(join(dir, 'p101.glb')).images).toBeUndefined();
  });
});
