import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import { fixture, keys } from './support.ts';

it('publishes a contained right-angle rectangle on every actual floor and construction frame', async () => {
  const angle = 0.37, cosine = Math.cos(angle), sine = Math.sin(angle);
  const transform = ([x, z]: [number, number]): [number, number] => [70 + x * cosine - z * sine, 90 + x * sine + z * cosine];
  for (const shape of ['auto', 'cylinder', 'setback'] as const) {
    const request = fixture('corpo-tower');
    request.building.floors = 10;
    request.building.basements = 1;
    request.parcel.footprint = request.parcel.footprint.map(transform);
    request.parcel.accessPoint = transform(request.parcel.accessPoint);
    request.parcel.buildingGrid = { origin: transform([0, 0]), angle, spacing: 0.5 };
    request.options = { ...request.options, shape, balconies: 'off' };
    const { blueprint } = await generate(request, keys);
    for (const floor of blueprint.floors) {
      const room = floor.roomEnvelope!;
      expect(room).toBeDefined();
      expect(room.corners).toHaveLength(4);
      expect(room.origin).toEqual(room.corners[0]);
      expect(room.grid).toEqual(request.parcel.buildingGrid);
      expect(room.axisU[0] * room.axisV[0] + room.axisU[1] * room.axisV[1]).toBeCloseTo(0, 8);
      expect(Math.hypot(...room.axisU)).toBeCloseTo(1, 8);
      expect(Math.hypot(...room.axisV)).toBeCloseTo(1, 8);
      expect(room.width * room.depth).toBeGreaterThan(0);
      const expected = [[0, 0], [room.width, 0], [room.width, room.depth], [0, room.depth]];
      room.corners.forEach((corner, i) => {
        expect(corner[0]).toBeCloseTo(room.origin[0] + expected[i]![0]! * room.axisU[0] + expected[i]![1]! * room.axisV[0], 8);
        expect(corner[1]).toBeCloseTo(room.origin[1] + expected[i]![0]! * room.axisU[1] + expected[i]![1]! * room.axisV[1], 8);
        // These generated forms are convex, so inward half-planes prove whole-edge containment.
        for (let edge = 0; edge < floor.outline.length; edge++) {
          const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
          const dx = b[0] - a[0], dz = b[1] - a[1];
          const inward = (dx * (corner[1] - a[1]) - dz * (corner[0] - a[0])) / Math.hypot(dx, dz);
          expect(inward).toBeGreaterThanOrEqual(blueprint.facade.wallDepth - 1e-7);
          for (const opening of floor.openings.filter(o => o.edge === edge)) {
            const movement = opening.door?.motion.clearDepth ?? opening.portal?.clearDepth ?? 0;
            expect(inward).toBeGreaterThanOrEqual(blueprint.facade.wallDepth + movement - 1e-7);
          }
        }
      });
      expect(room.vertical.min).toBe(floor.elevation);
      expect(room.vertical.max).toBeGreaterThan(floor.elevation);
      expect(room.vertical.max).toBeLessThan(floor.elevation + floor.height);
    }
    expect(blueprint.floors[0]!.index).toBe(-1);
  }
});

it('honors an explicit clear height on every floor without reducing the taller ground program', async () => {
  const request = fixture('architecture-02-chamfered-corners');
  request.building.floors = 6;
  const { blueprint } = await generate(request, keys);
  expect(blueprint.floors[0]!.height).toBe(7);
  for (const floor of blueprint.floors.filter(f => f.index > 0)) {
    expect(floor.height).toBe(4.5);
    expect(floor.roomEnvelope!.vertical.max - floor.roomEnvelope!.vertical.min).toBe(4);
  }
  expect(blueprint.floors[1]!.openings.filter(o => o.kind === 'window').every(o => o.height === 3.5)).toBe(true);
  const lower = await generate({ ...request, options: { ...request.options, minimumClearHeight: 3 } }, keys);
  expect(lower.blueprint.floors[0]!.height).toBe(7);
  // The override lowers the active minimum; the composition keeps its own larger dimension.
  const upper = lower.blueprint.floors.find(f => f.index === 1)!;
  expect(upper.roomEnvelope!.vertical.max - upper.roomEnvelope!.vertical.min).toBeGreaterThanOrEqual(3);
  expect(upper.height).toBeLessThan(blueprint.floors[1]!.height);
  await expect(generate({ ...request, parcel: { ...request.parcel, maxHeight: 23 } }, keys)).rejects.toMatchObject({ code: 'E_ENVELOPE_TOO_LOW' });
});
