// CLI: npm run generate -- <request.json> <outDir> [--embed | --keys-only]
//                          [--materials DIR] [--materials-base URI]
// Writes <buildingId>.glb and <buildingId>.blueprint.json. The GLB is textured
// against the materials box by default, with map URIs relative to <outDir>.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { generate } from './generator.ts';
import { defaultMaterialsDir } from './materials/fileSource.ts';
import { ExteriorError } from './core/errors.ts';
import type { TextureMode } from './materials/apply.ts';

interface Args {
  requestPath: string;
  outDir: string;
  mode: TextureMode;
  materialsDir: string;
  baseUrl?: string;
}

function parseArgs(argv: string[]): Args | null {
  const positional: string[] = [];
  let mode: TextureMode = 'external';
  let materialsDir = defaultMaterialsDir();
  let baseUrl: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--embed') mode = 'embed';
    else if (arg === '--keys-only') mode = 'keys';
    else if (arg === '--materials') materialsDir = argv[++i] as string;
    else if (arg === '--materials-base') baseUrl = argv[++i] as string;
    else if (arg.startsWith('--')) return null;
    else positional.push(arg);
  }
  const [requestPath, outDir] = positional;
  if (!requestPath || !outDir || !materialsDir) return null;
  return { requestPath, outDir, mode, materialsDir, baseUrl };
}

/** Default external URIs point from the output directory at the materials box. */
function baseUrlFor(args: Args): string {
  if (args.baseUrl !== undefined) return args.baseUrl;
  const rel = relative(resolve(args.outDir), resolve(args.materialsDir));
  return rel === '' ? '' : `${rel}/`;
}

const args = parseArgs(process.argv.slice(2));
if (!args) {
  console.error('usage: npm run generate -- <request.json> <outDir> [--embed | --keys-only] [--materials DIR] [--materials-base URI]');
  process.exit(2);
}

try {
  const raw = JSON.parse(readFileSync(args.requestPath, 'utf8'));
  mkdirSync(args.outDir, { recursive: true });
  const { glb, blueprint, textures } = await generate(raw, {
    textures: { mode: args.mode, dir: args.materialsDir, baseUrl: baseUrlFor(args) },
  });
  const glbPath = join(args.outDir, `${blueprint.buildingId}.glb`);
  const bpPath = join(args.outDir, `${blueprint.buildingId}.blueprint.json`);
  writeFileSync(glbPath, glb);
  writeFileSync(bpPath, JSON.stringify(blueprint, null, 2));
  console.log(`${glbPath} (${glb.byteLength} bytes, textures: ${textures.mode}${textures.reason ? ` - ${textures.reason}` : ''})`);
  console.log(bpPath);
} catch (err) {
  if (err instanceof ExteriorError) {
    console.error(`${err.code}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
