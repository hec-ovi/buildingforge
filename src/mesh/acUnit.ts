import { edgeDir, edgeNormal, type P2 } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import { AC_UNITS } from '../rules/tables.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';
import { tubeSegment } from './tube.ts';

interface Frame {
  v: P2;
  dir: P2;
  n: P2;
}

const FAN_SEGMENTS = 16;

/** Builds a recognizable wall condenser: casing, recessed grille, fan, guard, and steel bracket. */
export function meshAcUnits(
  mb: MeshBuilder, layout: Layout, mat: (kind: string) => string,
): void {
  const units = layout.facadeArtifacts.filter((artifact) => artifact.kind === 'ac-unit');
  if (units.length === 0) return;
  const sink = mb.part('facade-ac');
  const byFloor = new Map(layout.floors.map((floor) => [floor.index, floor]));
  const metal = mat('metal');
  const { grille, bracket } = AC_UNITS;

  for (const artifact of units) {
    const floor = byFloor.get(artifact.floor);
    if (!floor) continue;
    const fr: Frame = {
      v: floor.outline[artifact.edge] as P2,
      dir: edgeDir(floor.outline, artifact.edge),
      n: edgeNormal(floor.outline, artifact.edge),
    };
    const [width, height, depth] = artifact.size;
    const back = artifact.standoff ?? 0;
    const centerU = artifact.offset + width / 2;
    const base = floor.elevation + artifact.sill;
    const across = (half: number): V3 => [fr.dir[0] * half, 0, fr.dir[1] * half];
    const outward = (half: number): V3 => [fr.n[0] * half, 0, fr.n[1] * half];

    sink.box(metal, at(fr, centerU, base + height / 2, back + depth / 2),
      across(width / 2), [0, height / 2, 0], outward(depth / 2));
    const grilleFront = back + depth + grille.proud;
    sink.box(mat('ac-unit'), at(fr, centerU, base + height / 2, grilleFront - grille.proud / 2),
      across(width / 2 - grille.inset), [0, height / 2 - grille.inset, 0],
      outward(grille.proud / 2), 'exact');
    meshFan(sink, metal, fr, centerU, base + height / 2, grilleFront + 0.012,
      Math.min(width, height) * 0.31);

    sink.box(metal, at(fr, centerU, base - bracket.shelf / 2, back + depth / 2),
      across(width / 2), [0, bracket.shelf / 2, 0], outward(depth / 2), 'along');
    for (const side of [-1, 1]) {
      const u = centerU + side * (width / 2 - bracket.strut);
      sink.slantedBox(metal,
        at(fr, u, base - bracket.shelf - bracket.drop, back),
        at(fr, u, base - bracket.shelf, back + depth),
        across(1), bracket.strut, bracket.strut);
    }
  }
}

function meshFan(
  sink: PartSink, material: string, fr: Frame,
  centerU: number, centerY: number, front: number, radius: number,
): void {
  const point = (u: number, y: number, proud = 0): V3 =>
    at(fr, centerU + u, centerY + y, front + proud);
  for (let index = 0; index < FAN_SEGMENTS; index++) {
    const a = index * Math.PI * 2 / FAN_SEGMENTS;
    const b = (index + 1) * Math.PI * 2 / FAN_SEGMENTS;
    tubeSegment(sink, material,
      point(Math.cos(a) * radius, Math.sin(a) * radius),
      point(Math.cos(b) * radius, Math.sin(b) * radius), 0.018);
  }
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    tubeSegment(sink, material, point(0, 0, 0.008),
      point(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.008), 0.009);
  }
  const tangent: V3 = [fr.dir[0], 0, fr.dir[1]];
  for (let index = 0; index < 5; index++) {
    const angle = index * Math.PI * 2 / 5;
    const radialU = Math.cos(angle);
    const radialY = Math.sin(angle);
    const start = point(radialU * radius * 0.12, radialY * radius * 0.12, -0.006);
    const end = point(radialU * radius * 0.72, radialY * radius * 0.72, -0.006);
    const bladeWidth: V3 = [
      tangent[0] * -radialY,
      radialU,
      tangent[2] * -radialY,
    ];
    sink.slantedBox(material, start, end, bladeWidth, radius * 0.2, 0.012);
  }
  sink.box(material, point(0, 0, 0.014),
    [fr.dir[0] * radius * 0.09, 0, fr.dir[1] * radius * 0.09],
    [0, radius * 0.09, 0],
    [fr.n[0] * 0.025, 0, fr.n[1] * 0.025]);
}

function at(fr: Frame, u: number, y: number, proud: number): V3 {
  return [
    fr.v[0] + fr.dir[0] * u + fr.n[0] * proud,
    y,
    fr.v[1] + fr.dir[1] * u + fr.n[1] * proud,
  ];
}
