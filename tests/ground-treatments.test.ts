import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

const source = JSON.parse(readFileSync(new URL('../fixtures/residential-mid.request.json', import.meta.url), 'utf8'));
const keys = { textures: { mode: 'keys' as const } };

it('keeps a sparse paired ground facade and separate removable privacy in both GLB modes', async () => {
  for (const mode of ['named', 'merged']) {
    const { blueprint, glb } = await generate({ ...source, options: { ...source.options, glb: mode } }, keys);
    const doc = await new NodeIO().readBinary(glb);
    const ground = blueprint.floors.find((floor) => floor.index === 0)!;
    const windows = ground.openings.filter((opening) => opening.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    expect(ground.openings.filter((opening) => opening.doorRole === 'main')).toHaveLength(1);
    for (let edge = 0; edge < ground.outline.length; edge++) {
      const selected = windows.filter((opening) => opening.edge === edge);
      expect(selected.length).toBeLessThanOrEqual(4);
      if (selected.length < 2) continue;
      const a = ground.outline[edge]!, b = ground.outline[(edge + 1) % ground.outline.length]!;
      const entrance = ground.openings.find((opening) => opening.edge === edge && opening.doorRole === 'main');
      const center = entrance ? entrance.offset + entrance.width / 2 : Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
      for (const opening of selected) expect(selected.some((other) =>
        Math.abs((opening.offset + opening.width / 2 + other.offset + other.width / 2) / 2 - center) < 0.001)).toBe(true);
    }
    for (const opening of windows) {
      expect(opening.windowTreatment).toEqual({ privacy: 'shell-only', nodeId: `ground-privacy:${opening.id}` });
      const node = doc.getRoot().listNodes().find((node) => node.getName() === opening.windowTreatment!.nodeId)!;
      expect(node.getMesh()!.listPrimitives().length).toBeGreaterThan(0);
    }
    expect(blueprint.floors.filter((floor) => floor.index > 0).flatMap((floor) => floor.openings)
      .every((opening) => opening.windowTreatment === undefined)).toBe(true);
    if (mode === 'named') for (const node of doc.getRoot().listNodes().filter((node) => node.getName() === 'facade-ribs')) {
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const position = primitive.getAttribute('POSITION')!;
        for (let index = 0; index < position.getCount(); index++) expect(position.getElement(index, [0, 0, 0])[1])
          .toBeGreaterThanOrEqual(ground.height - 0.0001);
      }
    }
  }
});

it('places industrial metal slats outside the glass without moving the authored curtain', async () => {
  const { blueprint, glb } = await generate({ ...source, building: { type: 'police', tier: 'mid', floors: 3 }, options: { exteriorStyle: 'civic-institutional' } }, keys);
  const doc = await new NodeIO().readBinary(glb);
  let checked = 0;
  for (const floor of blueprint.floors) for (const opening of floor.openings.filter((opening) => opening.kind === 'window')) {
    expect(opening.exteriorCovering).toMatchObject({ style: 'metal-louvre', placement: 'exterior' });
    const node = doc.getRoot().listNodes().find((node) => node.getName() === `window:${opening.id}`)!;
    const louvre = node.getMesh()!.listPrimitives().find((primitive) => primitive.getMaterial()!.getName().includes('/exterior-louvre/'))!;
    expect(louvre.getMaterial()!.getExtras().materialVariant).toBe('metal');
    const a = floor.outline[opening.edge]!, b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const position = louvre.getAttribute('POSITION')!;
    for (let index = 0; index < position.getCount(); index++) {
      const [x, , z] = position.getElement(index, [0, 0, 0]);
      const depth = ((x! - a[0]) * (b[1] - a[1]) - (z! - a[1]) * (b[0] - a[0])) / length;
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(opening.exteriorCovering!.standoff + opening.exteriorCovering!.depth + 0.0001);
    }
    checked++;
  }
  expect(checked).toBeGreaterThan(4);
});

it('fits grime decals to solid walls with clamped UVs and separate material slots', async () => {
  const { blueprint, glb } = await generate({ ...source, building: { type: 'residential', tier: 'poor', floors: 4 } }, keys);
  const doc = await new NodeIO().readBinary(glb);
  const mesh = doc.getRoot().listNodes().find((node) => node.getName() === 'window-weathering')!.getMesh()!;
  expect(mesh.listPrimitives().length).toBe(2);
  for (const primitive of mesh.listPrimitives()) {
    expect(primitive.getMaterial()!.getName()).toMatch(/\/window-grime-(sill|jamb)\//);
    const uv = primitive.getAttribute('TEXCOORD_0')!.getArray()!;
    expect(Math.min(...uv)).toBeGreaterThanOrEqual(-1e-6);
    expect(Math.max(...uv)).toBeLessThanOrEqual(1 + 1e-6);
    const positions = primitive.getAttribute('POSITION')!;
    const indices = primitive.getIndices()!.getArray()!;
    for (let index = 0; index < indices.length; index += 3) {
      const points = [0, 1, 2].map((offset) => positions.getElement(indices[index + offset]!, [0, 0, 0]));
      const [x, y, z] = [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis]!, 0) / 3);
      const floor = blueprint.floors.find((floor) => y! >= floor.elevation - 1e-5 && y! < floor.elevation + floor.height + 1e-5)!;
      expect(floor).toBeDefined();
      for (const opening of floor.openings) {
        const a = floor.outline[opening.edge]!, b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const depth = ((x! - a[0]) * (b[1] - a[1]) - (z! - a[1]) * (b[0] - a[0])) / length;
        if (Math.abs(depth - 0.002) > 1e-4) continue;
        const u = ((x! - a[0]) * (b[0] - a[0]) + (z! - a[1]) * (b[1] - a[1])) / length;
        expect(u > opening.offset && u < opening.offset + opening.width
          && y! > floor.elevation + opening.sill && y! < floor.elevation + opening.sill + opening.height).toBe(false);
      }
    }
  }
});
