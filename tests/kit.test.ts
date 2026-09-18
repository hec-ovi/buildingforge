import { expect, it } from 'vitest';
import {
  assembleFromPieces, KIT, KIT_FAMILIES, pieceSet, planAssembly, ExteriorError,
} from '../src/index.ts';
import { glbIO, glbJson, keys } from './support.ts';
import { validateKitSchemas } from './kit-schema.ts';
import type { AssemblyRequest } from '../src/kit/types.ts';

const textures = keys.textures;

it('publishes the shared blueprint for all six families from their placed openings on a 40 by 40 lot with six floors', () => {
  const cases: Parameters<typeof validateKitSchemas>[0] = [];
  for (const [index, family] of KIT_FAMILIES.entries()) {
    const angle = index * 0.21;
    const rotate = (x: number, z: number): [number, number] =>
      [13 + x * Math.cos(angle) - z * Math.sin(angle), -7 + x * Math.sin(angle) + z * Math.cos(angle)];
    const request: AssemblyRequest = {
      family, buildingId: `parcel:${family}`, seed: 'blueprint-contract', theme: 'cyberpunk',
      parcel: { footprint: [rotate(0, 0), rotate(40, 0), rotate(40, 40), rotate(0, 40)],
        accessPoint: rotate(42, 20), maxHeight: 27,
        buildingGrid: { origin: rotate(0, 0), angle, spacing: 0.5 } },
      building: { type: 'offices', tier: 'rich', floors: 6,
        floorKinds: ['lobby', 'office', 'office', 'meeting', 'office', 'executive'] },
      anchors: [{ id: 'wire', edge: 2, u: 12, y: 10 }],
    };
    const plan = planAssembly(request);
    const { blueprint } = plan;
    const pieces = pieceSet(family, request.seed);
    const openings = blueprint.floors.flatMap(floor => floor.openings);
    expect(blueprint.buildingId).toBe(request.buildingId);
    expect(blueprint.seed).toBe(request.seed);
    expect(blueprint.bounds.footprint).toEqual(request.parcel.footprint);
    expect(blueprint.floors.map(f => f.kind)).toEqual(request.building.floorKinds);
    expect(blueprint.floors).toHaveLength(6);
    expect(new Set(openings.map(o => o.id)).size).toBe(openings.length);
    for (const floor of blueprint.floors) {
      expect(floor.height).toBe(4.5);
      expect(floor.elevation).toBe(floor.index * 4.5);
      expect(floor.outline).toEqual(request.parcel.footprint);
      expect(floor.roomEnvelope!.grid).toEqual(request.parcel.buildingGrid);
      expect(floor.roomEnvelope!.vertical.min).toBe(floor.elevation);
      for (const opening of floor.openings) {
        expect(opening.offset + opening.width).toBeLessThanOrEqual(40 + 1e-8);
        expect(opening.sill + opening.height).toBeLessThanOrEqual(floor.height + 1e-8);
      }
    }
    const windows = openings.filter(o => o.kind === 'window');
    const expected = plan.placements.reduce((count, placement) => count
      + pieces.find(piece => piece.id === placement.piece)!.openings.filter(o => o.kind === 'window').length, 0);
    expect(windows.length, family).toBe(expected);
    expect(windows.length).toBeGreaterThan(0);
    expect(openings.filter(o => o.kind === 'door').map(o => o.id)).toEqual(plan.doors.map(d => d.id));
    for (const record of plan.doors) {
      const floor = blueprint.floors[plan.placements[record.placement]!.floor]!;
      const door = floor.openings.find(o => o.id === record.id)!;
      expect(door.edge).toBe(1);
      expect(door).toMatchObject({ width: record.width, height: record.height, leaves: record.leaves });
      const from = floor.outline[door.edge]!, to = floor.outline[(door.edge + 1) % 4]!;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const ux = (to[0] - from[0]) / length, uz = (to[1] - from[1]) / length;
      const u = door.offset + door.width / 2, recess = door.door!.recessDepth;
      const position = [from[0] + ux * u - uz * recess, floor.elevation + door.sill,
        from[1] + uz * u + ux * recess];
      position.forEach((value, axis) => expect(value).toBeCloseTo(record.position[axis]!, 8));
    }
    expect([...blueprint.signage, ...blueprint.screens].map(s => s.center).sort())
      .toEqual(plan.signAnchors.map(s => s.position).sort());
    expect(blueprint.materials).toContain(blueprint.roof.material!.key);
    expect(blueprint.roof.elevation).toBe(27);
    expect(blueprint.bounds.height).toBe(27);
    cases.push({ schema: 'kit-request', value: request }, { schema: 'placement', value: plan },
      { schema: 'blueprint', value: blueprint });
  }
  validateKitSchemas(cases);
});

it('tiles every family: each run boundary of a band presents one section, and bands stack on one more', () => {
  for (const family of KIT_FAMILIES) {
    const set = pieceSet(family);
    const of = (band: string, piece: string) => set.find(m => m.band === band && m.piece === piece)!;
    expect(set, family).toHaveLength(9);
    for (const band of ['ground', 'middle', 'crown']) {
      const runs = ['corner', 'bay', 'entrance-bay'].flatMap(piece => [of(band, piece).sections.start, of(band, piece).sections.end]);
      expect(new Set(runs).size, `${family} ${band}`).toBe(1);
    }
    for (const piece of ['corner', 'bay', 'entrance-bay']) {
      expect(new Set([
        of('ground', piece).sections.top, of('middle', piece).sections.bottom,
        of('middle', piece).sections.top, of('crown', piece).sections.bottom,
      ]).size, `${family} ${piece}`).toBe(1);
    }
  }
});

it('publishes sign anchors instead of baking signage', () => {
  for (const family of KIT_FAMILIES) {
    const set = pieceSet(family);
    expect(set.flatMap(piece => piece.signAnchors).length, family).toBeGreaterThan(0);
    for (const piece of set) for (const anchor of piece.signAnchors) {
      expect(anchor.size[0]).toBeGreaterThan(0);
      expect(Math.hypot(...anchor.facing)).toBeCloseTo(1, 6);
      expect(anchor.position[1] - anchor.size[1] / 2).toBeGreaterThanOrEqual(0);
      expect(anchor.position[1] + anchor.size[1] / 2).toBeLessThanOrEqual(piece.height);
    }
    expect(set.flatMap(piece => piece.materials).some(slot => slot.includes('sign')), family).toBe(false);
  }
});

it('publishes a valid JSON placement table with complete tiling and world space attachments', () => {
  const plans = [0, 1, 2, 3].map(entranceEdge => planAssembly({
    family: 'mirror-frame', buildingId: 'p1', lot: { width: 56, depth: 24 }, floors: 5, entranceEdge,
  }));
  const set = pieceSet('mirror-frame');
  for (const [face, plan] of plans.entries()) {
    const ground = plan.placements.filter(p => p.floor === 0);
    expect(ground.filter(p => p.bayIndex === null)).toHaveLength(4);
    expect(ground.filter(p => p.bayIndex !== null)).toHaveLength(2 * (7 - 1) + 2 * (3 - 1));
    expect(ground.filter(p => p.piece.endsWith('/entrance-bay'))).toHaveLength(1);
    expect(plan.bands.map(b => b.band)).toEqual(['ground', 'middle', 'middle', 'middle', 'crown']);
    expect(plan.doors).toHaveLength(1);
    expect(plan.signAnchors).toHaveLength(5);
    for (const placement of plan.placements) {
      expect(placement.family).toBe(plan.family);
      const along = placement.bayIndex === null ? 0 : KIT.cornerArm + placement.bayIndex * KIT.bay;
      const positions = [[along, 0], [56, along], [56 - along, 24], [0, 24 - along]];
      const [x, z] = positions[placement.face]!;
      expect(placement.position).toEqual([x, plan.bands[placement.floor]!.base, z]);
      expect(Math.cos(placement.rotationY)).toBeCloseTo([1, 0, -1, 0][placement.face]!, 8);
      expect(Math.sin(placement.rotationY)).toBeCloseTo([0, -1, 0, 1][placement.face]!, 8);
    }
    for (const record of [...plan.signAnchors, ...plan.doors]) {
      const placement = plan.placements[record.placement]!;
      expect(placement.face).toBe(face);
      const piece = set.find(p => p.id === placement.piece)!;
      const local = [...piece.signAnchors, ...piece.doors].find(r => r.id === record.id)!;
      const rotate = ([x, y, z]: number[]) => [[x!, y!, z!], [-z!, y!, x!], [-x!, y!, -z!], [z!, y!, -x!]][face]!;
      const offset = rotate(local.position), facing = rotate(local.facing);
      for (let axis = 0; axis < 3; axis++) {
        expect(record.position[axis]).toBeCloseTo(placement.position[axis]! + offset[axis]!, 8);
        expect(record.facing[axis]).toBeCloseTo(facing[axis]!, 8);
      }
    }
  }
  const invalid = JSON.parse(JSON.stringify(plans[0]));
  delete invalid.placements[0].rotationY;
  validateKitSchemas([...plans.map(value => ({ schema: 'placement' as const, value })),
    { schema: 'placement', value: invalid, valid: false }]);
});

it('refuses incomplete bays and requests outside the kit envelope', () => {
  expect(() => planAssembly({ family: 'mirror-frame', buildingId: 'p2', lot: { width: 30, depth: 24 }, floors: 4 }))
    .toThrow(new RegExp(`whole number of ${KIT.bay} m bays`));
  expect(() => planAssembly({ family: 'nowhere', buildingId: 'p3', lot: { width: 24, depth: 24 }, floors: 4 }))
    .toThrow(ExteriorError);
  const request = { family: 'mirror-frame', buildingId: 'p2', lot: { width: 24, depth: 24 }, floors: 4 };
  expect(() => planAssembly({ ...request, floors: 1 })).toThrow(RangeError);
  expect(() => planAssembly({ ...request, entranceEdge: 4 })).toThrow(ExteriorError);
  expect(() => planAssembly({ ...request, floorHeight: Infinity })).toThrow(ExteriorError);
  const parcelRequest: AssemblyRequest = { family: 'mirror-frame', buildingId: 'parcel-errors',
    parcel: { footprint: [[0, 0], [40, 0], [40, 40], [0, 40]], accessPoint: [20, 0], maxHeight: 40 },
    building: { type: 'offices', tier: 'rich', floors: 6 } };
  expect(() => planAssembly({ ...parcelRequest, parcel: { ...parcelRequest.parcel, maxHeight: 26.99 } }))
    .toThrow('kit band heights exceed parcel.maxHeight');
  expect(() => planAssembly({ ...parcelRequest, building: { ...parcelRequest.building, basements: 1 } }))
    .toThrow('above ground floors only');
  expect(() => planAssembly({ ...parcelRequest, parcel: { ...parcelRequest.parcel, footprint: [[0, 0], [40, 0], [36, 40], [0, 40]] as [number, number][] } }))
    .toThrow('CCW rectangle');
  expect(() => planAssembly({ ...parcelRequest, anchors: [{ id: 'missing', edge: 4, u: 10, y: 1 }] }))
    .toThrow('must lie on a building edge');
  validateKitSchemas([
    { schema: 'kit-request', value: request },
    { schema: 'kit-request', value: { ...parcelRequest, lot: request.lot }, valid: false },
    { schema: 'kit-request', value: { ...parcelRequest, building: { ...parcelRequest.building, basements: 1 } }, valid: false },
  ]);
});

it('includes crown details inside custom band heights and the parcel envelope', () => {
  const plan = planAssembly({ family: 'mirror-frame', buildingId: 'custom-height', groundHeight: 5, floorHeight: 6,
    parcel: { footprint: [[0, 0], [24, 0], [24, 24], [0, 24]], accessPoint: [12, 0], maxHeight: 17 },
    building: { type: 'offices', tier: 'rich', floors: 3 } });
  expect(plan.bands).toEqual([
    { band: 'ground', floor: 0, base: 0, height: 5 },
    { band: 'middle', floor: 1, base: 5, height: 6 },
    { band: 'crown', floor: 2, base: 11, height: 6 },
  ]);
  expect(plan.blueprint.roof.elevation).toBe(17);
  expect(plan.blueprint.bounds.height).toBe(17);
});

it('assembles one mesh per piece and keeps the nodes a consumer addresses', async () => {
  const request: AssemblyRequest = {
    family: 'white-grid', buildingId: 'p4',
    parcel: { footprint: [[10, 20], [10, 44], [-14, 44], [-14, 20]], accessPoint: [12, 32], maxHeight: 27 },
    building: { type: 'residential', tier: 'rich', floors: 6 },
    anchors: [{ id: 'bridge-a', edge: 1, u: 12, y: 18 }],
  };
  const result = await assembleFromPieces(request, textures);
  expect(result.blueprint).toEqual(planAssembly(request).blueprint);
  const json = glbJson(result.glb);
  const names: string[] = json.nodes.map((node: { name: string }) => node.name);
  expect(json.meshes.filter((mesh: { name: string }) => mesh.name.startsWith('piece:'))).toHaveLength(result.pieces.length);
  expect(result.placements.length).toBeGreaterThan(json.meshes.length);
  for (let floor = 0; floor < 6; floor++) expect(names).toContain(`floor:${floor}/slab`);
  expect(names).toContain('door:entry/frame');
  expect(names).toContain('door:entry/leaf:0');
  expect(names).toContain('anchor:bridge-a');
  expect(result.doors).toHaveLength(1);
  expect(result.signAnchors.length).toBeGreaterThan(0);
  expect(json.materials.map((material: { name: string }) => material.name).sort()).toEqual(result.blueprint.materials);
  const doc = await glbIO().readBinary(result.glb);
  for (const name of ['floor:0/slab', 'roof:deck', 'anchor:bridge-a']) {
    const node = doc.getRoot().listNodes().find(node => node.getName() === name)!;
    const positions = node.getMesh()!.listPrimitives()[0]!.getAttribute('POSITION')!;
    const points = Array.from({ length: positions.getCount() }, (_, index) => positions.getElement(index, []));
    const centre = [0, 1, 2].map(axis => (Math.min(...points.map(p => p[axis]!)) + Math.max(...points.map(p => p[axis]!))) / 2);
    const expected = name.startsWith('anchor:') ? result.blueprint.anchors[0]!.position
      : [-2, name === 'roof:deck' ? result.blueprint.roof.elevation : 0, 32];
    centre.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis]!, 4));
  }
});
