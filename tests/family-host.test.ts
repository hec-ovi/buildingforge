import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { ringInsidePolygon, type P2 } from '../src/core/polygon.ts';
import { buildingFamily, FAMILY_IDS, type FamilyArchitecture } from '../src/families/registry.ts';
import { crossingWindows } from '../src/layout/circulationBand.ts';
import { coreAdjacency } from '../src/layout/coreAdjacency.ts';
import { fitBuildingCore } from '../src/layout/corePreflight.ts';
import { splitMaterialSlot } from '../src/materials/slot.ts';
import { keys, glbJson } from './support.ts';

function request(architecture: FamilyArchitecture, fixed = false): BuildingRequest {
  const buildingId = `host-${architecture}`;
  const tall = architecture === 'corporate-sectors';
  const [width, depth] = [44, 36];
  return {
    seed: 'family-host-reference', buildingId, theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [width, 0], [width, depth], [0, depth]], accessPoint: [width / 2, 0], maxHeight: tall ? 60 : 40 },
    building: { type: 'offices', tier: 'rich', floors: tall ? 12 : 6 },
    options: { architecture, glb: 'named', balconies: 'off', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', fireEscape: 'off', signage: null },
    ...(fixed ? { apertures: [{ id: 'bridge', buildingId, floor: 2, face: 1, kind: 'bridge' as const,
      u: 16.5, base: 9, width: 3, height: 3, shape: 'rect' as const,
      cut: { polygon: [[width, 9, 16.5], [width, 9, 19.5], [width, 12, 19.5], [width, 12, 16.5]] as [number, number, number][], axisDir: [1, 0, 0] as [number, number, number] }, linkId: 'link' }] } : {}),
  };
}

it('preserves the accepted premium families with their authored skin, rooms and material roles', async () => {
  for (const architecture of FAMILY_IDS.filter(id => !/^(residential-|industrial-|service-)/.test(id))) {
    const family = buildingFamily(architecture)!;
    const input = request(architecture);
    const { blueprint, glb } = await generate(input, keys);
    const assembly = blueprint.assembly!;
    expect(assembly.architecture).toBe(architecture);
    expect(assembly.floors).toHaveLength(input.building.floors);
    expect(blueprint.floors[0]!.openings.filter(o => o.kind === 'window')).toEqual([]);
    expect(blueprint.floors[0]!.openings.some(o => o.kind === 'door' && o.doorRole === 'main')).toBe(true);
    const bind = (slot: string) => { const [key, variantId] = splitMaterialSlot(slot); return { key, variantId }; };
    expect(blueprint.facade.groundMaterial).toEqual(bind(family.materials!.ground!));
    expect(blueprint.facade.materialPlan.field).toEqual(bind(family.materials!.wall!));
    expect(blueprint.roof.material).toEqual(bind(family.materials!.roof!));
    for (const role of ['field', 'border', 'trim'] as const) expect(blueprint.facade.materialPlan[role].variantId).toEqual(expect.stringMatching(/\S/));
    expect(Object.values(blueprint.materialVariants).every(variant => !variant.includes('#'))).toBe(true);
    const windows = blueprint.floors.flatMap(f => f.openings.filter(o => o.kind === 'window'));
    expect(windows.some(o => o.material === 'cyberpunk/paired-window-black/mid' && !o.scenery)).toBe(true);
    expect(windows.some(o => o.scenery?.lights?.length)).toBe(true);
    const json = glbJson(glb);
    const patterns: Record<string, string> = { 'cyberpunk/paired-blind/mid': 'blades' };
    if (architecture === 'faceted-bays') patterns['cyberpunk/ivory-panel/mid'] = 'fixings';
    if (architecture === 'corporate-sectors') patterns['cyberpunk/corporate-panel/mid'] = 'joints';
    for (const [key, variant] of Object.entries(patterns)) {
      expect(blueprint.materialVariants[key]).toBe(variant);
      const materials = json.materials.filter((m: { name: string }) => m.name === key);
      expect(materials.length).toBeGreaterThan(0);
      expect(materials.every((m: { extras: { materialVariant: string } }) => m.extras.materialVariant === variant)).toBe(true);
    }
    expect(json.materials.every((material: { extras?: { materialVariant?: string } }) => !material.extras?.materialVariant?.includes('#'))).toBe(true);
    if (family.materials?.['light-fixture']) {
      const [key, variant] = splitMaterialSlot(family.materials['light-fixture']);
      const lights = json.materials.filter((material: { name: string }) => material.name === key);
      expect(lights.length).toBeGreaterThan(0);
      expect(lights.every((material: { extras?: { materialVariant?: string } }) => material.extras?.materialVariant === variant)).toBe(true);
      expect(blueprint.materialVariants[key]).toBe(variant);
    }
    const names = new Set<string>(json.nodes.map((n: { name: string }) => n.name));
    expect([...names].some(name => name.startsWith('section:'))).toBe(false);
    expect(json.materials.some((m: { name: string }) => m.name.startsWith(family.materials!.wall!.split('#')[0]!))).toBe(true);
    for (const window of windows) if (window.scenery) {
      expect(names.has(window.scenery.nodeId)).toBe(true);
      expect(window.scenery.lights?.every(l => l.position.every(Number.isFinite) && l.lumens > 0) ?? true).toBe(true);
      if (window.width < 0.7) expect(window.panes?.cols).toBe(1);
    }
    for (let i = 0; i < blueprint.lights.length; i++) expect(names.has(`light:${i}`)).toBe(true);
    if (architecture === 'balcony-grid') {
      const curved = assembly.floors[1]!.sections.filter(s => s.spans);
      expect(curved).toHaveLength(4);
      expect(curved.map(s => s.spans!.length)).toEqual([3, 3, 3, 3]);
      for (const floor of blueprint.floors.slice(1)) for (const section of curved) {
        const fields = floor.openings.filter(o => o.sectionId === section.id);
        expect(fields).toHaveLength(3);
        expect(fields.every(o => o.panes?.cols === 1)).toBe(true);
        expect(fields.filter(o => o.scenery?.lights?.length).length).toBeLessThanOrEqual(1);
      }
    }
    if (['corporate-sectors', 'mirror-frame'].includes(architecture)) expect(blueprint.modelInstances?.length).toBeGreaterThan(0);
  }
}, 30_000);

/** One plan of the shared library: whole 8 m bays, the entrance on face 0. */
function planRequest(architecture: FamilyArchitecture, across: number, deep: number, floors: number): BuildingRequest {
  const [width, depth] = [across * 8, deep * 8];
  return {
    seed: `plans:${architecture}-${across}x${deep}x${floors}f`, buildingId: `${architecture}-${across}x${deep}x${floors}f`,
    theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [width, 0], [width, depth], [0, depth]], accessPoint: [width / 2, 0], maxHeight: floors * 4.5 + 2 },
    building: { type: architecture === 'corporate-sectors' ? 'corpo' : 'residential', tier: 'high_rich', floors },
    options: { architecture },
  };
}

it('stands the roof housing over the stair run on every family and plan size', async () => {
  // Interior's stair A is 3 m across its 6.2 m run: the cutout is deep along
  // that run, whichever frame axis the confirmed placement runs it on.
  const plans: [FamilyArchitecture, number, number, number][] = [
    ['mirror-frame', 4, 3, 8], ['mirror-frame', 4, 3, 9], ['mirror-frame', 4, 3, 16], ['mirror-frame', 4, 3, 29],
    ['balcony-grid', 4, 3, 8], ['corporate-sectors', 5, 5, 12], ['faceted-bays', 4, 4, 12],
    ['mirror-shutters', 4, 3, 8], ['white-grid', 4, 3, 8],
  ];
  for (const [architecture, across, deep, floors] of plans) {
    const plan = `${architecture}-${across}x${deep}x${floors}f`;
    const { blueprint } = await generate(planRequest(architecture, across, deep, floors), keys);
    const bulkhead = blueprint.roof.bulkhead;
    expect(bulkhead, plan).toBeTruthy();
    const { center, axis, width, depth: deepSide } = bulkhead!;
    expect(Math.max(width, deepSide), plan).toBeGreaterThanOrEqual(6.2);
    expect(Math.min(width, deepSide), plan).toBeGreaterThanOrEqual(3);
    // The door stands at the head of the run, not beside the flight.
    expect(Math.abs(bulkhead!.doorNormal[0]! * axis[0]! + bulkhead!.doorNormal[1]! * axis[1]!), plan)
      .toBeCloseTo(width >= deepSide ? 1 : 0, 7);
    const cross: P2 = [-axis[1]!, axis[0]!];
    expect(bulkhead!.doorNormal[0]! * cross[0] + bulkhead!.doorNormal[1]! * cross[1], plan)
      .toBeCloseTo(width >= deepSide ? 0 : -1, 7);
    // Interior reads the published housing back and lands stair A inside it.
    const { stair } = fitBuildingCore(blueprint);
    const offset = [stair.center[0]! - center[0]!, stair.center[1]! - center[1]!];
    const alongU = Math.abs(offset[0]! * axis[0]! + offset[1]! * axis[1]!);
    const alongV = Math.abs(offset[0]! * cross[0] + offset[1]! * cross[1]);
    expect(alongU + stair.width / 2, plan).toBeLessThanOrEqual(width / 2 + 1e-9);
    expect(alongV + stair.depth / 2, plan).toBeLessThanOrEqual(deepSide / 2 + 1e-9);
    const hw = width / 2, hd = deepSide / 2;
    const corners = ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as P2[]).map(([u, v]): P2 =>
      [center[0]! + axis[0]! * u + cross[0] * v, center[1]! + axis[1]! * u + cross[1] * v]);
    expect(ringInsidePolygon(blueprint.roof.outline, corners), plan).toBe(true);
  }
}, 30_000);

it('keeps the published circulation depth beside every window on every family plan', async () => {
  // Interior measured the two faceted-bays plans short beside these windows;
  // the family gives them up rather than the core standing closer.
  const plans: [FamilyArchitecture, number, number, number, string[]][] = [
    ['faceted-bays', 4, 3, 3, ['w:1:fb:2:0:19:0:slit:0:0']],
    ['faceted-bays', 4, 3, 36, ['w:1:fb:2:0:19:0:slit:0:0', 'w:2:fb:2:1:22:0:cheek:0:0']],
    ['mirror-frame', 4, 3, 8, []], ['balcony-grid', 4, 3, 8, []], ['corporate-sectors', 5, 5, 12, []],
    ['mirror-shutters', 4, 3, 8, []], ['white-grid', 4, 3, 8, []],
  ];
  for (const [architecture, across, deep, floors, givenUp] of plans) {
    const plan = `${architecture}-${across}x${deep}x${floors}f`;
    const request = planRequest(architecture, across, deep, floors);
    const { blueprint } = await generate(request, keys);
    const policy = blueprint.facade.coreAdjacency!;
    expect(policy.glazing.clearDepth, plan).toBe(coreAdjacency(request).glazing.clearDepth);
    const { stair } = fitBuildingCore(blueprint);
    expect(crossingWindows(blueprint.floors, stair, blueprint.facade.wallDepth, policy), plan).toEqual(new Set());
    const published = new Set(blueprint.floors.flatMap(floor => floor.openings.map(opening => opening.id)));
    for (const id of givenUp) expect(published.has(id), `${plan} ${id}`).toBe(false);
    expect(blueprint.floors.flatMap(floor => floor.openings).length, plan).toBeGreaterThan(0);
  }
}, 30_000);

it('slides every entrance into the wall on one plan per family', async () => {
  const plans: [FamilyArchitecture, number, number, number][] = [
    ['mirror-frame', 4, 3, 8], ['balcony-grid', 4, 3, 8], ['faceted-bays', 4, 3, 8],
    ['white-grid', 4, 3, 8], ['mirror-shutters', 4, 3, 8], ['corporate-sectors', 5, 5, 12],
  ];
  for (const [architecture, across, deep, floors] of plans) {
    const plan = `${architecture}-${across}x${deep}x${floors}f`;
    const { blueprint } = await generate(planRequest(architecture, across, deep, floors), keys);
    const ground = blueprint.floors.find(floor => floor.index === 0)!;
    const doors = ground.openings.filter(opening => opening.kind === 'door');
    expect(doors.length, plan).toBeGreaterThan(0);
    for (const door of doors) {
      const { motion, cassette, clearance } = door.door!;
      expect(motion.kind, `${plan} ${door.id}`).toBe('pocket');
      if (motion.kind !== 'pocket') continue;
      expect(clearance, plan).toMatchObject({ offset: door.offset, width: door.width, height: door.height });
      expect(motion.leaves, plan).toHaveLength(door.leaves!);
      const leafWidth = door.width / motion.leaves.length;
      for (const { travelU, pocket } of motion.leaves) {
        // the leaf slides its own width clear of the passage, into the wall beside it
        expect(Math.abs(travelU), plan).toBeGreaterThanOrEqual(leafWidth);
        expect(pocket.offset + pocket.width <= door.offset + 1e-6
          || pocket.offset >= door.offset + door.width - 1e-6, `${plan} pocket across the passage`).toBe(true);
        expect(pocket.offset, plan).toBeGreaterThan(cassette!.offset);
        expect(pocket.offset + pocket.width, plan).toBeLessThan(cassette!.offset + cassette!.width);
      }
      // the wall the leaves run into carries nothing else
      for (const other of ground.openings) {
        if (other === door || other.edge !== door.edge) continue;
        expect(other.offset + other.width <= cassette!.offset + 1e-6
          || other.offset >= cassette!.offset + cassette!.width - 1e-6, `${plan} ${other.id} in the pocket wall`).toBe(true);
      }
    }
  }
}, 30_000);

it('rejects a fixed family on a nonrectangular parcel', async () => {
  const input = request('white-grid', true);
  input.parcel.footprint[3] = [2, 36];
  await expect(generate(input, keys)).rejects.toMatchObject({ code: 'E_SCHEMA' });
});

it('keeps a basement tunnel exact while fitting a free upper family and its planting', async () => {
  const input = request('mirror-frame');
  input.building.basements = 1;
  input.apertures = [{ id: 'tunnel', buildingId: input.buildingId, floor: -1, face: 1, kind: 'tunnel',
    u: 18, base: -4.5, width: 3, height: 3, shape: 'rect',
    cut: { polygon: [[44, -4.5, 16.5], [44, -4.5, 19.5], [44, -1.5, 19.5], [44, -1.5, 16.5]], axisDir: [1, 0, 0] }, linkId: 'tunnel-link' }];
  const { blueprint } = await generate(input, keys);
  const basement = blueprint.floors.find(f => f.index === -1)!;
  expect(basement.outline).toEqual(input.parcel.footprint);
  const tunnel = basement.openings.find(o => o.id === 'tunnel')!;
  expect(basement.elevation + tunnel.sill).toBe(-4.5);
  expect({ edge: tunnel.edge, offset: tunnel.offset, width: tunnel.width, height: tunnel.height })
    .toEqual({ edge: 1, offset: 16.5, width: 3, height: 3 });
  const ground = blueprint.floors.find(f => f.index === 0)!;
  expect(ground.outline).toEqual([[2, 2], [42, 2], [42, 34], [2, 34]]);
  expect(blueprint.assembly!.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(ground.outline))).toBe(true);
  expect(blueprint.modelInstances?.length).toBeGreaterThan(0);
});

it('keeps authored family screens without generic overlays or mechanical attachments', async () => {
  const input = request('faceted-bays');
  input.options = { ...input.options, adScreens: 'on', signage: { mode: 'marquee', text: 'ARC' } };
  const { blueprint, glb } = await generate(input, keys);
  expect(blueprint.screens).toEqual([]);
  expect(blueprint.facadeArtifacts).toEqual([]);
  expect(blueprint.signage.some(sign => sign.mode === 'marquee' && sign.text === 'ARC')).toBe(true);
  expect(blueprint.lights.some(light => light.kind === 'entrance')).toBe(true);
  const json = glbJson(glb);
  const screens = json.nodes.filter((node: { name: string }) => /^faceted-bays:.*\/screens$/.test(node.name));
  expect(screens.some((node: { mesh?: number }) => node.mesh !== undefined)).toBe(true);
  expect(json.nodes.some((node: { name: string }) => node.name.startsWith('screen:'))).toBe(false);
  const screenMaterial = json.materials.findIndex((material: { name: string }) => material.name === 'cyberpunk/corporate-screen/mid');
  expect(screenMaterial).toBeGreaterThanOrEqual(0);
  expect(screens.some((node: { mesh?: number }) => node.mesh !== undefined && json.meshes[node.mesh].primitives
    .some((primitive: { material: number }) => primitive.material === screenMaterial))).toBe(true);
  expect(blueprint.roof.parapetHeight).toBe(0);
  expect(json.nodes.some((node: { name: string; mesh?: number }) => node.name === 'parapet' && node.mesh !== undefined)).toBe(false);
});
