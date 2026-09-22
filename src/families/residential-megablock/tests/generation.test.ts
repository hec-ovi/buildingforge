import { expect, it } from 'vitest';
import fixture from '../../../../fixtures/residential-megablock.request.json' with { type: 'json' };
import { generate } from '../../../generator.ts';

it('generates the full megablock reference within its budget while retaining authored floors, bays, and pane grids', async () => {
  const { blueprint, glb } = await generate(fixture, { textures: { mode: 'keys', source: null } });
  expect(glb.byteLength).toBeGreaterThan(0);
  expect(blueprint.geometry).toBeDefined();
  expect(blueprint.geometry!.triangles).toBeGreaterThan(0);
  expect(blueprint.geometry!.triangles).toBeLessThanOrEqual(blueprint.geometry!.budget.triangles);

  const assembly = blueprint.assembly!;
  expect(assembly.architecture).toBe('residential-megablock');
  expect(blueprint.floors).toHaveLength(fixture.building.floors);
  expect(assembly.floors).toHaveLength(fixture.building.floors);
  expect(assembly.groups.map(group => [group.fromFloor, group.toFloor])).toEqual([[0, 0], [1, 4], [5, 7]]);
  expect(blueprint.floors[0]!.openings.some(opening => opening.kind === 'door' && opening.doorRole === 'main')).toBe(true);

  for (const floor of blueprint.floors.filter(candidate => candidate.index > 0)) {
    const authored = assembly.floors.find(candidate => candidate.floor === floor.index)!;
    expect(floor.outline).toEqual(authored.outline);
    const windows = floor.openings.filter(opening => opening.kind === 'window');
    const bays = authored.sections.filter(section => section.technique === 'paired-glass');
    expect(bays.length).toBeGreaterThan(0);
    expect(windows).toHaveLength(bays.length * 2);
    for (const bay of bays) {
      const actual = windows.filter(window => window.sectionId === bay.id).sort((a, b) => a.offset - b.offset);
      expect(actual).toHaveLength(2);
      expect(bay.windows).toHaveLength(2);
      for (const [index, window] of actual.entries()) {
        const field = bay.windows![index]!;
        expect(window.panes).toEqual({ cols: 2, rows: 2 });
        expect(window.edge).toBe(bay.edge);
        expect(window.offset).toBeCloseTo(bay.offset + field.offset, 8);
        expect(window.width).toBeCloseTo(field.width, 8);
        expect(window.sill).toBeCloseTo(field.sill, 8);
        expect(window.height).toBeCloseTo(field.height, 8);
      }
    }
  }
}, 30_000);
