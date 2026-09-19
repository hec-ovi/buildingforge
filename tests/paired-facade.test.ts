import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import type { BuildingRequest } from '../src/index.ts';
import { glbIO, keys } from './support.ts';

it('exports the paired rounded facade and its authored room nodes', async () => {
  const architecture = 'paired-rounded' as const;
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
  const document = await glbIO().readBinary(result.glb);
  const nodes = document.getRoot().listNodes();
  const nodeNames = new Set(nodes.map(n => n.getName()));
  expect(nodeNames.size).toBe(nodes.length);
  const scenery = blueprint.floors.flatMap(f => f.openings.filter(o => o.scenery));
  expect(new Set(scenery.map(o => o.scenery!.nodeId)).size).toBe(3);
  expect(scenery.every(opening => nodeNames.has(opening.scenery!.nodeId))).toBe(true);
  expect(blueprint.floors[0]!.openings.filter(o => o.kind === 'window')).toEqual([]);
  expect(blueprint.floors[0]!.openings.filter(o => o.doorRole === 'main')).toHaveLength(1);
  expect(blueprint.facade.materialPlan.field.key).toBe('cyberpunk/paired-cladding-metal/mid');
  expect(blueprint.facade.groundMaterial!.key).toBe('cyberpunk/paired-cladding/mid');
  expect(blueprint.materials).toContain('cyberpunk/paired-blind/mid');
  expect(blueprint.materialVariants['cyberpunk/paired-blind/mid']).toBe('blades');
  // A covered pane is one fitted panel, not a slat stack: four vertices per
  // covered pane plus the raised stack, never thousands.
  const blindPrimitive = nodes.find(n => n.getName() === 'scenery:1')!.getMesh()!.listPrimitives()
    .find(p => p.getMaterial()!.getName() === 'cyberpunk/paired-blind/mid')!;
  expect(blindPrimitive.getMaterial()!.getExtras().materialVariant).toBe('blades');
  const floor = blueprint.floors[1]!;
  const panes = floor.openings.filter(o => o.kind === 'window' && o.glazing).length * 4;
  const blindVertices = blindPrimitive.getAttribute('POSITION')!.getCount();
  expect(blindVertices).toBeGreaterThan(0);
  expect(blindVertices).toBeLessThanOrEqual(panes * 28);
  const emitting = scenery.filter(o => o.scenery!.lights?.length);
  expect(emitting.length).toBeGreaterThan(0);
  for (const opening of emitting) {
    const room = opening.scenery!;
    expect(room.depth).toBe(1);
    expect(room.lights!.length).toBeGreaterThan(0);
    for (const light of room.lights!) {
      expect(light.lumens).toBe(room.state === 'dark' ? 0 : (room.lightLayout === 'strips' ? 2400 : 1200) * (room.state === 'dim' ? 0.15 : 1));
      expect(light.range).toBe(12);
      expect(light.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(light.position.every(Number.isFinite)).toBe(true);
    }
  }
  expect(blueprint.materialVariants['cyberpunk/paired-frame/mid']).toBe('surface');
  const invalidAccessors = document.getRoot().listAccessors()
    .filter(accessor => !accessor.getArray()!.every(Number.isFinite))
    .map(accessor => accessor.getName());
  expect(invalidAccessors).toEqual([]);
});
