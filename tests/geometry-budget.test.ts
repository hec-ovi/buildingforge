import { expect, it } from 'vitest';
import { ExteriorError, generate } from '../src/index.ts';
import { fixture, keys } from './support.ts';

it('reports the welded shell geometry against its published budget', async () => {
  const request = fixture('residential-mid');
  const { blueprint } = await generate(request, keys);
  const report = blueprint.geometry!;
  expect(report.budget).toEqual({ triangles: 50_000, bytes: 3 * 1024 * 1024 });
  expect(report.triangles).toBeGreaterThan(0);
  expect(report.triangles).toBeLessThanOrEqual(report.budget.triangles);
});

it('raises the allowance for a tall corporate tower', async () => {
  const request = fixture('corpo-tower');
  request.building.floors = 14;
  const { blueprint } = await generate(request, keys);
  expect(blueprint.geometry!.budget).toEqual({ triangles: 150_000, bytes: 9 * 1024 * 1024 });
});

it('refuses to export a shell over budget', async () => {
  // A block long enough that its opening rows cannot fit the ordinary allowance.
  const request = fixture('residential-mid');
  request.parcel.footprint = [[0, 0], [220, 0], [220, 30], [0, 30]];
  request.parcel.accessPoint = [110, -2];
  request.building.floors = 8;
  request.parcel.maxHeight = 60;
  const error = await generate(request, keys).catch((e: unknown) => e) as ExteriorError;
  expect(error).toBeInstanceOf(ExteriorError);
  expect(error.code).toBe('E_GEOMETRY_BUDGET');
  expect(error.details).toMatchObject({ budget: { triangles: 50_000 } });
  expect(error.details!.triangles as number).toBeGreaterThan(50_000);
});
