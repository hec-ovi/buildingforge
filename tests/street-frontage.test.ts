import { expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';

const keys = { textures: { mode: 'keys' as const } };
function request(angle = 0): BuildingRequest {
  const transform = ([x, z]: number[]): [number, number] => [70 + x! * Math.cos(angle) - z! * Math.sin(angle),
    90 + x! * Math.sin(angle) + z! * Math.cos(angle)];
  return {
    seed: 'street-frontage', buildingId: 'corner-shop', theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [40, 0], [40, 24], [0, 24]].map(transform),
      accessPoint: transform([-0.5, 24.5]), maxHeight: 9,
      buildingGrid: { origin: transform([0, 0]), angle, spacing: 0.5 },
      streetAccess: { edgeId: 'west-street', path: [[-8, -10], [-8, 40]].map(transform) } },
    building: { type: 'commerce', tier: 'poor', floors: 1 },
    options: { glb: 'merged', openFront: 'off', facadeServices: 'off', roofArtifacts: 'off' },
  };
}

it('keeps a corner-access entrance on its real street frontage through rotation and path reversal', async () => {
  for (const angle of [0, 0.37]) {
    const req = request(angle), saved = structuredClone(req);
    const result = await generate(req, keys);
    const ground = result.blueprint.floors.find(floor => floor.index === 0)!;
    const door = ground.openings.find(opening => opening.doorRole === 'main')!;
    expect(door.edge).toBe(3);
    expect(door.width).toBeGreaterThanOrEqual(2.8);
    expect(req).toEqual(saved);
    const reversed = structuredClone(req);
    reversed.parcel.streetAccess!.path.reverse();
    expect((await generate(reversed, keys)).blueprint).toEqual(result.blueprint);
  }
  const legacy = request();
  delete legacy.parcel.streetAccess;
  const legacyResult = await generate(legacy, keys);
  expect(legacyResult.blueprint.floors[0]!.openings.find(o => o.doorRole === 'main')!.edge).toBe(2);
});

it('rejects malformed or directionless source streets at the public generator', async () => {
  const malformed = request();
  malformed.parcel.streetAccess!.path[1] = [...malformed.parcel.streetAccess!.path[0]!];
  await expect(generate(malformed, keys)).rejects.toMatchObject({ code: 'E_SCHEMA',
    message: expect.stringContaining('street segments must have positive length') });
  const ambiguous = request();
  ambiguous.parcel.accessPoint = [62, 100];
  await expect(generate(ambiguous, keys)).rejects.toMatchObject({ code: 'E_SCHEMA',
    message: expect.stringContaining('accessPoint must be off street') });
});

it('rejects a blocked street frontage instead of placing the entrance on another side', async () => {
  const req = request();
  req.apertures = [{ id: 'reserved-frontage', buildingId: req.buildingId, floor: 0, face: 3,
    kind: 'wire-anchor', u: 12, base: 4, width: 24, height: 0.1, shape: 'rect', linkId: 'wire',
    cut: { polygon: [[70, 4, 114], [70, 4, 90], [70, 4.1, 90], [70, 4.1, 114]], axisDir: [-1, 0, 0] } }];
  await expect(generate(req, keys)).rejects.toMatchObject({ code: 'E_DOOR_FIT',
    message: expect.stringContaining('west-street') });
});
