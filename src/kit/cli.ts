import { parseArgs } from 'node:util';
import { exportKit } from './export.ts';
import { KIT_FAMILIES, recipeFor } from './recipes/index.ts';

const usage = 'usage: npm run kit -- --out <dir> [--families <a,b,...>] [--seed <seed>]';
let args: { out: string; families: string[]; seed: string };
try {
  const { values } = parseArgs({ options: {
    out: { type: 'string' }, families: { type: 'string' }, seed: { type: 'string' },
  } });
  if (!values.out?.trim()) throw new Error('--out is required');
  const families = values.families === undefined ? KIT_FAMILIES : values.families.split(',').map(id => id.trim());
  for (const family of families) recipeFor(family);
  args = { out: values.out, families, seed: values.seed ?? 'kit' };
} catch (error) {
  console.error(`${error instanceof Error ? error.message : error}\n${usage}`);
  process.exit(2);
}

try {
  const catalog = await exportKit(args.out, args.families, args.seed);
  console.log(`kit.json: ${catalog.families.length} families, ${catalog.families.length * 9} pieces, seed ${catalog.seed}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
