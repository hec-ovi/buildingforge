// CLI contract: request file in, GLB + blueprint files out.

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('cli', () => {
  it('writes <buildingId>.glb and <buildingId>.blueprint.json', () => {
    const out = mkdtempSync(join(tmpdir(), 'exterior-'));
    execFileSync(process.execPath, [
      '--experimental-strip-types', 'src/cli.ts',
      'fixtures/residential-mid.request.json', out,
    ], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
    expect(existsSync(join(out, 'p101.glb'))).toBe(true);
    const bp = JSON.parse(readFileSync(join(out, 'p101.blueprint.json'), 'utf8'));
    expect(bp.buildingId).toBe('p101');
  });
});
