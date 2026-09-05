import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate, type BuildingGrid, type BuildingRequest } from '../src/index.ts';

type P2 = BuildingRequest['parcel']['footprint'][number];

const keys = { textures: { mode: 'keys' as const } };
const grid: BuildingGrid = { origin: [103.37, -41.19], angle: 0.37, spacing: 0.5 };
const point = ([u, v]: P2): P2 => [grid.origin[0] + u * Math.cos(grid.angle) - v * Math.sin(grid.angle),
  grid.origin[1] + u * Math.sin(grid.angle) + v * Math.cos(grid.angle)];
const local = ([x, z]: P2): P2 => [(x - grid.origin[0]) * Math.cos(grid.angle) + (z - grid.origin[1]) * Math.sin(grid.angle),
  (z - grid.origin[1]) * Math.cos(grid.angle) - (x - grid.origin[0]) * Math.sin(grid.angle)];
const request: BuildingRequest = {
  seed: 'grid:whole-plates', buildingId: 'grid-plates', theme: 'cyberpunk',
  parcel: { footprint: ([[2.5, 3], [54, 3], [54, 44.5], [2.5, 44.5]] as P2[]).map(point),
    accessPoint: point([25, 0]), maxHeight: 80, buildingGrid: grid },
  building: { type: 'corpo', tier: 'high_rich', floors: 12, basements: 2 },
  options: { exteriorStyle: 'premium-mineral', balconies: 'off', roofArtifacts: 'off', facadeServices: 'off', signage: null },
};

it('preserves a translated rotated construction phase through complete plates, setbacks and GLB slabs', async () => {
  for (const shape of ['box', 'setback', 'pyramid'] as const) {
    const { blueprint, glb } = await generate({ ...request, options: { ...request.options, shape } }, keys);
    const doc = await new NodeIO().readBinary(glb);
    const rings = new Set<string>();
    for (const floor of blueprint.floors) {
      expect(floor.outline).toHaveLength(4);
      const uv = floor.outline.map(local);
      for (const p of uv) for (const value of p) {
        expect(value / grid.spacing).toBeCloseTo(Math.round(value / grid.spacing), 8);
      }
      expect(uv[0]![1]).toBeCloseTo(uv[1]![1], 8);
      expect(uv[1]![0]).toBeCloseTo(uv[2]![0], 8);
      expect(uv[2]![1]).toBeCloseTo(uv[3]![1], 8);
      expect(uv[3]![0]).toBeCloseTo(uv[0]![0], 8);
      rings.add(JSON.stringify(floor.outline));
      const slab = doc.getRoot().listNodes().find((node) => node.getName() === `floor:${floor.index}/slab`)!.getMesh()!;
      for (const primitive of slab.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!;
        for (let index = 0; index < positions.getCount(); index++) {
          const [x, y, z] = positions.getElement(index, [0, 0, 0]);
          expect(y).toBeCloseTo(floor.elevation, 4);
          expect(Math.min(...floor.outline.map((p) => Math.hypot(p[0] - x!, p[1] - z!)))).toBeLessThan(0.0001);
        }
      }
    }
    if (shape === 'box') expect(rings.size).toBe(1);
    else expect(rings.size).toBeGreaterThan(1);
    const first = blueprint.floors.find((floor) => floor.index === 0)!;
    first.outline.forEach((p, index) => p.forEach((value, axis) => expect(value).toBeCloseTo(request.parcel.footprint[index]![axis]!, 8)));
    const axis = blueprint.roof.bulkhead?.axis;
    expect(axis).toBeDefined();
    const alignment = Math.abs(axis![0] * Math.cos(grid.angle) + axis![1] * Math.sin(grid.angle));
    expect(Math.min(alignment, Math.abs(alignment - 1))).toBeLessThan(1e-8);
  }
});

it('defaults and auto produce the same deterministic rectangular shell and retain fitted panel borders', async () => {
  const omitted = await generate(request, keys);
  const automatic = await generate({ ...request, options: { ...request.options, shape: 'auto' } }, keys);
  const repeated = await generate(request, keys);
  expect(automatic.blueprint).toEqual(omitted.blueprint);
  expect(Buffer.from(automatic.glb).equals(Buffer.from(omitted.glb))).toBe(true);
  expect(Buffer.from(repeated.glb).equals(Buffer.from(omitted.glb))).toBe(true);
  expect(repeated.blueprint).toEqual(omitted.blueprint);
  for (const face of omitted.blueprint.facade.grids) {
    expect(face.horizontalBorders[0]).toBe(face.horizontalBorders[1]);
    expect((face.length - face.horizontalBorders[0] - face.horizontalBorders[1]) / face.panelWidth)
      .toBeCloseTo(Math.floor(face.length / face.panelWidth + 1e-9), 3);
  }
});

it('keeps aperture-bound source vertices and planes exact despite an incompatible construction phase', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/bridged-tower.request.json', import.meta.url), 'utf8'));
  fixture.parcel.buildingGrid = grid;
  const { blueprint } = await generate(fixture, keys);
  for (const floor of blueprint.floors) expect(floor.outline).toEqual(fixture.parcel.footprint);
  for (const aperture of fixture.apertures.filter((a: { kind: string }) => a.kind !== 'wire-anchor')) {
    const opening = blueprint.floors.flatMap((floor) => floor.openings).find((o) => o.id === aperture.id)!;
    expect(opening.edge).toBe(aperture.face);
  }
});

it('retains explicitly selected octagonal and cylindrical forms inside grid-aligned bounds', async () => {
  for (const [shape, vertices] of [['octagon', 8], ['cylinder', 16]] as const) {
    const { blueprint } = await generate({ ...request, options: { ...request.options, shape } }, keys);
    for (const floor of blueprint.floors) {
      expect(floor.outline).toHaveLength(vertices);
      const points = floor.outline.map(local);
      for (const component of [0, 1]) {
        for (const bound of [Math.min(...points.map((p) => p[component]!)), Math.max(...points.map((p) => p[component]!))]) {
          expect(bound / grid.spacing).toBeCloseTo(Math.round(bound / grid.spacing), 8);
        }
      }
    }
  }
});

it('validates every construction-grid field and rejects a phase with no permitted core rectangle', async () => {
  for (const patch of [{ origin: [0] }, { angle: Number.NaN }, { spacing: 0 }, { unknown: true }]) {
    await expect(generate({ ...request, parcel: { ...request.parcel, buildingGrid: { ...grid, ...patch } } }, keys))
      .rejects.toMatchObject({ code: 'E_SCHEMA' });
  }
  await expect(generate({ ...request, parcel: { ...request.parcel, buildingGrid: { ...grid, spacing: 100 } } }, keys))
    .rejects.toMatchObject({ code: 'E_CORE_PLATE' });
});

it('reserves projecting balcony space only for a facade that emits balcony bands', async () => {
  const base = { ...request, building: { ...request.building, type: 'residential', tier: 'mid', floors: 4, basements: 0 } };
  const off = await generate({ ...base, options: { ...request.options, exteriorStyle: 'residential-modest', balconies: 'off' } }, keys);
  const hidden = await generate({ ...base, options: { ...request.options, exteriorStyle: 'residential-modest', balconies: 'on', windows: 'none' } }, keys);
  expect(off.blueprint.balconyBands).toHaveLength(0);
  expect(hidden.blueprint.balconyBands).toHaveLength(0);
  expect(hidden.blueprint.bounds.footprint).toEqual(off.blueprint.bounds.footprint);
  const on = await generate({ ...base, options: { ...request.options, exteriorStyle: 'residential-modest', balconies: 'on' } }, keys);
  expect(on.blueprint.balconyBands.some((band) => band.depth > 0)).toBe(true);
  expect(on.blueprint.bounds.footprint).not.toEqual(off.blueprint.bounds.footprint);
});
