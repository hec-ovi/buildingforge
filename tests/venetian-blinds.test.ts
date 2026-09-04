import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

it('fits office slats behind glass with exact open overrides and a clear fully raised field', async () => {
  const request = JSON.parse(readFileSync(new URL('../fixtures/bridged-tower.request.json', import.meta.url), 'utf8'));
  const options = { textures: { mode: 'keys' as const } };
  const first = await generate(request, options);
  const targets = first.blueprint.floors.flatMap((floor) => floor.openings)
    .filter((opening) => opening.kind === 'window').slice(0, 3);
  request.options = { curtains: { overrides: targets.map((opening, index) => ({
    openingId: opening.id, openPercent: [30, 100, 0][index],
  })) } };
  const { blueprint, glb } = await generate(request, options);
  const document = await new NodeIO().readBinary(glb);
  const nodes = new Map(document.getRoot().listNodes().map((node) => [node.getName(), node]));
  for (const [index, target] of targets.entries()) {
    const floor = blueprint.floors.find((floor) => floor.openings.some((opening) => opening.id === target.id))!;
    const opening = floor.openings.find((opening) => opening.id === target.id)!;
    const closure = [70, 0, 100][index]!;
    expect(opening.curtain).toEqual({ style: 'venetian-blind', closurePercent: closure });
    const primitives = nodes.get(`window:${target.id}`)!.getMesh()!.listPrimitives();
    const slats = primitives.find((primitive) => primitive.getMaterial()!.getName().includes('/curtain/'));
    if (closure === 0) { expect(slats).toBeUndefined(); continue; }
    expect(slats).toBeDefined();
    const glass = primitives.find((primitive) => primitive.getMaterial()!.getName().includes('/window-glass/'))!;
    const a = floor.outline[opening.edge]!;
    const b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const normal = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
    const points = (primitive: typeof glass) => {
      const position = primitive.getAttribute('POSITION')!;
      return Array.from({ length: position.getCount() }, (_, index) => position.getElement(index, []));
    };
    const pane = points(glass), covering = points(slats!);
    const depths = (values: number[][]) => values.map(([x, , z]) => (x! - a[0]) * normal[0]! + (z! - a[1]) * normal[1]!);
    const top = Math.max(...pane.map((point) => point[1]!));
    const bottom = Math.min(...pane.map((point) => point[1]!));
    const travelBottom = top - (top - bottom) * closure / 100;
    expect(Math.max(...covering.map((point) => point[1]!))).toBeCloseTo(top, 4);
    expect(Math.min(...covering.map((point) => point[1]!))).toBeGreaterThanOrEqual(travelBottom - 0.0001);
    expect(Math.min(...covering.map((point) => point[1]!))).toBeLessThan(travelBottom + 0.009);
    expect(Math.max(...depths(covering))).toBeLessThan(Math.min(...depths(pane)) - 0.02);
    // Every slat is a closed six-face solid with a horizontal long axis.
    expect(covering.length % 24).toBe(0);
    expect(slats!.getIndices()!.getCount()).toBe(covering.length / 24 * 36);
    for (let start = 0; start < covering.length; start += 24) {
      const slat = covering.slice(start, start + 24);
      const slatHeight = Math.max(...slat.map((point) => point[1]!)) - Math.min(...slat.map((point) => point[1]!));
      expect(slatHeight).toBeLessThanOrEqual(0.0571);
      expect(Math.max(...depths(slat)) - Math.min(...depths(slat))).toBeGreaterThan(0.001);
    }
  }
});
