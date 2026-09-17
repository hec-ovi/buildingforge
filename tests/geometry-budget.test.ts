import { expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { generate } from '../src/index.ts';
import { fixture, keys } from './support.ts';

const FIXTURES = readdirSync(new URL('../fixtures', import.meta.url))
  .filter(name => name.endsWith('.request.json')).map(name => name.replace('.request.json', ''));

it.each(FIXTURES)('exports %s inside its published budget at full detail', async name => {
  const { blueprint } = await generate(fixture(name), keys);
  const report = blueprint.geometry!;
  expect(report.triangles).toBeGreaterThan(0);
  expect(report.triangles).toBeLessThanOrEqual(report.budget.triangles);
  // Nothing authored costs enough to make the shell shed repeat detail.
  expect(report.simplified).toBeUndefined();
});

it('gives an ordinary shell the published ordinary allowance', async () => {
  const { blueprint } = await generate(fixture('residential-mid'), keys);
  expect(blueprint.geometry!.budget).toEqual({ triangles: 50_000, bytes: 3 * 1024 * 1024 });
});

it('raises the allowance for a tall tower and again for an authored family', async () => {
  const request = fixture('corpo-tower');
  request.building.floors = 14;
  request.parcel.footprint = [[0, 0], [40, 0], [40, 36], [0, 36]];
  request.parcel.accessPoint = [20, -2];
  const tower = await generate(request, keys);
  expect(tower.blueprint.geometry!.budget.triangles).toBe(150_000);
  const authored = await generate({ ...request, options: { ...request.options, architecture: 'corporate-sectors' } }, keys);
  expect(authored.blueprint.assembly!.architecture).toBe('corporate-sectors');
  expect(authored.blueprint.geometry!.budget.triangles).toBe(2 * tower.blueprint.geometry!.budget.triangles);
});

it('keeps the chosen family whatever the shell costs', async () => {
  // A long dense hotel block: the budget may take repeat detail, never the recipe.
  const request = fixture('residential-mid');
  request.building = { ...request.building, type: 'hotel', floors: 8 };
  request.parcel = { footprint: [[0, 0], [150, 0], [150, 24], [0, 24]], accessPoint: [75, -2], maxHeight: 60 };
  request.options = { ...request.options, architecture: 'auto' };
  const { blueprint } = await generate(request, keys);
  expect(blueprint.architectureSelection!.selected).toBe(blueprint.assembly?.architecture ?? 'ordinary');
  expect(blueprint.architectureSelection!.candidateError).toBeUndefined();
  expect(blueprint.geometry!.triangles).toBeLessThanOrEqual(blueprint.geometry!.budget.triangles);
  expect(blueprint.floors.every(floor => floor.openings.length > 0)).toBe(true);
});
