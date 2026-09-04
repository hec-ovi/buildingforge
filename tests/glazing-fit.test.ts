import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';

it('publishes the authored clear glass rectangle and enclosed back depth for punched and curtain-wall windows', async () => {
  const source = JSON.parse(readFileSync(new URL('../fixtures/corpo-tower.request.json', import.meta.url), 'utf8'));
  for (const exteriorStyle of ['premium-office', 'premium-mineral']) {
    const { blueprint, glb } = await generate({ ...source, building: { ...source.building, floors: 4 },
      options: { exteriorStyle, shape: 'box', balconies: 'off' } }, { textures: { mode: 'keys' } });
    const doc = await new NodeIO().readBinary(glb);
    let checked = 0;
    for (const floor of blueprint.floors) for (const opening of floor.openings.filter((opening) => opening.kind === 'window')) {
      const fit = opening.glazing!;
      expect(fit).toBeDefined();
      const primitives = doc.getRoot().listNodes().find((node) => node.getName() === `window:${opening.id}`)!.getMesh()!.listPrimitives();
      const a = floor.outline[opening.edge]!, b = floor.outline[(opening.edge + 1) % floor.outline.length]!;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      const points = (kind: string) => primitives.filter((primitive) => primitive.getMaterial()!.getName().includes(kind)).flatMap((primitive) => {
        const position = primitive.getAttribute('POSITION')!;
        return Array.from({ length: position.getCount() }, (_, index) => {
          const p = position.getElement(index, [0, 0, 0]);
          return [(p[0]! - a[0]) * dx + (p[2]! - a[1]) * dz, p[1]! - floor.elevation,
            (p[2]! - a[1]) * dx - (p[0]! - a[0]) * dz];
        });
      });
      const glass = points('/window-glass');
      const xs = glass.map((p) => p[0]!), ys = glass.map((p) => p[1]!);
      expect(Math.min(...xs)).toBeCloseTo(fit.offset, 4);
      expect(Math.max(...xs)).toBeCloseTo(fit.offset + fit.width, 4);
      expect(Math.min(...ys)).toBeCloseTo(fit.sill, 4);
      expect(Math.max(...ys)).toBeCloseTo(fit.sill + fit.height, 4);
      for (const p of glass) expect(p[2]).toBeCloseTo(fit.glassDepth, 4);
      expect(Math.max(...points('/window-frame/').map((p) => p[2]!))).toBeCloseTo(fit.housingBackDepth, 4);
      checked++;
    }
    expect(checked).toBeGreaterThan(4);
  }
});
