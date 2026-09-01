// Orchestration: validate -> style -> massing -> floor stack -> facades ->
// features -> mesh -> GLB + blueprint.

import { validateRequest } from './core/validate.ts';
import { FAMILY } from './rules/families.ts';
import { FACADE } from './rules/tables.ts';
import {
  PROPORTIONS, clearHeight, isStorefrontFloor, minWindowHeight, proportionsOf,
} from './rules/proportions.ts';
import { buildStyle } from './layout/style.ts';
import { buildMassing } from './layout/massing.ts';
import { buildFloorStack } from './layout/floorStack.ts';
import { buildFacades } from './layout/facades.ts';
import { buildFeatures } from './layout/features.ts';
import { buildMesh } from './mesh/mesher.ts';
import { writeGlb } from './glb/writer.ts';
import { buildBlueprint } from './blueprint/builder.ts';
import { edgeLength, pointSegmentDistance, type P2 } from './core/polygon.ts';
import { ExteriorError } from './core/errors.ts';
import type { Layout } from './layout/model.ts';
import type { GenerateOptions, GenerateResult } from './types.ts';

export async function generate(raw: unknown, options: GenerateOptions = {}): Promise<GenerateResult> {
  const req = validateRequest(raw);
  const family = FAMILY[req.building.type];
  const tier = req.building.tier;
  const style = buildStyle(req.seed, family, tier, req.building.floors);
  const massing = buildMassing(req, family, tier, style.balconyDepth);
  const stack = buildFloorStack(req, family, tier, style);
  const streetEdges = entranceCandidates(massing.groundOutline, req.parcel.accessPoint);
  const facades = buildFacades(req, family, tier, style, massing, stack, streetEdges);
  const features = buildFeatures(req, family, tier, style, massing, stack.top, facades.floors, streetEdges[0] as number);

  const layout: Layout = {
    request: req, family, tier, theme: req.theme, style,
    floors: facades.floors, carved: facades.carved, anchors: facades.anchors,
    ...features,
  };
  checkInvariants(layout);

  const mb = buildMesh(layout);
  const { glb, textures } = await writeGlb(layout, mb, options.textures ?? {});
  const blueprint = buildBlueprint(layout, mb);
  return { glb, blueprint, textures };
}

/**
 * Entrance facades in preference order: edges long enough for a door zone
 * (>= 3 m, then >= 2.2 m, then any), each group sorted by true point-to-segment
 * distance from the access point, longer edge winning near-ties. A sliver edge
 * whose corner touches the access point never outranks the street facade.
 */
function entranceCandidates(outline: P2[], point: P2): number[] {
  const edges = outline.map((_, e) => ({
    e,
    len: edgeLength(outline, e),
    d: pointSegmentDistance(point, outline[e] as P2, outline[(e + 1) % outline.length] as P2),
  }));
  const rank = (a: typeof edges[0], b: typeof edges[0]) =>
    Math.abs(a.d - b.d) < 0.5 ? b.len - a.len : a.d - b.d;
  const long = edges.filter((x) => x.len >= 3).sort(rank);
  const mid = edges.filter((x) => x.len >= 2.2 && x.len < 3).sort(rank);
  const rest = edges.filter((x) => x.len < 2.2).sort(rank);
  return [...long, ...mid, ...rest].map((x) => x.e);
}

/**
 * Machine-checked coherence: every opening lies entirely inside its edge and its
 * floor, and every opening the proportion table covers is the size that table
 * promises.
 */
function checkInvariants(layout: Layout): void {
  checkProportions(layout);
  for (const floor of layout.floors) {
    for (const o of floor.openings) {
      const ok = o.edge < floor.outline.length
        && o.offset >= -1e-6
        && o.offset + o.width <= edgeLength(floor.outline, o.edge) + 1e-6;
      if (!ok) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} exceeds edge ${o.edge} on floor ${floor.index} (offset ${o.offset}, width ${o.width}, edge ${edgeLength(floor.outline, Math.min(o.edge, floor.outline.length - 1)).toFixed(2)} m); exterior bug, report with the request`);
      }
      if (o.sill + o.height > floor.height + 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} spans ${(o.sill + o.height).toFixed(2)} m in a ${floor.height.toFixed(2)} m floor ${floor.index}; exterior bug, report with the request`);
      }
    }
  }
}

/**
 * The proportion table is a promise: entrance doors stand in their family's
 * height range, punched windows reach their share of the floor's clear height on
 * a sill inside the range, and the small deep megablock window is the poor
 * tier's alone.
 */
function checkProportions(layout: Layout): void {
  const prop = proportionsOf(layout.family);
  const megablock = layout.style.facade.kind === 'megablock';
  const curtainWall = layout.style.facade.kind === 'curtain-wall';
  if (megablock && layout.tier !== PROPORTIONS.megablock.tier) {
    throw new ExteriorError('E_INVARIANT',
      `megablock windows on tier ${layout.tier}; the small deep window is the ${PROPORTIONS.megablock.tier} tier's alone`);
  }
  const fail = (why: string): never => {
    throw new ExteriorError('E_INVARIANT', `${why}; exterior bug, report with the request`);
  };

  for (const floor of layout.floors) {
    if (floor.index < 0) continue;
    const clear = clearHeight(floor.height);
    for (const o of floor.openings) {
      if (o.id === 'entrance') {
        const want = Math.min(prop.entrance[0], clear);
        if (o.height < want - 1e-6 || o.height > prop.entrance[1] + 1e-6) {
          fail(`entrance is ${o.height.toFixed(2)} m tall, outside ${want.toFixed(2)}..${prop.entrance[1]} m for ${layout.family}`);
        }
        continue;
      }
      if (o.kind !== 'window') continue;
      if (curtainWall) {
        // A curtain-wall bay hangs slab to slab: an opaque spandrel at the bottom
        // when it starts on the slab, vision glass the rest of the way up.
        if (Math.abs(o.sill + o.height - floor.height) > 1e-6) {
          fail(`curtain-wall bay ${o.id} spans ${(o.sill + o.height).toFixed(2)} m of a ${floor.height.toFixed(2)} m floor instead of reaching the slab above`);
        }
        if (o.height - (o.spandrel ?? 0) < FACADE.curtainWall.minBay - 1e-6) {
          fail(`curtain-wall bay ${o.id} carries ${(o.height - (o.spandrel ?? 0)).toFixed(2)} m of glass, under the ${FACADE.curtainWall.minBay} m minimum`);
        }
        continue;
      }
      if (megablock) continue;
      const storefront = floor.index === 0 && isStorefrontFloor(layout.family, floor.kind);
      const spec = storefront
        ? { ...prop, sill: PROPORTIONS.storefront.sill, windowHeight: PROPORTIONS.storefront.windowHeight }
        : prop;
      if (o.height < minWindowHeight(spec, clear) - 0.051) {
        fail(`window ${o.id} is ${o.height.toFixed(2)} m in a ${clear.toFixed(2)} m clear floor, under the ${spec.windowHeight[0]} share`);
      }
      if (o.sill > spec.sill[1] + 0.051) {
        fail(`window ${o.id} sits on a ${o.sill.toFixed(2)} m sill, over the ${spec.sill[1]} m limit`);
      }
    }
  }
}
