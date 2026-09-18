import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BANDS, KIT, PIECES } from './module.ts';
import { buildPieceMesh } from './piece.ts';
import { writePieceGlb } from './glb.ts';
import { KIT_FAMILIES, recipeFor } from './recipes/index.ts';
import { pieceFile, type KitCatalog, type KitFamily } from './catalog.ts';

/** Write one canonical catalog, serially and without reading a material catalog. */
export async function exportKit(out: string, families = KIT_FAMILIES, seed = 'kit'): Promise<KitCatalog> {
  const recipes = [...new Set(families)].sort().map(recipeFor);
  const catalog: KitCatalog = { seed, module: { ...KIT, bands: BANDS, pieces: PIECES }, families: [] };
  for (const recipe of recipes) {
    const family: KitFamily = {
      id: recipe.family, pieces: [],
      bands: {
        ground: { floor: 0, height: recipe.heights.ground },
        middle: { firstFloor: 1, lastFloor: 'floors-2', height: recipe.heights.middle },
        crown: { floor: 'floors-1', height: recipe.heights.crown },
      },
      fits: {
        bays: { minimum: 2, maximum: null, step: 1 },
        floors: { minimum: 2, maximum: null, step: 1 },
        atlasLots: [[16, 32], [24, 32], [24, 40], [40, 40], [40, 56], [56, 56]],
      },
    };
    await mkdir(join(out, family.id), { recursive: true });
    for (const band of BANDS) for (const piece of PIECES) {
      const built = buildPieceMesh({ family: family.id, band, piece, seed });
      const { glb } = await writePieceGlb(built.mb, built.manifest.id, 'cyberpunk', seed, { mode: 'keys', source: null });
      const record = pieceFile(built, glb.byteLength);
      await writeFile(join(out, record.file), glb);
      family.pieces.push(record);
    }
    catalog.families.push(family);
  }
  await writeFile(join(out, 'kit.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}
