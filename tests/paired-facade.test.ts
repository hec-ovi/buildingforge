import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { generate } from '../src/index.ts';
import type { BuildingRequest } from '../src/index.ts';
import { keys } from './support.ts';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

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
  expect(blueprint.floors[0]!.openings.filter(o => o.kind === 'window')).toEqual([]);
  expect(blueprint.floors[0]!.openings.filter(o => o.doorRole === 'main')).toHaveLength(1);
  expect(blueprint.facade.materialPlan.field.key).toBe('cyberpunk/paired-cladding-metal/mid');
  expect(blueprint.facade.groundMaterial!.key).toBe('cyberpunk/paired-cladding/mid');
  expect(blueprint.materials).toContain('cyberpunk/paired-blind/mid');
  const blindPrimitive = nodes.find(n => n.getName() === 'scenery:1')!.getMesh()!.listPrimitives()
    .find(p => p.getMaterial()!.getName() === 'cyberpunk/paired-blind/mid')!;
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(blindPrimitive.getAttribute('POSITION')!.getArray()!), 3));
  geometry.setIndex(Array.from(blindPrimitive.getIndices()!.getArray()!));
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  const floor = blueprint.floors[1]!;
  let perforationProved = false;
  for (const opening of floor.openings.filter(o => o.kind === 'window' && o.edge === 0)) {
    const g = opening.glazing!, paneWidth = g.width / 4;
    const y = floor.elevation + g.sill + g.height - 0.14 - 0.095 + 0.046;
    const hit = (u: number) => new Raycaster(new Vector3(floor.outline[0]![0] + u, y, floor.outline[0]![1] - 0.5), new Vector3(0, 0, 1), 0, 1)
      .intersectObject(mesh, false).length > 0;
    for (let pane = 0; pane < 4; pane++) {
      const support = g.offset + paneWidth * pane + 0.025 + (paneWidth - 0.05) * 0.18;
      if (hit(support - 0.07) && !hit(support - 0.025)) perforationProved = true;
    }
  }
  expect(perforationProved).toBe(true);
  geometry.dispose(); material.dispose();
  const emitting = scenery.filter(o => o.scenery!.lights?.length);
  expect(emitting.length).toBeGreaterThan(0);
  for (const opening of emitting) {
    const room = opening.scenery!;
    expect(room.lights).toHaveLength(room.lightLayout === 'strips' ? 4 : 8);
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
  const repeated = await generate(request, keys);
  expect(repeated.blueprint).toEqual(blueprint);
  expect(repeated.glb.byteLength).toBe(result.glb.byteLength);
  expect(createHash('sha256').update(repeated.glb).digest('hex'))
    .toBe(createHash('sha256').update(result.glb).digest('hex'));
});
