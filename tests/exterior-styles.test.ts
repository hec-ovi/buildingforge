import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import bindings from '../../materials/bindings/exterior-styles.json' with { type: 'json' };

const source = JSON.parse(readFileSync(new URL('../fixtures/corpo-tower.request.json', import.meta.url), 'utf8'));
const keys = { textures: { mode: 'keys' as const } };

it('exports all nine coordinated style bindings and their matching geometry through the public request', async () => {
  expect(bindings.styles).toHaveLength(9);
  const signatures = new Set<string>();
  for (const style of bindings.styles) {
    const request = {
      ...source,
      building: { type: style.group === 'residential' ? 'residential' : style.group === 'premium' ? 'corpo' : 'factory', tier: style.group === 'premium' ? 'high_rich' : 'poor', floors: 4 },
      options: { exteriorStyle: style.id, balconies: 'off', hangingClothes: 'off' },
    };
    const { blueprint, glb } = await generate(request, keys);
    expect(blueprint.facade.exteriorStyle).toBe(style.id);
    const selected = blueprint.materialVariants;
    for (const role of ['facade', 'border', 'frame', 'trim', 'glass', 'curtain', 'door', 'service'] as const) {
      const surface = style.surfaces[role];
      const key = `cyberpunk/${surface.kind}/${request.building.tier}`;
      if (blueprint.materials.includes(key)) expect(selected[key]).toBe(surface.variant);
    }
    const doc = await new NodeIO().readBinary(glb);
    for (const material of doc.getRoot().listMaterials()) {
      const key = material.getName();
      if (selected[key] && !material.getExtras().materialVariant) continue;
      if (material.getExtras().materialVariant !== 'strip') expect(material.getExtras().materialVariant).toBe(selected[key]);
    }
    const windows = blueprint.floors.flatMap((floor) => floor.openings).filter((opening) => opening.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((window) => window.material === `cyberpunk/${style.surfaces.glass.kind}/${request.building.tier}`)).toBe(true);
    if (style.surfaces.curtain.variant === 'slat') expect(windows.every((window) => window.curtain?.style === 'venetian-blind')).toBe(true);
    if (style.id === 'premium-mineral') expect(blueprint.floors[0]!.outline.length).toBeGreaterThanOrEqual(36);
    if (style.id === 'premium-obsidian') expect(blueprint.floors[0]!.outline).toHaveLength(4);
    signatures.add(JSON.stringify([blueprint.facade.style, blueprint.facade.materialPlan, selected]));
  }
  expect(signatures.size).toBe(9);
}, 15000);

it('validates explicit style IDs and preserves explicit sharp shapes within rounded styles', async () => {
  await expect(generate({ ...source, options: { exteriorStyle: 'unlisted' } }, keys)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  const { blueprint } = await generate({ ...source, options: { exteriorStyle: 'premium-mineral', shape: 'box' } }, keys);
  expect(blueprint.facade.exteriorStyle).toBe('premium-mineral');
  expect(blueprint.floors[0]!.outline).toHaveLength(4);
});
