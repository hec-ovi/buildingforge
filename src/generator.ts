// Orchestration: validate -> style -> massing -> floor stack -> facades ->
// features -> mesh -> GLB + blueprint.

import { validateRequest } from './core/validate.ts';
import { FAMILY } from './rules/families.ts';
import { buildStyle } from './layout/style.ts';
import { buildMassing } from './layout/massing.ts';
import { buildFloorStack } from './layout/floorStack.ts';
import { buildFacades } from './layout/facades.ts';
import { buildFeatures } from './layout/features.ts';
import { buildMesh } from './mesh/mesher.ts';
import { writeGlb } from './glb/writer.ts';
import { buildBlueprint } from './blueprint/builder.ts';
import { edgeLength, type P2 } from './core/polygon.ts';
import type { Layout } from './layout/model.ts';
import type { GenerateResult } from './types.ts';

export async function generate(raw: unknown): Promise<GenerateResult> {
  const req = validateRequest(raw);
  const family = FAMILY[req.building.type];
  const tier = req.building.tier;
  const style = buildStyle(req.seed, family, tier, req.building.floors);
  const massing = buildMassing(req, family, tier, style.balconyDepth);
  const stack = buildFloorStack(req, family, tier, style);
  const streetEdge = nearestEdge(massing.groundOutline, req.parcel.accessPoint);
  const facades = buildFacades(req, family, tier, style, massing, stack, streetEdge);
  const features = buildFeatures(req, family, tier, style, massing, stack.top, facades.floors, streetEdge);

  const layout: Layout = {
    request: req, family, tier, theme: req.theme, style, streetEdge,
    floors: facades.floors, carved: facades.carved, anchors: facades.anchors,
    ...features,
  };

  const mb = buildMesh(layout);
  const glb = await writeGlb(layout, mb);
  const blueprint = buildBlueprint(layout, mb);
  return { glb, blueprint };
}

function nearestEdge(outline: P2[], point: P2): number {
  let best = 0, bestD = Infinity;
  for (let e = 0; e < outline.length; e++) {
    const [x1, z1] = outline[e] as P2;
    const [x2, z2] = outline[(e + 1) % outline.length] as P2;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const d = (mx - point[0]) ** 2 + (mz - point[1]) ** 2;
    // Prefer longer edges on ties so a door never lands on a sliver.
    const score = d - edgeLength(outline, e) * 0.001;
    if (score < bestD) { bestD = score; best = e; }
  }
  return best;
}
