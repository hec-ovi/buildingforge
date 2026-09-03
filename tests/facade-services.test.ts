import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/index.ts';
import type { BuildingRequest, FacadeArtifact, Floor, Opening } from '../src/index.ts';

const request = (name: string): BuildingRequest => JSON.parse(readFileSync(
  new URL(`../fixtures/${name}.request.json`, import.meta.url), 'utf8')) as BuildingRequest;

const KEYS = { textures: { mode: 'keys' as const } };

function overlap(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function artifactRect(artifact: FacadeArtifact): [number, number, number, number] {
  return [artifact.offset, artifact.sill, artifact.offset + artifact.size[0], artifact.sill + artifact.size[1]];
}

describe('public facade service integration', () => {
  it('publishes fitted AC pipe networks, service units, supports, and hanging clothes', async () => {
    const base = request('residential-mid');
    const { glb, blueprint } = await generate({
      ...base,
      options: {
        ...base.options,
        facadeServices: 'on',
        hangingClothes: 'on',
        windowDamage: 'sparse',
      },
    }, KEYS);
    const detail = blueprint.facadeServices;
    expect(detail.networks.some((network) => network.kind === 'pipe')).toBe(true);
    expect(detail.units.length).toBeGreaterThan(0);
    expect(detail.clotheslines.length).toBeGreaterThan(0);
    expect(detail.stats.supports).toBeGreaterThan(0);
    expect(detail.stats.drawCalls).toBeLessThanOrEqual(detail.limits.maxDrawCalls);

    const targets = new Map([
      ...blueprint.facadeArtifacts.map((artifact) => [artifact.id, {
        rect: artifactRect(artifact), front: (artifact.standoff ?? 0) + artifact.size[2],
      }] as const),
      ...detail.units.map((unit) => [unit.id, {
        rect: unit.rect, front: unit.standoff + unit.size[2],
      }] as const),
    ]);
    for (const network of detail.networks) {
      for (const endpoint of network.nodes.filter((node) => node.kind === 'endpoint')) {
        const target = targets.get(endpoint.targetId!);
        expect(target, endpoint.targetId).toBeDefined();
        expect(endpoint.local[0]).toBeGreaterThanOrEqual(target!.rect[0] - 1e-6);
        expect(endpoint.local[0]).toBeLessThanOrEqual(target!.rect[2] + 1e-6);
        expect(endpoint.local[1]).toBeGreaterThanOrEqual(target!.rect[1] - 1e-6);
        expect(endpoint.local[1]).toBeLessThanOrEqual(target!.rect[3] + 1e-6);
        expect(endpoint.local[2]).toBeCloseTo(target!.front, 6);
      }
    }
    for (const line of detail.clotheslines) {
      expect(line.line[0]).toEqual(line.supports[0]!.tip);
      expect(line.line.at(-1)).toEqual(line.supports[1]!.tip);
      const floor = blueprint.floors.find((candidate) => candidate.index === line.face.floor)!;
      for (const opening of floor.openings.filter((item) => item.edge === line.face.edge)) {
        const rect: [number, number, number, number] = [
          opening.offset, opening.sill, opening.offset + opening.width, opening.sill + opening.height,
        ];
        expect(overlap(line.clearanceRect, rect), `${line.id} crosses ${opening.id}`).toBe(false);
      }
    }
    expect(blueprint.materials).toContain('cyberpunk/metal/mid');
    expect(blueprint.materials).toContain('cyberpunk/fabric/mid');
    const doc = await new NodeIO().readBinary(glb);
    expect(doc.getRoot().listNodes().some((node) => node.getName() === 'facade-services')).toBe(true);
  });

  it('fits an industrial duct between attached junction units', async () => {
    const base = request('factory');
    const { blueprint } = await generate({
      ...base,
      options: { ...base.options, facadeServices: 'on', hangingClothes: 'off' },
    }, KEYS);
    const duct = blueprint.facadeServices.networks.find((network) => network.kind === 'duct');
    expect(duct).toBeDefined();
    expect(duct!.profile).toEqual({ shape: 'rect', width: 0.22, depth: 0.16 });
    const endpoints = duct!.nodes.filter((node) => node.kind === 'endpoint');
    expect(endpoints).toHaveLength(2);
    expect(endpoints.every((node) => blueprint.facadeServices.units.some((unit) => unit.id === node.targetId))).toBe(true);
  });

  it('keeps every service corridor and line outside facade apertures', async () => {
    const base = request('residential-mid');
    const { blueprint } = await generate({
      ...base,
      options: { ...base.options, facadeServices: 'on', hangingClothes: 'on' },
    }, KEYS);
    for (const network of blueprint.facadeServices.networks) {
      const floor = blueprint.floors.find((candidate) => candidate.index === network.face.floor)!;
      const nodes = new Map(network.nodes.map((node) => [node.id, node]));
      const radius = network.profile.shape === 'round' ? network.profile.diameter / 2 : network.profile.width / 2;
      for (const segment of network.segments) {
        const a = nodes.get(segment.from)!, b = nodes.get(segment.to)!;
        const route: [number, number, number, number] = [
          Math.min(a.local[0], b.local[0]) - radius,
          Math.min(a.local[1], b.local[1]) - radius,
          Math.max(a.local[0], b.local[0]) + radius,
          Math.max(a.local[1], b.local[1]) + radius,
        ];
        for (const opening of floor.openings.filter((item) => item.edge === network.face.edge)) {
          const aperture: [number, number, number, number] = [
            opening.offset, opening.sill, opening.offset + opening.width, opening.sill + opening.height,
          ];
          expect(overlap(route, aperture), `${network.id}/${segment.id} crosses ${opening.id}`).toBe(false);
        }
      }
    }
  });

  it('leaves windows intact by default and emits an explicit open missing-pane variant', async () => {
    const base = request('residential-mid');
    const intact = await generate({
      ...base,
      options: { ...base.options, facadeServices: 'off', hangingClothes: 'off' },
    }, KEYS);
    expect(intact.blueprint.facadeServices.damagedWindows).toHaveLength(0);
    expect(intact.blueprint.floors.flatMap((floor: Floor) => floor.openings)
      .every((opening: Opening) => opening.damage === undefined)).toBe(true);

    const damaged = await generate({
      ...base,
      seed: 'damage-1',
      options: {
        ...base.options,
        facadeServices: 'off',
        hangingClothes: 'off',
        windowDamage: 'sparse',
      },
    }, KEYS);
    expect(damaged.blueprint.facadeServices.damagedWindows).toHaveLength(1);
    const state = damaged.blueprint.facadeServices.damagedWindows[0]!;
    expect(state).toMatchObject({ variant: 'missing-pane', collision: 'open' });
    const owner = damaged.blueprint.floors.find((floor) => floor.index === state.face.floor)!;
    expect(owner.openings.find((opening) => opening.id === state.openingId)!.damage)
      .toEqual({ pane: state.pane, variant: state.variant, collision: state.collision });
    const doc = await new NodeIO().readBinary(damaged.glb);
    const node = doc.getRoot().listNodes().find((candidate) => candidate.getName() === `window:${state.openingId}`)!;
    const glass = node.getMesh()!.listPrimitives()
      .find((primitive) => primitive.getMaterial()!.getName() === state.materialKey)!;
    expect(glass.getAttribute('POSITION')!.getCount(), 'the selected pane is individually rebuilt').toBeGreaterThan(4);
  });
});
