// CLI: npm run generate -- <request.json> <outDir>
// Writes <buildingId>.glb and <buildingId>.blueprint.json.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generator.ts';
import { ExteriorError } from './core/errors.ts';

const [requestPath, outDir] = process.argv.slice(2);
if (!requestPath || !outDir) {
  console.error('usage: npm run generate -- <request.json> <outDir>');
  process.exit(2);
}

try {
  const raw = JSON.parse(readFileSync(requestPath, 'utf8'));
  const { glb, blueprint } = await generate(raw);
  mkdirSync(outDir, { recursive: true });
  const glbPath = join(outDir, `${blueprint.buildingId}.glb`);
  const bpPath = join(outDir, `${blueprint.buildingId}.blueprint.json`);
  writeFileSync(glbPath, glb);
  writeFileSync(bpPath, JSON.stringify(blueprint, null, 2));
  console.log(`${glbPath} (${glb.byteLength} bytes)`);
  console.log(bpPath);
} catch (err) {
  if (err instanceof ExteriorError) {
    console.error(`${err.code}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
