import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { glbIO, keys, normalsOf } from './support.ts';

const request: BuildingRequest = {
  seed: 'garden-reference', buildingId: 'garden', theme: 'cyberpunk',
  parcel: { footprint: [[0, 0], [52, 0], [52, 42], [0, 42]], accessPoint: [26, 0], maxHeight: 19.5 },
  building: { type: 'residential', tier: 'rich', floors: 4 },
  options: { architecture: 'garden-taper', glb: 'named', balconies: 'off', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', fireEscape: 'off', signage: null },
};

it('exports tapering wings around a straight enclosed planted spine', async () => {
  const { blueprint, glb } = await generate(request, keys);
  expect(blueprint.floors[0]!.height).toBe(4.5);
  const assembly = blueprint.assembly!;
  let wingWidth = Infinity;
  const spineBounds: number[][] = [];
  for (const floor of blueprint.floors.slice(1)) {
    expect(floor.topOutline).toHaveLength(4);
    expect(floor.topOutline![1]![0] - floor.topOutline![0]![0]).toBeLessThan(floor.outline[1]![0] - floor.outline[0]![0]);
    if (floor.index < 3) expect(floor.topOutline).toEqual(blueprint.floors[floor.index + 1]!.outline);
    const gardens = assembly.floors[floor.index]!.sections.filter(s => s.technique === 'garden-bay');
    expect(gardens.map(s => s.edge)).toEqual([0, 2]);
    const wings = assembly.floors[floor.index]!.sections.filter(s => s.technique === 'paired-glass' && s.edge % 2 === 0);
    expect(wings).toHaveLength(4);
    expect(wings.every(s => s.width === wings[0]!.width)).toBe(true);
    expect(wings[0]!.width).toBeLessThan(wingWidth);
    wingWidth = wings[0]!.width;
    expect(gardens.every(s => s.width === 20)).toBe(true);
    const garden = gardens[0]!;
    const left = floor.outline[0]![0] + garden.offset;
    spineBounds.push([left, left + garden.width, floor.outline[0]![1]]);
    expect(floor.topOutline![2]![1] - floor.topOutline![1]![1]).toBeCloseTo(floor.outline[2]![1] - floor.outline[1]![1]);
  }
  expect(spineBounds.every(bounds => bounds.every((value, i) => Math.abs(value - spineBounds[0]![i]!) < 1e-7))).toBe(true);
  expect(blueprint.roof.outline).toEqual(blueprint.floors[3]!.topOutline);
  expect(blueprint.roof.outline[1]![0] - blueprint.roof.outline[0]![0]).toBeCloseTo(25);
  expect(blueprint.facade.groundMaterial.key).toBe('cyberpunk/garden-concrete/mid');
  expect(blueprint.lights.filter(l => l.color === '#99fff0').length).toBeGreaterThan(0);
  const blackWindows = blueprint.floors.flatMap(f => f.openings).filter(o => o.material === 'cyberpunk/paired-window-black/mid');
  expect(blackWindows.length).toBeGreaterThan(0);
  expect(blackWindows.every(o => !o.scenery)).toBe(true);
  const document = await glbIO().readBinary(glb);
  expect(document.getRoot().listMaterials().some(m => m.getName() === 'cyberpunk/paired-window-black/mid')).toBe(true);
  const gardens = document.getRoot().listNodes().filter(n => n.getName().startsWith('garden:'));
  expect(gardens).toHaveLength(6);
  for (const node of gardens) for (const primitive of node.getMesh()!.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!.getArray()!;
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(Array.from(positions).every((value, i) => i % 3 === 1 || value >= 0 && value <= (i % 3 === 0 ? 52 : 42))).toBe(true);
  }
  const windowNormals = document.getRoot().listNodes().filter(n => n.getName().startsWith('window:'))
    .flatMap(n => n.getMesh()!.listPrimitives().flatMap(p => normalsOf(p).map(normal => normal[1]!)));
  expect(windowNormals.some(y => Math.abs(y) > 0.02 && Math.abs(y) < 0.7)).toBe(true);
  expect(blueprint.balconyBands).toEqual([]);
});

it('rejects a plate, a vertical envelope and a slope that cannot carry the podium and wings', async () => {
  await expect(generate({ ...request, parcel: { ...request.parcel, footprint: [[0,0],[25,0],[25,30],[0,30]] } }, keys))
    .rejects.toMatchObject({ code: 'E_CORE_PLATE' });
  await expect(generate({ ...request, parcel: { ...request.parcel, maxHeight: 17.5 } }, keys))
    .rejects.toMatchObject({ code: 'E_ENVELOPE_TOO_LOW' });
  await expect(generate({ ...request, building: { ...request.building, floors: 25 }, parcel: { ...request.parcel, maxHeight: 112.5 } }, keys))
    .rejects.toMatchObject({ code: 'E_CORE_PLATE' });
});

it('fits the planted front along the long base', async () => {
  const rotated = { ...request, parcel: { ...request.parcel, footprint: [[0,0],[42,0],[42,62],[0,62]] as [number, number][], accessPoint: [42,31] } };
  const { blueprint } = await generate(rotated, keys);
  const floor = blueprint.floors[1]!;
  expect(floor.outline[0]![0]).toBeCloseTo(floor.outline[1]![0]);
  const podium = blueprint.floors[0]!;
  expect(Math.hypot(podium.outline[1]![0] - podium.outline[0]![0], podium.outline[1]![1] - podium.outline[0]![1])).toBe(61);
});
