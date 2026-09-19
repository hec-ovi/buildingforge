import type { BuildingRequest } from '../src/index.ts';
import balcony from '../src/families/balcony-grid/fixtures/p117.json' with { type: 'json' };
import faceted from '../src/families/faceted-bays/fixture.json' with { type: 'json' };
import frame from '../src/families/mirror-frame/fixtures/reference.json' with { type: 'json' };
import shutters from '../src/families/mirror-shutters/fixtures/frontage.json' with { type: 'json' };
import white from '../src/families/white-grid/fixtures/reference.json' with { type: 'json' };

const references = {
  'balcony-grid': balcony,
  'corporate-sectors': { seed: 'corporate-contract', rectangle: [[0, 0], [51, 0], [51, 39], [0, 39]], floorHeights: Array(12).fill(4.5) as number[] },
  'faceted-bays': faceted,
  'garden-taper': { seed: 'garden-reference', rectangle: [[0, 0], [52, 0], [52, 42], [0, 42]], floorHeights: Array(4).fill(4.5) as number[] },
  'mirror-frame': frame,
  'mirror-shutters': shutters,
  'white-grid': white,
};

/** The seven reviewed specimens, with their original footprints and seeds. */
export function familyFixtures(): BuildingRequest[] {
  return Object.entries(references).map(([architecture, reference]) => {
    const footprint = reference.rectangle.map(point => [...point] as [number, number]);
    return {
      seed: reference.seed, buildingId: architecture, theme: 'cyberpunk',
      parcel: { footprint, accessPoint: [(footprint[0]![0] + footprint[1]![0]) / 2, footprint[0]![1]],
        maxHeight: reference.floorHeights.reduce((sum, height) => sum + height, 3) },
      building: { type: architecture === 'garden-taper' ? 'residential' : 'offices', tier: 'rich', floors: reference.floorHeights.length },
      options: { architecture: architecture as keyof typeof references, glb: 'named', balconies: 'off', facadeServices: 'off',
        roofArtifacts: 'off', adScreens: 'on', fireEscape: 'off', signage: null },
    };
  });
}
