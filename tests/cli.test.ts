import { afterEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fixture, glbJson } from './support.ts';

const directories: string[] = [];
function temporary(): string {
  mkdirSync('out', { recursive: true });
  const dir = mkdtempSync(resolve('out/cli-'));
  directories.push(dir);
  return dir;
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

async function run(dir: string, args: string[]): Promise<{ code: number; log: string }> {
  const path = join(dir, 'cli.log'), descriptor = openSync(path, 'w');
  try {
    const child = spawn(process.execPath, ['--experimental-strip-types', 'src/cli.ts', ...args], {
      cwd: process.cwd(), stdio: ['ignore', descriptor, descriptor],
    });
    const [code] = await once(child, 'close');
    return { code, log: readFileSync(path, 'utf8') };
  } finally { closeSync(descriptor); }
}

it('writes the named output pair with the requested seed and external material base', async () => {
  const dir = temporary();
  const result = await run(dir, ['fixtures/residential-mid.request.json', dir, '--seed', 'example',
    '--materials', resolve('../materials'), '--materials-base', '/shared/']);
  expect(result).toMatchObject({ code: 0, log: expect.stringContaining('seed example') });
  expect(result.log).toContain('textures: external');
  expect(JSON.parse(readFileSync(join(dir, 'p101.blueprint.json'), 'utf8'))).toMatchObject({ buildingId: 'p101', seed: 'example' });
  const json = glbJson(new Uint8Array(readFileSync(join(dir, 'p101.glb'))));
  expect(json.images.some((image: any) => image.uri?.startsWith('/shared/themes/'))).toBe(true);
});

it('prints and saves an omitted seed while exporting material keys', async () => {
  const dir = temporary(), request = fixture('corpo-tower') as Partial<ReturnType<typeof fixture>>;
  delete request.seed;
  const input = join(dir, 'request.json');
  writeFileSync(input, JSON.stringify(request));
  const result = await run(dir, [input, dir, '--keys-only']);
  expect(result.code).toBe(0);
  const rolled = /seed ([0-9a-f]{12}) \(generated\)/.exec(result.log)?.[1];
  expect(rolled).toBeDefined();
  expect(JSON.parse(readFileSync(join(dir, `${request.buildingId}.blueprint.json`), 'utf8')).seed).toBe(rolled);
  expect(glbJson(new Uint8Array(readFileSync(join(dir, `${request.buildingId}.glb`)))).images).toBeUndefined();
});

it('reports usage and generation failures as distinct process exit codes', async () => {
  const dir = temporary();
  expect(await run(dir, [])).toMatchObject({ code: 2, log: expect.stringContaining('usage:') });
  const input = join(dir, 'request.json');
  writeFileSync(input, '{}');
  expect(await run(dir, [input, dir])).toMatchObject({ code: 1, log: expect.stringContaining('E_SCHEMA:') });
});
