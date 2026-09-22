import { describe, expect, it } from 'vitest';
import { Box3, Triangle, Vector3 } from 'three';
import type { Layout } from '../src/layout/model.ts';
import type { P2 } from '../src/types.ts';
import { meshConnectedFireEscape } from '../src/mesh/connectedFireEscape.ts';
import { MeshBuilder, type Part, type V3 } from '../src/mesh/primitives.ts';

const MATERIAL = 'cyberpunk/fire-escape/poor';
const OFFSET = 3;
const LANDING = 1.5;
const RUN = 11 * 0.28;
const WIDTH = 2 * LANDING + RUN;
const outline: P2[] = [[0, 0], [20, 0], [20, 15], [0, 15]];

function fixture(): Layout {
  return {
    floors: [0, 1, 2].map(index => ({
      index, kind: 'residential', elevation: 0.18 + index * 4.5, height: 4.5, outline,
      openings: [{ id: `access:${index}`, kind: 'door', edge: 0, offset: OFFSET + 0.2,
        width: 1.1, height: 2.2, sill: 0.02 }],
    })),
    fireEscape: {
      edge: 0, offset: OFFSET, width: WIDTH, fromFloor: 0, toFloor: 2,
      connected: {
        depth: 3.15, stairWidth: 1.2, landingDepth: LANDING,
        doorIds: ['access:0', 'access:1', 'access:2'],
        flights: [0, 1].map(index => ({ fromFloor: index, toFloor: index + 1,
          // Deliberately omit the door sill: the mesh must read the actual door.
          bottom: 0.18 + index * 4.5, top: 0.18 + (index + 1) * 4.5, steps: 12 })),
      },
    },
  } as Layout;
}

function build(layout = fixture()): MeshBuilder {
  const builder = new MeshBuilder();
  builder.floor = 91;
  meshConnectedFireEscape(builder, layout, () => MATERIAL);
  expect(builder.floor).toBe(91);
  return builder;
}

function topFaces(part: Part): { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[] {
  const tops = [];
  for (const primitive of part.prims.values()) {
    for (let vertex = 0; vertex < primitive.positions.length / 3; vertex += 4) {
      if (primitive.normals[vertex * 3 + 1]! < 0.999) continue;
      const points = Array.from({ length: 4 }, (_, corner) => primitive.positions.slice((vertex + corner) * 3, (vertex + corner + 1) * 3));
      tops.push({ minX: Math.min(...points.map(point => point[0]!)), maxX: Math.max(...points.map(point => point[0]!)),
        minZ: Math.min(...points.map(point => point[2]!)), maxZ: Math.max(...points.map(point => point[2]!)), y: points[0]![1]! });
    }
  }
  return tops;
}

/** Vertical intersection with all authored triangles, including the braces. */
function overheadClearance(builder: MeshBuilder, position: V3): number {
  let minimum = Infinity;
  for (const part of builder.parts) for (const primitive of part.prims.values()) {
    const point = (index: number): V3 => primitive.positions.slice(index * 3, index * 3 + 3) as V3;
    for (let i = 0; i < primitive.indices.length; i += 3) {
      const a = point(primitive.indices[i]!), b = point(primitive.indices[i + 1]!), c = point(primitive.indices[i + 2]!);
      const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(denominator) < 1e-9) continue;
      const s = ((b[2] - c[2]) * (position[0] - c[0]) + (c[0] - b[0]) * (position[2] - c[2])) / denominator;
      const t = ((c[2] - a[2]) * (position[0] - c[0]) + (a[0] - c[0]) * (position[2] - c[2])) / denominator;
      if (s < -1e-8 || t < -1e-8 || s + t > 1 + 1e-8) continue;
      const y = s * a[1] + t * b[1] + (1 - s - t) * c[1];
      if (y > position[1] + 1e-6) minimum = Math.min(minimum, y - position[1]);
    }
  }
  return minimum;
}

describe('connected fire escape mesh', () => {
  it('places flush door landings and two complete, open tread flights at every storey', () => {
    const builder = build();
    expect(builder.parts.every(part => part.sloped && part.floor !== undefined)).toBe(true);
    for (let index = 0; index <= 2; index++) {
      const part = builder.parts.find(part => part.name === `fire-escape:landing:${index}`)!;
      const deck = topFaces(part)[0]!;
      expect(deck.y).toBeCloseTo(0.20 + index * 4.5, 9);
      expect(deck.minX).toBeCloseTo(OFFSET);
      expect(deck.maxX).toBeCloseTo(OFFSET + LANDING);
      expect(deck.maxZ).toBe(0);
      expect(deck.minZ).toBeCloseTo(-3.15);
    }
    const flights = builder.parts.filter(part => part.name.endsWith(':treads'));
    expect(flights).toHaveLength(4);
    for (const flight of flights) {
      const tops = topFaces(flight);
      expect(tops).toHaveLength(11);
      const ascending = flight.name.includes(':outbound:');
      for (let step = 0; step < tops.length; step++) {
        const tread = tops[step]!;
        expect(tread.maxX - tread.minX).toBeCloseTo(0.28, 9);
        expect(tread.maxZ - tread.minZ).toBeCloseTo(1.2, 9);
        if (step) {
          expect(tread.y - tops[step - 1]!.y).toBeCloseTo(0.1875, 9);
          expect(ascending ? tread.minX - tops[step - 1]!.maxX : tops[step - 1]!.minX - tread.maxX).toBeCloseTo(0, 9);
        }
      }
      // A box per thin horizontal tread; no ramp or solid riser is present.
      const primitive = flight.prims.get(MATERIAL)!;
      expect(primitive.positions.length / 3).toBe(11 * 24);
      for (let offset = 0; offset < primitive.positions.length; offset += 72) {
        const heights = primitive.positions.slice(offset, offset + 72).filter((_, i) => i % 3 === 1);
        expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(0.045, 9);
      }
    }
    expect(builder.parts.flatMap(part => [...part.prims.values()].flatMap(prim => prim.positions)).every(Number.isFinite)).toBe(true);
  });

  it('keeps a clear 2.2m route over every tread, around both landings, and through each door', () => {
    const builder = build();
    const walkingPoints: V3[] = [];
    for (const part of builder.parts.filter(part => part.name.endsWith(':treads'))) {
      for (const tread of topFaces(part)) {
        for (const across of [0.2, 0.5, 0.8]) {
          walkingPoints.push([(tread.minX + tread.maxX) / 2, tread.y,
            tread.minZ + (tread.maxZ - tread.minZ) * across]);
        }
      }
    }
    for (let index = 0; index <= 2; index++) {
      for (const depth of [0, 0.35, 0.75, 1.4, 2.0, 2.65]) {
        walkingPoints.push([OFFSET + LANDING / 2, 0.20 + index * 4.5, -depth]);
      }
    }
    for (let index = 0; index < 2; index++) {
      for (const depth of [0.35, 0.75, 1.4, 2.0, 2.65]) {
        walkingPoints.push([OFFSET + WIDTH - LANDING / 2, 2.45 + index * 4.5, -depth]);
      }
    }
    for (const position of walkingPoints) expect(overheadClearance(builder, position), `clearance at ${position}`).toBeGreaterThanOrEqual(2.2);
  });

  it('opens a 1.1m street entry at ground level while retaining the upper outward guards', () => {
    const layout = fixture();
    for (const floor of layout.floors) floor.elevation -= 0.20;
    const builder = build(layout);
    const depth = layout.fireEscape!.connected!.depth;
    const intersectsEntry = (elevation: number): boolean => {
      const corridor = new Box3(new Vector3(OFFSET + 0.2, elevation + 1e-4, -depth - 0.1),
        new Vector3(OFFSET + 1.3, elevation + 2.2, -depth + 0.1));
      for (const part of builder.parts) for (const primitive of part.prims.values()) {
        for (let i = 0; i < primitive.indices.length; i += 3) {
          const vertices = [0, 1, 2].map(corner => new Vector3().fromArray(primitive.positions, primitive.indices[i + corner]! * 3));
          if (corridor.intersectsTriangle(new Triangle(vertices[0]!, vertices[1]!, vertices[2]!))) return true;
        }
      }
      return false;
    };
    expect(intersectsEntry(0)).toBe(false);
    expect(intersectsEntry(4.5)).toBe(true);
    expect(intersectsEntry(9)).toBe(true);
  });

  it('rejects disconnected doors and dimensions that cannot produce usable stairs', () => {
    const missingDoor = fixture();
    missingDoor.floors[1]!.openings = [];
    expect(() => build(missingDoor)).toThrow('no access door on floor 1');
    const missedDoor = fixture();
    missedDoor.floors[1]!.openings[0]!.offset += 2;
    expect(() => build(missedDoor)).toThrow('misses its floor landing');
    const narrow = fixture();
    narrow.fireEscape!.width -= 1;
    expect(() => build(narrow)).toThrow('rise or going limits');
    const steep = fixture();
    steep.floors[2]!.elevation += 0.5;
    expect(() => build(steep)).toThrow('rise or going limits');
  });
});
