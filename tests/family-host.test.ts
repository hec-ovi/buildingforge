import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { buildingFamily, FAMILY_IDS, type FamilyArchitecture } from '../src/families/registry.ts';
import { splitMaterialSlot } from '../src/materials/slot.ts';
import { keys, glbJson } from './support.ts';

function request(architecture: FamilyArchitecture, fixed = false): BuildingRequest {
  const buildingId = `host-${architecture}`;
  // The corporate volume needs twelve floors, so it takes a narrower plate to
  // stay inside the published tower geometry budget.
  const tall = architecture === 'corporate-sectors';
  const [width, depth] = tall ? [35, 35] : [44, 36];
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

it.each(FAMILY_IDS)('generates %s with authored skins, rooms and exact bridge faces', async architecture => {
  const family = buildingFamily(architecture)!;
  for (const fixed of [false, true]) {
    const input = request(architecture, fixed);
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
    if (fixed) {
      expect(blueprint.floors.every(f => JSON.stringify(f.outline) === JSON.stringify(input.parcel.footprint))).toBe(true);
      const floor = blueprint.floors.find(f => f.openings.some(o => o.id === 'bridge'))!;
      const cut = floor.openings.find(o => o.id === 'bridge')!;
      expect(floor.elevation + cut.sill).toBe(9);
      expect({ edge: cut.edge, offset: cut.offset, width: cut.width, height: cut.height }).toEqual({ edge: 1, offset: 16.5, width: 3, height: 3 });
      expect(floor.openings.filter(o => o.kind === 'window' && o.edge === 1).every(o => o.offset + o.width <= 16.5 || o.offset >= 19.5)).toBe(true);
    } else if (architecture === 'balcony-grid') {
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
    if (!fixed && ['corporate-sectors', 'mirror-frame'].includes(architecture)) expect(blueprint.modelInstances?.length).toBeGreaterThan(0);
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
