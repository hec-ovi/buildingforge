import { edgeDir, edgeNormal, type P2 } from '../core/polygon.ts';
import type { Layout } from '../layout/model.ts';
import { AC_UNITS } from '../rules/tables.ts';
import type { MeshBuilder, PartSink, V3 } from './primitives.ts';
import { materialSlot } from '../materials/slot.ts';

interface Frame {
  v: P2;
  dir: P2;
  n: P2;
}

/** Builds a recognizable wall condenser: casing, recessed grille face and steel bracket. */
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

    sink.box(materialSlot(metal, undefined, 'ac-enamel'), at(fr, centerU, base + height / 2, back + depth / 2),
      across(width / 2), [0, height / 2, 0], outward(depth / 2));
    const grilleFront = back + depth + grille.proud;
    const u0 = artifact.offset + grille.inset, u1 = artifact.offset + width - grille.inset;
    const y0 = base + grille.inset, y1 = base + height - grille.inset;
    sink.box(metal, at(fr, centerU, base + height / 2, grilleFront - grille.proud / 2),
      across(width / 2 - grille.inset), [0, height / 2 - grille.inset, 0], outward(grille.proud / 2));
    sink.quadFacing(mat('ac-unit'), at(fr, u0, y0, grilleFront + 0.001),
      at(fr, u1, y0, grilleFront + 0.001), at(fr, u1, y1, grilleFront + 0.001),
      at(fr, u0, y1, grilleFront + 0.001), [fr.n[0], 0, fr.n[1]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
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

function at(fr: Frame, u: number, y: number, proud: number): V3 {
  return [
    fr.v[0] + fr.dir[0] * u + fr.n[0] * proud,
    y,
    fr.v[1] + fr.dir[1] * u + fr.n[1] * proud,
  ];
}
