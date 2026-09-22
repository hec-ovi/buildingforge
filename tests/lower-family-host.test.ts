import { describe, expect, it } from 'vitest';
import { generate, type BuildingRequest } from '../src/index.ts';
import { architectureSelections } from '../src/layout/architectureSelection.ts';
import { glbJson, keys } from './support.ts';

const families = ['residential-courtyard', 'residential-serviced', 'residential-megablock',
  'industrial-framed', 'industrial-solid', 'service-storage'] as const;

function request(architecture: typeof families[number], tier: BuildingRequest['building']['tier'] = 'poor'): BuildingRequest {
  const industrial = architecture.startsWith('industrial-') || architecture === 'service-storage';
  const floors = architecture === 'service-storage' ? 2 : 6;
  return { seed: `lower-family-${architecture}`, buildingId: architecture, theme: 'cyberpunk',
    parcel: { footprint: [[0, 0], [40, 0], [40, 32], [0, 32]], accessPoint: [20, -1], maxHeight: floors * 4.5 + 2 },
    building: { type: industrial ? 'factory' : 'residential', tier, floors },
    options: { architecture, glb: 'named', balconies: 'off', facadeServices: 'off', roofArtifacts: 'off', adScreens: 'off', signage: null } };
}

describe('lower-income reference families in the full generator', () => {
  for (const architecture of families) it(`${architecture} exports aligned openings, material roles and a valid circulation envelope`, async () => {
    const { blueprint, glb } = await generate(request(architecture), keys);
    expect(blueprint.assembly?.architecture).toBe(architecture);
    expect(blueprint.floors).toHaveLength(architecture === 'service-storage' ? 2 : 6);
    expect(blueprint.floors[0]!.openings.some(opening => opening.kind === 'door' && opening.doorRole === 'main')).toBe(true);
    expect(blueprint.floors.every(floor => floor.roomEnvelope!.width > 3 && floor.roomEnvelope!.depth > 3)).toBe(true);
    expect(blueprint.facade.materialPlan.field.key).toBe(architecture === 'industrial-framed'
      ? 'cyberpunk/concrete-monolith-graphite/mid' : 'cyberpunk/concrete-monolith/mid');
    // Distant-shell catalogs consume this exact binding, so the shared table
    // must not silently replace the roof variant with a wall's variant.
    const roof = blueprint.roof.material!;
    expect(blueprint.materials).toContain(roof.key);
    expect(blueprint.materialVariants[roof.key]).toBe(roof.variantId);
    expect(glbJson(glb).materials.filter((material: { name: string }) => material.name === roof.key)
      .map((material: { extras: { materialVariant: string } }) => material.extras.materialVariant))
      .toContain(roof.variantId);
    const names = glbJson(glb).nodes.map((node: { name: string }) => node.name) as string[];
    const windows = blueprint.floors.flatMap(floor => floor.openings.filter(opening => opening.kind === 'window'));
    expect(windows.length).toBeGreaterThan(0);
    for (const floor of blueprint.floors) for (const opening of floor.openings) {
      expect(opening.sill + opening.height).toBeLessThanOrEqual(floor.height);
      expect(opening.sectionId).toBeTruthy();
    }
    if (architecture === 'residential-courtyard') {
      const escape = blueprint.fireEscape!;
      expect(escape.connected).toBeDefined();
      expect(escape.fromFloor).toBe(0);
      expect(escape.connected!.flights).toHaveLength(5);
      for (const floor of blueprint.floors) {
        const door = floor.openings.find(opening => escape.connected!.doorIds.includes(opening.id))!;
        expect(door.kind).toBe('door'); expect(door.doorRole).toBe('service'); expect(door.sill).toBe(0);
        expect(door.offset).toBeGreaterThanOrEqual(escape.offset);
        expect(door.offset + door.width).toBeLessThanOrEqual(escape.offset + escape.connected!.landingDepth);
      }
      expect(names.some(name => name.startsWith('fire-escape:'))).toBe(true);
    }
  }, 30_000);

  it('selects new residential and industrial forms for actual poor and mid requests', () => {
    for (const tier of ['poor', 'mid'] as const) for (const architecture of families) {
      const input = request(architecture, tier); input.options!.architecture = 'auto';
      const selected = architectureSelections(input).map(choice => choice.selected);
      expect(selected).toContain(architecture);
      expect(selected).not.toContain('corporate-sectors');
    }
    const rich = request('residential-courtyard', 'rich'); rich.options!.architecture = 'auto';
    expect(architectureSelections(rich).some(choice => families.includes(choice.selected as typeof families[number]))).toBe(false);
  });
});
