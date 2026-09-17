import { expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { generate } from '../src/index.ts';
import schema from '../schemas/building-request.schema.json' with { type: 'json' };
import { fixture, keys } from './support.ts';

it('returns reproducible versioned floors, materials and a replaceable GLB shell', async () => {
  const request = fixture('corpo-tower');
  const before = structuredClone(request);
  const first = await generate(request, keys);
  const second = await generate(request, keys);
  expect(Buffer.from(first.glb).equals(Buffer.from(second.glb))).toBe(true);
  expect(first.blueprint).toEqual(second.blueprint);
  expect(request).toEqual(before);
  const changed = await generate({ ...request, seed: 'another-city' }, keys);
  expect(Buffer.from(first.glb).equals(Buffer.from(changed.glb))).toBe(false);
  const bp = first.blueprint;
  expect(bp.version).toBe('0.52.0');
  expect(bp).toMatchObject({ buildingId: request.buildingId, seed: request.seed });
  expect(bp.floors).toHaveLength(request.building.floors + (request.building.basements ?? 0));
  expect(bp.floors.find(f => f.index === 0)!.elevation).toBe(0);
  expect(bp.bounds.height).toBeLessThanOrEqual(request.parcel.maxHeight);
  const merged = await generate({ ...request, options: { ...request.options, glb: 'merged' } }, keys);
  expect(merged.blueprint).toEqual(bp);
  for (const output of [first, merged]) {
    const doc = await new NodeIO().readBinary(output.glb);
    const names = doc.getRoot().listNodes().map(node => node.getName());
    for (const floor of bp.floors) {
      expect(names).toContain(`floor:${floor.index}/slab`);
      for (const opening of floor.openings.filter(o => o.kind === 'door')) {
        for (let leaf = 0; leaf < (opening.leaves ?? 1); leaf++) expect(names).toContain(`door:${opening.id}/leaf:${leaf}`);
      }
    }
    expect([...new Set(doc.getRoot().listMaterials().map(m => m.getName()))].sort()).toEqual(bp.materials);
  }
  expect(bp.roof.elevation).toBeGreaterThan(bp.floors.at(-1)!.elevation);
  expect(bp.roof.bulkhead).toBeTruthy();
  expect(bp.facade.grids.length).toBeGreaterThan(0);
  expect(bp.facade.wallDepth).toBeGreaterThan(0);
  expect(bp.materialVariants).not.toEqual({});
});

it('preserves floor programs and exact link reservations, including anchor identities', async () => {
  const request = fixture('bridged-tower');
  request.building.floorKinds = Array.from({ length: request.building.floors }, (_, i) => i === 0 ? 'coffee_shop' : 'offices');
  const { blueprint, glb } = await generate(request, keys);
  expect(blueprint.floors.filter(f => f.index >= 0).map(f => f.kind)).toEqual(request.building.floorKinds);
  const nodes = (await new NodeIO().readBinary(glb)).getRoot().listNodes().map(n => n.getName());
  for (const aperture of request.apertures!) {
    if (aperture.kind === 'wire-anchor') {
      expect(blueprint.anchors.some(a => a.id === aperture.id)).toBe(true);
      expect(nodes).toContain(`anchor:${aperture.id}`);
      continue;
    }
    const floor = blueprint.floors.find(f => f.elevation === aperture.base)!;
    const opening = floor.openings.find(o => o.id === aperture.id)!;
    expect(opening).toMatchObject({ kind: 'aperture', edge: aperture.face, sill: 0, width: aperture.width, height: aperture.height });
    for (const other of floor.openings.filter(o => o !== opening && o.edge === opening.edge)) {
      const field = other.door?.cassette ?? other;
      expect(field.offset + field.width <= opening.offset || field.offset >= opening.offset + opening.width).toBe(true);
    }
  }
});

it('keeps roof and bounds exactly aligned with storeys pinned to a non-round aperture base', async () => {
  const request = fixture('bridged-tower');
  const aperture = request.apertures![0]!;
  const base = 24.013401388006868;
  const shift = base - aperture.base;
  aperture.base = base;
  aperture.cut.polygon = aperture.cut.polygon.map(([x, y, z]) => [x, y + shift, z]);
  const { blueprint } = await generate(request, keys);
  const floors = blueprint.floors.filter(floor => floor.index >= 0);
  expect(floors.some(floor => floor.elevation === base)).toBe(true);
  const last = floors.at(-1)!;
  expect(blueprint.roof.elevation).toBe(last.elevation + last.height);
  expect(blueprint.bounds.height).toBe(blueprint.roof.elevation + blueprint.roof.parapetHeight);
});

it('applies the nine explicit styles while preserving their fitted glazing and material keys', async () => {
  for (const style of schema.properties.options.properties.exteriorStyle.enum) {
    const request = fixture('corpo-tower');
    request.building = { type: style.startsWith('residential') ? 'residential' : style.startsWith('civic') ? 'factory' : 'corpo',
      tier: style.startsWith('premium') ? 'high_rich' : 'poor', floors: 4 };
    request.options = { exteriorStyle: style as NonNullable<typeof request.options>['exteriorStyle'], balconies: 'off' };
    const { blueprint } = await generate(request, keys);
    expect(blueprint.facade.exteriorStyle).toBe(style);
    const windows = blueprint.floors.flatMap(f => f.openings).filter(o => o.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    for (const window of windows) {
      expect(blueprint.materials).toContain(window.material);
      expect(window.glazing!.width).toBeGreaterThan(0);
      expect(window.glazing!.height).toBeGreaterThan(0);
      expect(window.glazing!.housingBackDepth).toBeGreaterThanOrEqual(window.glazing!.glassDepth);
    }
  }
});

it('keeps optional detail disabled and preserves a usable entrance without windows', async () => {
  const request = fixture('residential-mid');
  request.options = { windows: 'none', balconies: 'off', openFront: 'off', fireEscape: 'off', signage: null,
    adScreens: 'off', roofArtifacts: 'off', facadeServices: 'off', hangingClothes: 'off', windowDamage: 'off' };
  const { blueprint: bp } = await generate(request, keys);
  expect(bp.floors.flatMap(f => f.openings).some(o => o.kind === 'window')).toBe(false);
  expect(bp.floors.find(f => f.index === 0)!.openings.some(o => o.doorRole === 'main')).toBe(true);
  expect([bp.balconyBands, bp.signage, bp.screens, bp.roof.artifacts, bp.facadeServices.networks,
    bp.facadeServices.clotheslines, bp.facadeServices.damagedWindows].every(a => a.length === 0)).toBe(true);
  expect(bp.fireEscape).toBeNull();
});

it('fits balcony bands to their doors', async () => {
  const request = fixture('residential-mid');
  request.seed = 'full-balcony-test';
  request.parcel = { footprint: [[0, 0], [36, 0], [36, 28], [0, 28]], accessPoint: [18, -2], maxHeight: 42 };
  request.building = { type: 'residential', tier: 'rich', floors: 9 };
  request.options = { shape: 'box', balconies: 'on', balconyStyle: 'full', signage: null };
  const { blueprint: bp } = await generate(request, keys);
  expect(bp.balconyBands.length).toBeGreaterThan(0);
  for (const band of bp.balconyBands) {
    const floor = bp.floors.find(f => f.index === band.floor)!;
    expect(band.doors.length).toBeGreaterThan(0);
    for (const id of band.doors) expect(floor.openings.find(o => o.id === id)).toMatchObject({ kind: 'balconyDoor', balcony: { bandId: band.id } });
  }
});

it('fits fire escapes, service routes, clothes and explicit damage around openings', async () => {
  const request = fixture('residential-mid');
  request.parcel = { footprint: [[0, 0], [36, 0], [36, 28], [0, 28]], accessPoint: [18, -2], maxHeight: 50 };
  request.building.floors = 6;
  request.options = { ...request.options, fireEscape: 'on', facadeServices: 'on', hangingClothes: 'on', windowDamage: 'sparse' };
  const { blueprint: bp, glb } = await generate(request, keys);
  expect(bp.fireEscape).toBeTruthy();
  expect(bp.facadeServices.networks.length).toBeGreaterThan(0);
  expect(bp.facadeServices.clotheslines.length).toBeGreaterThan(0);
  for (const damage of bp.facadeServices.damagedWindows) {
    const opening = bp.floors.find(f => f.index === damage.face.floor)!.openings.find(o => o.id === damage.openingId)!;
    expect(opening.damage).toMatchObject({ pane: damage.pane, variant: damage.variant, collision: damage.collision });
  }
  expect((await new NodeIO().readBinary(glb)).getRoot().listNodes().some(n => n.getName() === 'facade-services')).toBe(true);
});

it('keeps ground privacy removable, permanent exterior louvres separate, and curtain overrides exact', async () => {
  const request = fixture('residential-mid');
  request.building = { type: 'police', tier: 'mid', floors: 3 };
  request.options = { exteriorStyle: 'civic-institutional', curtains: { profile: 'night', sunAzimuthDeg: 45 } };
  const base = await generate(request, keys);
  const ground = base.blueprint.floors.find(f => f.index === 0)!;
  const opening = ground.openings.find(o => o.kind === 'window')!;
  request.options.curtains!.overrides = [{ openingId: opening.id, openPercent: 30 }];
  const result = await generate(request, keys);
  const window = result.blueprint.floors.find(f => f.index === 0)!.openings.find(o => o.id === opening.id)!;
  expect(window.curtain!.closurePercent).toBe(70);
  expect(window.exteriorCovering).toMatchObject({ style: 'metal-louvre', placement: 'exterior' });
  expect(window.windowTreatment).toMatchObject({ privacy: 'shell-only' });
  const nodes = (await new NodeIO().readBinary(result.glb)).getRoot().listNodes();
  expect(nodes.some(n => n.getName() === window.windowTreatment!.nodeId)).toBe(true);
});

it('publishes repeated pocket cassettes with their clear passages', async () => {
  const request = fixture('pocket-paired');
  request.parcel.footprint = [[0, 0], [100, 0], [100, 28], [0, 28]];
  request.parcel.accessPoint = [50, 0];
  request.building = { type: 'commerce', tier: 'rich', floors: 3 };
  request.options = { ...request.options, entranceLayout: 'repeated', exteriorStyle: 'premium-office' };
  const { blueprint: bp, glb } = await generate(request, keys);
  const doors = bp.floors.find(f => f.index === 0)!.openings.filter(o => o.door?.motion.kind === 'pocket');
  expect(doors.length).toBeGreaterThan(1);
  const names = (await new NodeIO().readBinary(glb)).getRoot().listNodes().map(n => n.getName());
  for (const door of doors) {
    expect(door.door!.clearance).toMatchObject({ width: door.width, height: door.height });
    expect(door.door!.cassette!.width).toBeGreaterThan(door.width);
    if (door.door!.motion.kind !== 'pocket') throw Error('expected pocket motion');
    for (const leaf of door.door!.motion.leaves) {
      expect(Math.abs(leaf.travelU)).toBeGreaterThan(0);
      expect(names).toContain(`door:${door.id}/leaf:${leaf.leaf}`);
    }
  }
});

it('exports an open frontage and fits caller-supplied sign and logo content', async () => {
  const request = fixture('residential-mid');
  request.building = { type: 'coffee_shop', tier: 'mid', floors: 1 };
  request.options = { openFront: 'on', signage: { mode: 'marquee', text: 'COFFEE' }, adScreens: 'on' };
  const { blueprint: bp } = await generate(request, keys);
  expect(bp.floors[0]!.openings.find(o => o.kind === 'openFront')).toMatchObject({ accessRole: 'main', portal: { clearWidth: expect.any(Number) } });
  expect(bp.signage.some(s => s.text === 'COFFEE')).toBe(true);
  const logo = await generate({ ...fixture('corpo-tower'), options: { signage: { mode: 'logo', ratio: '3:2' } } }, keys);
  expect(logo.blueprint.signage.some(s => s.mode === 'logo' && s.ratio === '3:2')).toBe(true);
});
