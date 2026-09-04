import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8'));
const keys = { textures: { mode: 'keys' as const } };

it('builds fitted rounded plates with broad office rows and matching wall geometry', async () => {
  const request = { ...fixture('corpo-tower'), options: { shape: 'rounded-box', exteriorStyle: 'premium-office', balconies: 'off' } };
  const first = await generate(request, keys);
  const second = await generate(request, keys);
  expect(Buffer.from(second.glb).equals(Buffer.from(first.glb))).toBe(true);
  expect(second.blueprint).toEqual(first.blueprint);
  const doc = await new NodeIO().readBinary(first.glb);
  const ground = first.blueprint.floors.find((floor) => floor.index === 0)!;
  const outline = ground.outline;
  expect(outline.length).toBeGreaterThanOrEqual(36);
  const lengths = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  expect(lengths.filter((length) => length > 5)).toHaveLength(4);
  for (const [x, z] of outline) {
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(36);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(30);
  }
  for (let edge = 0; edge < outline.length; edge++) {
    const a = outline[edge]!;
    const b = outline[(edge + 1) % outline.length]!;
    const previous = outline[(edge + outline.length - 1) % outline.length]!;
    const incoming = [a[0] - previous[0], a[1] - previous[1]];
    const outgoing = [b[0] - a[0], b[1] - a[1]];
    const cosine = (incoming[0]! * outgoing[0]! + incoming[1]! * outgoing[1]!)
      / (Math.hypot(...incoming) * Math.hypot(...outgoing));
    expect(cosine).toBeGreaterThan(Math.cos(Math.PI / 15));
    const wall = doc.getRoot().listNodes().find((node) => node.getName() === `wall:0/${edge}`)!;
    for (const primitive of wall.getMesh()!.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')!;
      for (let index = 0; index < positions.getCount(); index++) {
        const [x, , z] = positions.getElement(index, [0, 0, 0]);
        const distance = Math.abs((x! - a[0]) * outgoing[1]! - (z! - a[1]) * outgoing[0]!) / lengths[edge]!;
        expect(distance).toBeLessThan(1e-4);
      }
    }
  }
  const entrance = ground.openings.find((opening) => opening.kind === 'door')!;
  expect(lengths[entrance.edge]).toBeGreaterThan(5);
  for (const floor of first.blueprint.floors.filter((floor) => floor.index > 0)) {
    expect(floor.outline).toEqual(outline);
    for (const edge of lengths.flatMap((length, index) => length > 5 ? [index] : [])) {
      const windows = floor.openings.filter((opening) => opening.edge === edge && opening.kind === 'window');
      expect(windows.reduce((sum, window) => sum + window.width, 0)).toBeGreaterThan(lengths[edge]! * 0.6);
      expect(windows.every((window) => window.curtain?.style === 'venetian-blind')).toBe(true);
    }
  }
});

it('keeps sharp selections and aperture-bound parcel faces exact', async () => {
  const sharp = await generate({ ...fixture('corpo-tower'), options: { shape: 'box' } }, keys);
  expect(sharp.blueprint.floors[0]!.outline).toHaveLength(4);
  const request = fixture('bridged-tower');
  const rounded = await generate({ ...request, options: { shape: 'rounded-box' } }, keys);
  expect(rounded.blueprint.floors[0]!.outline).toEqual(request.parcel.footprint);
  expect(rounded.blueprint.floors.flatMap((floor) => floor.openings).filter((opening) => opening.kind === 'aperture'))
    .toHaveLength(request.apertures.filter((aperture: { kind: string }) => aperture.kind !== 'wire-anchor').length);
});
