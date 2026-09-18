import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { BANDS, KIT, KIT_FAMILIES, PIECES, pieceSet, planAssembly } from '../src/kit/index.ts';
import type { KitCatalog } from '../src/kit/catalog.ts';
import { glbIO, glbJson } from './support.ts';
import { validateKitSchemas } from './kit-schema.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'src/kit/cli.ts');
let work: string;
let catalog: KitCatalog;
const run = (out: string, ...args: string[]) => execFileSync(process.execPath, [cli, '--out', out, ...args], { cwd: root });
const readCatalog = (out: string): KitCatalog => JSON.parse(readFileSync(join(out, 'kit.json'), 'utf8'));

beforeAll(() => {
  mkdirSync(join(root, 'out'), { recursive: true });
  work = mkdtempSync(join(root, 'out/kit-contract-'));
  run(join(work, 'all'));
  catalog = readCatalog(join(work, 'all'));
});
afterAll(() => { if (work) rmSync(work, { recursive: true, force: true }); });

it('writes all nine original pieces per family, measured metadata and a valid catalog, with optional family selection', async () => {
  expect(catalog.module).toEqual({ ...KIT, bands: BANDS, pieces: PIECES });
  expect(catalog.families.map(f => f.id)).toEqual(KIT_FAMILIES);
  const io = glbIO();
  const cases: Parameters<typeof validateKitSchemas>[0] = [];
  for (const family of catalog.families) {
    const original = pieceSet(family.id, catalog.seed);
    expect(readdirSync(join(work, 'all', family.id))).toEqual(family.pieces.map(p => p.file.split('/')[1]!).sort());
    for (const record of family.pieces) {
      const source = original.find(p => p.id === record.id)!;
      expect(record).toMatchObject({ band: source.band, kind: source.piece, triangles: source.geometry.triangles,
        signAnchors: source.signAnchors, doors: source.doors, openings: source.openings });
      const path = join(work, 'all', record.file);
      const bytes = readFileSync(path);
      expect(record.bytes).toBe(statSync(path).size);
      const json = glbJson(bytes);
      expect(json.images ?? []).toHaveLength(0);
      expect(json.textures ?? []).toHaveLength(0);
      expect(json.materials.map((m: { name: string; extras?: { materialVariant?: string } }) =>
        m.name + (m.extras?.materialVariant ? `#${m.extras.materialVariant}` : '')).sort()).toEqual(source.materials);
      const doc = await io.readBinary(bytes);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      let triangles = 0;
      doc.getRoot().listScenes()[0]!.traverse(node => {
        const matrix = node.getWorldMatrix();
        for (const prim of node.getMesh()?.listPrimitives() ?? []) {
          triangles += prim.getIndices()!.getCount() / 3;
          const positions = prim.getAttribute('POSITION')!;
          for (let i = 0; i < positions.getCount(); i++) {
            const p = positions.getElement(i, []);
            for (let axis = 0; axis < 3; axis++) {
              const value = matrix[axis]! * p[0]! + matrix[axis + 4]! * p[1]! + matrix[axis + 8]! * p[2]! + matrix[axis + 12]!;
              min[axis] = Math.min(min[axis]!, value);
              max[axis] = Math.max(max[axis]!, value);
            }
          }
        }
      });
      expect(triangles).toBe(source.geometry.triangles);
      for (let axis = 0; axis < 3; axis++) expect(record.size[axis]).toBeCloseTo(max[axis]! - min[axis]!, 4);
    }
    const { bands, fits } = family;
    expect(fits.floors.minimum).toBe(2);
    for (const [width, depth] of fits.atlasLots) {
      const request = { family: family.id, buildingId: 'fit', lot: { width, depth }, floors: fits.floors.minimum };
      const plan = planAssembly(request);
      expect(plan.bands).toEqual([
        { band: 'ground', floor: 0, base: 0, height: bands.ground.height },
        { band: 'crown', floor: 1, base: bands.ground.height, height: bands.crown.height },
      ]);
      expect(plan.blueprint.floors).toHaveLength(2);
      for (const floor of plan.blueprint.floors) {
        const band = plan.bands[floor.index]!;
        expect(floor).toMatchObject({ elevation: band.base, height: band.height });
        const placements = plan.placements.filter(p => p.floor === floor.index);
        expect(placements.every(p => p.position[1] === band.base && p.piece.includes(`/${band.band}/`))).toBe(true);
        expect(floor.openings).toHaveLength(placements.reduce((count, p) => count
          + original.find(piece => piece.id === p.piece)!.openings.length, 0));
        for (const opening of floor.openings) {
          expect(opening.sill).toBeGreaterThanOrEqual(0);
          expect(opening.sill + opening.height).toBeLessThanOrEqual(floor.height);
        }
      }
      expect(plan.doors).toHaveLength(1);
      expect(plan.placements[plan.doors[0]!.placement]!.floor).toBe(0);
      expect(plan.blueprint.floors[0]!.openings.filter(o => o.kind === 'door').map(o => o.id))
        .toEqual(plan.doors.map(d => d.id));
      expect(plan.blueprint.roof.elevation).toBe(bands.ground.height + bands.crown.height);
      expect(plan.blueprint.bounds.height).toBe(plan.blueprint.roof.elevation);
      cases.push({ schema: 'kit-request', value: request }, { schema: 'placement', value: plan });
    }
  }
  const subset = join(work, 'subset');
  run(subset, '--families', 'white-grid,mirror-frame');
  const selected = readCatalog(subset);
  expect(selected.families.map(f => f.id)).toEqual(['mirror-frame', 'white-grid']);
  expect(readdirSync(subset).sort()).toEqual(['kit.json', 'mirror-frame', 'white-grid']);
  const invalid = structuredClone(catalog);
  invalid.families[0]!.pieces[0]!.file = '../outside.glb';
  validateKitSchemas([...cases, { schema: 'kit', value: catalog }, { schema: 'kit', value: selected }, { schema: 'kit', value: invalid, valid: false }]);
});

it('writes byte identical catalogs and every piece for the same seed regardless of family order or output directory', () => {
  const repeated = join(work, 'repeat');
  run(repeated, '--families', [...KIT_FAMILIES].reverse().concat(KIT_FAMILIES[0]!).join(','), '--seed', catalog.seed);
  for (const file of ['kit.json', ...catalog.families.flatMap(f => f.pieces.map(p => p.file))]) {
    expect(readFileSync(join(repeated, file)).equals(readFileSync(join(work, 'all', file))), file).toBe(true);
  }
});

it('reports invalid arguments before writing and reports filesystem errors', () => {
  const out = join(work, 'invalid');
  for (const args of [[], ['--out'], ['--out', out, '--unknown'], ['--out', out, '--families', 'mirror-frame,nowhere'], ['--out', out, '--families', '']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage: npm run kit');
  }
  expect(readdirSync(work)).not.toContain('invalid');
  writeFileSync(out, 'occupied');
  const result = spawnSync(process.execPath, [cli, '--out', out], { cwd: root, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/ENOTDIR|EEXIST/);
});
