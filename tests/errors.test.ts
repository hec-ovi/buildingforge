import { expect, it } from 'vitest';
import { generate, ExteriorError, type GenerateOptions } from '../src/index.ts';
import { fixture, keys } from './support.ts';

const residential = fixture('residential-mid'), bridged = fixture('bridged-tower');
const aperture = (patch: object) => ({ ...bridged, apertures: [{ ...bridged.apertures![0], ...patch }] });
const blocked = fixture('pocket-paired');
blocked.parcel.streetAccess = { edgeId: 'street', path: [[-8, -10], [-8, 40]] };
blocked.parcel.accessPoint = [-1, 10];
blocked.apertures = blocked.parcel.footprint.map((a, face, ring) => {
  const b = ring[(face + 1) % ring.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const at = (u: number, y: number): [number, number, number] => [a[0] + (b[0] - a[0]) * u / length, y, a[1] + (b[1] - a[1]) * u / length];
  return { id: `link-${face}`, buildingId: blocked.buildingId, floor: 0, face, kind: 'bridge', u: length / 2,
    base: 0, width: length - 6, height: 2.5, shape: 'rect', linkId: `span-${face}`,
    cut: { polygon: [at(3, 0), at(length - 3, 0), at(length - 3, 2.5), at(3, 2.5)], axisDir: [1, 0, 0] } };
});
const cases: [string, unknown, GenerateOptions?][] = [
  ['E_SCHEMA', {}],
  ['E_FOOTPRINT_INVALID', { ...residential, parcel: { ...residential.parcel, footprint: [[0, 0], [10, 0], [0, 10], [10, 10]] } }],
  ['E_FOOTPRINT_TOO_SMALL', { ...residential, parcel: { ...residential.parcel, footprint: [[0, 0], [3, 0], [3, 3], [0, 3]] } }],
  ['E_ENVELOPE_TOO_LOW', { ...residential, building: { ...residential.building, floors: 40 } }],
  ['E_FLOORKINDS_MISMATCH', { ...residential, building: { ...residential.building, floorKinds: ['lobby'] } }],
  ['E_APERTURE_UNREACHABLE', aperture({ face: 9 })],
  ['E_APERTURE_INVALID', aperture({ cut: { polygon: [[29, 24, 8.5], [29, 24, 11.5], [29, 27, 11.5], [29, 27, 8.5]], axisDir: [1, 0, 0] } })],
  ['E_APERTURE_OVERLAP', { ...bridged, apertures: [bridged.apertures![0], { ...bridged.apertures![0], id: 'duplicate', linkId: 'other' }] }],
  ['E_SIGNAGE_TEXT_TOO_LONG', { ...residential, parcel: { footprint: [[0, 0], [12, 0], [12, 12], [0, 12]], accessPoint: [6, -1], maxHeight: 6 },
    building: { type: 'coffee_shop', tier: 'mid', floors: 1 }, options: { signage: { mode: 'marquee', text: 'AN ABSURDLY LONG COFFEE MARQUEE TEXT!!!' } } }],
  ['E_CORE_PLATE', { ...residential, parcel: { ...residential.parcel, footprint: [[0, 0], [100, 0], [100, 3], [0, 3]] } }],
  ['E_DOOR_FIT', blocked],
  ['E_MATERIAL_UNRESOLVED', residential, { textures: { mode: 'embed', source: null } }],
  ['E_INVARIANT', residential, { textures: { source: { get index(): never { throw Error('catalog callback failed'); }, readMap: () => null } } }],
];

it('reports every closed error code through the public entry', async () => {
  for (const [code, request, options] of cases) {
    try {
      await generate(request, options ?? keys);
      expect.unreachable(`${code} must fail generation`);
    } catch (error) {
      expect(error, code).toBeInstanceOf(ExteriorError);
      expect(error).toMatchObject({ code, message: expect.any(String) });
    }
  }
});
