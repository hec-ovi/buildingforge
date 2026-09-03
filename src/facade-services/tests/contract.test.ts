import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateFacadeServices } from '../index.ts';
import type {
  FacadeServicesInput, FaceInput, NetworkNode, P3,
} from '../index.ts';

const load = (): FacadeServicesInput => JSON.parse(readFileSync(
  new URL('../fixtures/four-orientations.json', import.meta.url), 'utf8')) as FacadeServicesInput;

const faceKey = (face: { floor: number; edge: number }) => `${face.floor}:${face.edge}`;

function distance(a: P3, b: P3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function transformed(face: FaceInput, node: NetworkNode): P3 {
  return [
    face.origin[0] + face.tangent[0] * node.local[0] + face.normal[0] * node.local[2],
    face.origin[1] + node.local[1],
    face.origin[2] + face.tangent[2] * node.local[0] + face.normal[2] * node.local[2],
  ];
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

describe('facade-services contract', () => {
  it('is stable for a seed and changes stable selections with a different seed', () => {
    const input = load();
    const a = generateFacadeServices(input);
    const b = generateFacadeServices(input);
    const c = generateFacadeServices({ ...input, seed: 'facade-services-another-seed' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('transforms fitted networks on all four facade orientations', () => {
    const input = load();
    const output = generateFacadeServices(input);
    const pipes = output.networks.filter((network) => network.kind === 'pipe');
    expect(new Set(pipes.map((network) => network.face.edge))).toEqual(new Set([0, 1, 2, 3]));
    for (const network of output.networks) {
      const face = input.faces.find((candidate) => faceKey(candidate) === faceKey(network.face))!;
      for (const node of network.nodes) {
        expect(node.local[0]).toBeGreaterThanOrEqual(0);
        expect(node.local[0]).toBeLessThanOrEqual(face.length);
        expect(node.local[1]).toBeGreaterThanOrEqual(0);
        expect(node.local[1]).toBeLessThanOrEqual(face.height);
        expect(distance(node.position, transformed(face, node))).toBeLessThan(0.002);
      }
    }
  });

  it('connects exact equipment endpoints through dimensioned segments and wall supports', () => {
    const input = load();
    const output = generateFacadeServices(input);
    const targets = new Map([
      ...input.artifacts.map((item) => [item.id, {
        rect: item.rect,
        front: item.standoff + item.depth,
      }] as const),
      ...output.units.map((item) => [item.id, {
        rect: item.rect,
        front: item.standoff + item.size[2],
      }] as const),
    ]);
    for (const network of output.networks) {
      const nodes = new Map(network.nodes.map((node) => [node.id, node]));
      expect(network.nodes.filter((node) => node.kind === 'endpoint').length).toBeGreaterThanOrEqual(2);
      let total = 0;
      for (const segment of network.segments) {
        const a = nodes.get(segment.from)!;
        const b = nodes.get(segment.to)!;
        expect(segment.length).toBeCloseTo(distance(a.local, b.local), 3);
        total += segment.length;
      }
      expect(network.length).toBeCloseTo(total, 3);
      for (const endpoint of network.nodes.filter((node) => node.kind === 'endpoint')) {
        const target = targets.get(endpoint.targetId!);
        expect(target, endpoint.targetId).toBeDefined();
        expect(endpoint.local[0]).toBeGreaterThanOrEqual(target!.rect[0] - 1e-6);
        expect(endpoint.local[0]).toBeLessThanOrEqual(target!.rect[2] + 1e-6);
        expect(endpoint.local[1]).toBeGreaterThanOrEqual(target!.rect[1] - 1e-6);
        expect(endpoint.local[1]).toBeLessThanOrEqual(target!.rect[3] + 1e-6);
        expect(endpoint.local[2]).toBeCloseTo(target!.front, 6);
      }
      for (const support of network.supports) {
        expect(distance(support.position, support.wallPosition)).toBeCloseTo(support.local[2], 3);
        expect(network.segments.some((segment) => segment.id === support.segmentId)).toBe(true);
      }
    }
  });

  it('keeps services and clothes outside every opening reservation', () => {
    const input = load();
    const output = generateFacadeServices(input);
    const openings = input.reservations.filter((item) => item.kind === 'opening');
    for (const network of output.networks) {
      const nodes = new Map(network.nodes.map((node) => [node.id, node]));
      const radius = network.profile.shape === 'round' ? network.profile.diameter / 2 : network.profile.width / 2;
      for (const segment of network.segments) {
        const a = nodes.get(segment.from)!, b = nodes.get(segment.to)!;
        const rect: [number, number, number, number] = [
          Math.min(a.local[0], b.local[0]) - radius,
          Math.min(a.local[1], b.local[1]) - radius,
          Math.max(a.local[0], b.local[0]) + radius,
          Math.max(a.local[1], b.local[1]) + radius,
        ];
        for (const opening of openings.filter((item) => faceKey(item.face) === faceKey(network.face))) {
          expect(overlaps(rect, opening.rect), `${network.id}/${segment.id} crosses ${opening.id}`).toBe(false);
        }
      }
    }
    for (const line of output.clotheslines) {
      for (const opening of openings.filter((item) => faceKey(item.face) === faceKey(line.face))) {
        expect(overlaps(line.clearanceRect, opening.rect), `${line.id} crosses ${opening.id}`).toBe(false);
      }
      expect(line.supports[0]!.tip).toEqual(line.line[0]);
      expect(line.supports[1]!.tip).toEqual(line.line.at(-1));
      for (const support of line.supports) {
        expect(support.wallLocal[2]).toBe(0);
        expect(support.tipLocal[2]).toBeGreaterThan(0);
      }
    }
  });

  it('uses supplied database keys and remains inside every density and geometry budget', () => {
    const input = load();
    const output = generateFacadeServices(input);
    const allowed = new Set(Object.values(input.materials));
    const used = [
      ...output.units.map((item) => item.materialKey),
      ...output.networks.map((item) => item.materialKey),
      ...output.clotheslines.flatMap((line) => [line.lineMaterialKey, line.supportMaterialKey,
        ...line.items.map((item) => item.materialKey)]),
      ...output.damagedWindows.map((item) => item.materialKey),
    ];
    expect(used.every((key) => allowed.has(key))).toBe(true);
    for (const [name, count] of Object.entries(output.stats)) {
      const limitName = `max${name[0]!.toUpperCase()}${name.slice(1)}` as keyof typeof output.limits;
      expect(count, name).toBeLessThanOrEqual(output.limits[limitName]);
    }
  });

  it('keeps window damage opt-in, sparse, pane-bounded, and collision-explicit', () => {
    const input = load();
    const output = generateFacadeServices(input);
    expect(output.damagedWindows).toHaveLength(1);
    for (const damage of output.damagedWindows) {
      const window = input.windows.find((candidate) => candidate.openingId === damage.openingId)!;
      expect(damage.pane.col).toBeLessThan(window.panes.cols);
      expect(damage.pane.row).toBeLessThan(window.panes.rows);
      expect(damage.collision).toBe(damage.variant === 'missing-pane' ? 'open' : 'solid');
    }
    const off = generateFacadeServices({ ...input, modes: { ...input.modes, windowDamage: 'off' } });
    expect(off.damagedWindows).toHaveLength(0);
  });

  it('emits nothing when density and modes disable the optional detail', () => {
    const input = load();
    const output = generateFacadeServices({
      ...input,
      density: 0,
      modes: { services: 'off', clothes: 'off', windowDamage: 'off' },
    });
    expect(output).toMatchObject({
      units: [], networks: [], clotheslines: [], damagedWindows: [],
      stats: {
        networks: 0, segments: 0, supports: 0, units: 0, clotheslines: 0,
        clothItems: 0, damagedWindows: 0, triangles: 0, materialKeys: 0, drawCalls: 0,
      },
    });
  });

  it('rejects malformed face frames and invented material values', () => {
    const input = load();
    expect(() => generateFacadeServices({
      ...input,
      faces: [{ ...input.faces[0]!, normal: [0.5, 0, 0] }],
    })).toThrow(/facade-services input: invalid face/);
    expect(() => generateFacadeServices({
      ...input,
      materials: { ...input.materials, metal: 'plain metal' },
    })).toThrow(/materials must be database keys/);
  });
});
