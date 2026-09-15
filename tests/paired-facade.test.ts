import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { generate } from '../src/index.ts';
import type { BuildingRequest } from '../src/index.ts';
import { keys } from './support.ts';

it.each(['paired-rounded', 'paired-rectangular'] as const)('exports the %s facade and authored room nodes', async architecture => {
  const request: BuildingRequest = {
    seed: 'paired-reference', buildingId: 'reference', theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [42, 0], [42, 32], [0, 32]], accessPoint: [21, 0], maxHeight: 18 },
    building: { type: 'residential', tier: 'rich', floors: 4 },
    options: { architecture, glb: 'merged', balconies: 'off', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', fireEscape: 'off', signage: null },
  };
  const result = await generate(request, keys);
  const blueprint = result.blueprint, assembly = blueprint.assembly!;
  expect(assembly.extent).toEqual({ width: 41, depth: 31 });
  expect(assembly.corners.filter(c => c === 'rounded')).toHaveLength(architecture === 'paired-rounded' ? 1 : 0);
  for (const floor of assembly.floors) {
    const pairs = floor.sections.filter(s => s.technique === 'paired-glass' || s.technique === 'paired-solid');
    expect(pairs.every(s => s.width === 10)).toBe(true);
    for (const edge of new Set(pairs.map(s => s.edge))) {
      const row = pairs.filter(s => s.edge === edge);
      expect(row.map(s => s.technique)).toEqual(row.map((_, i) => i % 2 ? 'paired-solid' : 'paired-glass'));
    }
  }
  const document = await new NodeIO().readBinary(result.glb);
  const nodes = document.getRoot().listNodes();
  const nodeNames = new Set(nodes.map(n => n.getName()));
  expect(nodeNames.size).toBe(nodes.length);
  const scenery = blueprint.floors.flatMap(f => f.openings.filter(o => o.scenery));
  expect(new Set(scenery.map(o => o.scenery!.nodeId)).size).toBe(3);
  expect(scenery.every(opening => nodeNames.has(opening.scenery!.nodeId))).toBe(true);
  expect(blueprint.floors[0]!.openings.filter(o => o.kind === 'window').every(o => o.windowTreatment && !o.scenery)).toBe(true);
  expect(blueprint.facade.materialPlan.field.key).toBe('cyberpunk/paired-cladding/mid');
  expect(blueprint.materialVariants['cyberpunk/paired-frame/mid']).toBe('surface');
  const invalidAccessors = document.getRoot().listAccessors()
    .filter(accessor => !accessor.getArray()!.every(Number.isFinite))
    .map(accessor => accessor.getName());
  expect(invalidAccessors).toEqual([]);
  const repeated = await generate(request, keys);
  expect(repeated.blueprint).toEqual(blueprint);
  expect(repeated.glb.byteLength).toBe(result.glb.byteLength);
  expect(createHash('sha256').update(repeated.glb).digest('hex'))
    .toBe(createHash('sha256').update(result.glb).digest('hex'));
});
