import { sectionSpans, sectionRoles, spanField } from '../src/sections/index.ts';
import { expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import { fixture, glbIO, keys, normalsOf } from './support.ts';

it('builds every published corner composition with exact opening fields', async () => {
  for (const name of ['architecture-01-rounded-corner', 'architecture-02-chamfered-corners', 'architecture-03-terrace-blocks']) {
  const request = fixture(name);
  const first = await generate(request, keys);
  const blueprint = first.blueprint, assembly = blueprint.assembly!;
  expect(assembly).toBeDefined();
  expect(blueprint.bounds.footprint).toEqual(assembly.floors[0]!.outline);
  for (const floor of blueprint.floors) {
    const plan = assembly.floors[floor.index]!;
    expect(floor.outline).toEqual(plan.outline);
    expect(floor.roomEnvelope!.width).toBeGreaterThan(0);
    for (const corner of floor.roomEnvelope!.corners) {
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const a = floor.outline[edge]!, b = floor.outline[(edge + 1) % floor.outline.length]!;
        const distance = ((b[0] - a[0]) * (corner[1] - a[1]) - (b[1] - a[1]) * (corner[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
        expect(distance).toBeGreaterThanOrEqual(blueprint.facade.wallDepth - 1e-6);
      }
    }
    expect(floor.openings).toHaveLength(plan.sections.filter(s => s.technique !== 'frame-pier').reduce((count, s) => count + sectionSpans(s).length, 0));
    for (const opening of floor.openings) {
      const section = plan.sections.find(s => s.id === opening.sectionId)!;
      expect(section).toBeDefined();
      const span = sectionSpans(section)[opening.sectionSpan ?? 0]!;
      const field = spanField(sectionRoles(section, floor.height).find(r => r.role === 'middle')!, span)!;
      expect(opening.edge).toBe(span.edge);
      expect(opening.offset).toBeCloseTo(field.offset, 7);
      expect(opening.width).toBeCloseTo(field.width, 7);
    }
  }
  const doc = await glbIO().readBinary(first.glb);
  const parts = doc.getRoot().listNodes().filter(n => n.getName().startsWith('section:'));
  expect(parts).toHaveLength(assembly.floors.reduce((count, floor) => count + floor.sections.length, 0));
  for (const node of parts) for (const primitive of node.getMesh()!.listPrimitives()) {
    const uv = primitive.getAttribute('TEXCOORD_0')!;
    if (request.options!.architecture !== 'chamfered-corners') expect(uv.getArray()!.every(value => value >= -1e-6 && value <= 1 + 1e-6)).toBe(true);
  }
  if (request.options!.architecture === 'terrace-blocks') {
    expect(assembly.groups.map(g => [g.width, g.depth])).toEqual([[30, 26], [26, 22], [22, 22]]);
    expect([...new Set(blueprint.balconyBands.map(b => b.floor))]).toEqual([2]);
    const terraces = doc.getRoot().listNodes().filter(n => n.getName().startsWith('terrace:'));
    expect(terraces.map(n => n.getName())).toEqual(['terrace:3', 'terrace:6']);
    for (const terrace of terraces) {
      const directions = terrace.getMesh()!.listPrimitives().flatMap(p => normalsOf(p).map(n => n[1]!));
      expect(directions.some(y => y < -0.99)).toBe(true);
      expect(directions.some(y => y > 0.99)).toBe(true);
    }
  } else {
    expect(assembly.extent).toEqual({ width: 34, depth: 30 });
    const cornerWindows = blueprint.floors[1]!.openings.filter(o => {
      const section = assembly.floors[1]!.sections.find(s => s.id === o.sectionId)!;
      return section.technique.endsWith('-glass');
    });
    expect(cornerWindows.length).toBe(request.options!.architecture === 'rounded-corner' ? 12 : 2);
    if (request.options!.architecture === 'rounded-corner') {
      expect(new Set(cornerWindows.map(o => o.sectionId)).size).toBe(4);
      const slice = cornerWindows.find(o => o.sectionSpan === 1)!;
      const frameParts = doc.getRoot().listNodes().find(n => n.getName() === `window:${slice.id}`)!.getMesh()!.listPrimitives()
        .filter(p => p.getMaterial()!.getName().includes('window-frame'));
      expect(frameParts.length).toBeGreaterThan(0);
      const bottom = blueprint.floors[1]!.elevation + slice.sill, top = bottom + slice.height;
      for (const primitive of frameParts) {
        const positions = primitive.getAttribute('POSITION')!;
        for (let i = 0; i < positions.getCount(); i++) {
          const y = positions.getElement(i, [] as number[])[1]!;
          expect(y < bottom + 0.061 || y > top - 0.061).toBe(true);
        }
      }
    }
  }
  }
});

it('rejects section compositions on aperture-bound faces without altering the input', async () => {
  const request = fixture('bridged-tower');
  request.options = { ...request.options, architecture: 'rounded-corner' };
  const before = structuredClone(request);
  await expect(generate(request, keys)).rejects.toMatchObject({ code: 'E_SCHEMA' });
  expect(request).toEqual(before);
});

it('exports full section maps with exact texture placement', async () => {
  const request = fixture('architecture-01-rounded-corner');
  request.building.floors = 3;
  const { glb } = await generate(request);
  const { glbJson } = await import('./support.ts');
  const json = glbJson(glb);
  const exact = json.materials.filter((m: any) => m.extras?.textureMapping === 'exact');
  expect(exact.length).toBeGreaterThan(0);
  for (const material of exact) {
    const info = material.pbrMetallicRoughness.baseColorTexture;
    expect(info.extensions?.KHR_texture_transform).toBeUndefined();
    const sampler = json.samplers[json.textures[info.index].sampler];
    expect(sampler.wrapS).toBe(33071);
    expect(sampler.wrapT).toBe(33071);
  }
});

it('keeps cut-facade catalog identities identical in keys and textured output', async () => {
  const request = fixture('architecture-02-chamfered-corners');
  request.building.floors = 3;
  const keyed = await generate(request, keys), textured = await generate(request);
  const { glbJson } = await import('./support.ts');
  const keyMaterials = glbJson(keyed.glb).materials;
  const textureMaterials = glbJson(textured.glb).materials;
  const ids = (materials: any[]) => materials.map(m => `${m.name}#${m.extras?.materialVariant ?? ''}`).sort();
  expect(ids(keyMaterials)).toEqual(ids(textureMaterials));
  const trim = textureMaterials.filter((m: any) => m.name.includes('/window-frame/'));
  expect(trim.length).toBeGreaterThan(0);
  expect(new Set(trim.map((m: any) => m.extras?.materialVariant))).toEqual(new Set(['paint', 'comb']));
  expect(trim.every((m: any) => m.extras.nativeMaterial === undefined)).toBe(true);
  for (const material of trim) {
    const scale = material.extras.materialVariant === 'comb' ? 1 / 0.64 : 2;
    expect(material.pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.scale).toEqual([scale, scale]);
  }
  expect(textureMaterials.some((m: any) => m.name.includes('/concrete-monolith/') && m.extras?.materialVariant === 'graphite')).toBe(true);
  for (const material of textureMaterials.filter((m: any) => m.name.includes('/concrete-monolith/') && !m.extras?.nativeMaterial)) {
    expect(material.pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.scale).toEqual([0.25, 0.25]);
  }
});
