// Blueprint JSON from the layout; shapes mirror schemas/blueprint.schema.json.

import type { Blueprint } from '../types.ts';
import type { Layout } from '../layout/model.ts';
import type { MeshBuilder } from '../mesh/primitives.ts';

export function buildBlueprint(layout: Layout, mb: MeshBuilder): Blueprint {
  const topFloor = layout.floors[layout.floors.length - 1]!;
  return {
    buildingId: layout.request.buildingId,
    seed: layout.request.seed,
    bounds: {
      footprint: layout.floors.find((f) => f.index === 0)!.outline,
      height: topFloor.elevation + topFloor.height + layout.roof.parapetHeight,
    },
    floors: layout.floors.map((f) => ({
      index: f.index,
      kind: f.kind,
      elevation: f.elevation,
      height: f.height,
      outline: f.outline,
      openings: f.openings,
    })),
    anchors: layout.anchors.map(({ id, position, normal }) => ({ id, position, normal })),
    signage: layout.signage,
    screens: layout.screens,
    lights: layout.lights,
    facade: { style: layout.style.facade.kind, panelModule: layout.style.facade.panelModule },
    facadeArtifacts: layout.facadeArtifacts,
    fireEscape: layout.fireEscape,
    roof: layout.roof,
    materials: mb.materialKeys(),
  };
}
