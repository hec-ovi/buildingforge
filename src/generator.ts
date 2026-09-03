// Orchestration: validate -> style -> massing -> floor stack -> facades ->
// features -> mesh -> GLB + blueprint.

import { validateRequest } from './core/validate.ts';
import { FAMILY } from './rules/families.ts';
import { FACADE, MODULE, MODULE_U, OPENING, SLAB_BAND } from './rules/tables.ts';
import { onModule } from './layout/module.ts';
import {
  PROPORTIONS, clearHeight, isStorefrontFloor, minEntranceHeight, minWindowHeight, proportionsOf,
} from './rules/proportions.ts';
import { buildStyle } from './layout/style.ts';
import { buildMassing } from './layout/massing.ts';
import { coreAxis } from './layout/plate.ts';
import { buildFloorStack } from './layout/floorStack.ts';
import { buildFacades } from './layout/facades.ts';
import { buildRelief } from './layout/relief.ts';
import { mountAnchors } from './layout/anchors.ts';
import { crossed, edgeU, faceObstacles, type Rect } from './layout/obstructions.ts';
import { bestCoreFit, coreRects, facadeDepth } from './layout/core.ts';
import { acClusterName } from './layout/acUnits.ts';
import { buildFeatures } from './layout/features.ts';
import { buildMesh } from './mesh/mesher.ts';
import { writeGlb } from './glb/writer.ts';
import { buildBlueprint } from './blueprint/builder.ts';
import { area, edgeLength, pointSegmentDistance, type P2 } from './core/polygon.ts';
import { ExteriorError } from './core/errors.ts';
import type { FloorLayout, Layout } from './layout/model.ts';
import type { GenerateOptions, GenerateResult, P3 } from './types.ts';

export async function generate(raw: unknown, options: GenerateOptions = {}): Promise<GenerateResult> {
  const req = validateRequest(raw);
  const family = FAMILY[req.building.type];
  const tier = req.building.tier;
  const style = buildStyle(req.seed, family, tier, req.building.floors);
  const facadeInset = facadeDepth(style.facade.kind);
  const stack = buildFloorStack(req, family, tier, style);
  const massing = buildMassing(
    req, family, tier, style.balconyDepth, facadeInset, stack.levels.map((floor) => floor.height));
  const streetEdges = entranceCandidates(massing.groundOutline, req.parcel.accessPoint);
  const facades = buildFacades(req, family, tier, style, massing, stack, streetEdges);
  const corePlate = inspectCorePlate(
    facades.floors, facadeInset, facades.floors.filter((floor) => floor.index >= 0).length);
  const relief = buildRelief(style, facades.floors, facades.carved);
  const obstacles = faceObstacles(facades.floors, facades.carved, facades.anchors, relief, stack.top);
  const anchors = mountAnchors(facades.anchors, massing.groundOutline, obstacles);
  const features = buildFeatures(
    req, family, tier, style, massing, stack.top, facades.floors, streetEdges, obstacles, corePlate.axis);

  const layout: Layout = {
    request: req, family, tier, theme: req.theme, style, relief,
    floors: facades.floors, carved: facades.carved, anchors,
    ...features,
  };
  checkInvariants(layout, obstacles);

  const mb = buildMesh(layout);
  const blueprint = buildBlueprint(layout, mb);
  if (corePlate.error) throw corePlate.error;
  const { glb, textures } = await writeGlb(layout, mb, options.textures ?? {});
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
function checkInvariants(layout: Layout, obstacles: Map<number, Rect[]>): void {
  checkProportions(layout);
  checkSlabBands(layout);
  checkOverlays(layout, obstacles);
  checkFacadeArtifacts(layout, obstacles);
  for (const sign of layout.signage) {
    if (sign.mode !== 'marquee') continue;
    const cell = sign.cellSize ?? 0;
    const letter = sign.letterHeight ?? 0;
    const casing = sign.glyphCase;
    if (!casing || cell <= 0 || letter <= 0 || casing.size > cell + 1e-6
      || casing.size <= letter || casing.depth <= 0 || casing.inset < 0
      || casing.inset >= casing.depth) {
      throw new ExteriorError('E_INVARIANT',
        'marquee glyph casing does not fit its letter cell; exterior bug, report with the request');
    }
  }
  for (const floor of layout.floors) {
    for (const o of floor.openings) {
      const isDoor = o.kind === 'door' || o.kind === 'balconyDoor';
      if (isDoor !== (o.door !== undefined)) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} has an inconsistent door assembly on floor ${floor.index}; exterior bug, report with the request`);
      }
      if (o.kind === 'door' && o.doorRole === undefined) {
        throw new ExteriorError('E_INVARIANT',
          `door ${o.id} has no navigation role on floor ${floor.index}; exterior bug, report with the request`);
      }
      if (o.kind !== 'door' && o.doorRole !== undefined) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} publishes a door role but is ${o.kind}; exterior bug, report with the request`);
      }
      if (o.door) {
        const expectedClear = o.door.motion.kind === 'swing' ? o.width / Math.max(1, o.leaves ?? 1) : 0;
        const valid = o.door.frameWidth > 0 && o.door.frameDepth > 0 && o.door.recessDepth >= 0
          && o.door.thresholdHeight === o.sill
          && Math.abs(o.door.motion.clearDepth - expectedClear) <= 0.051;
        if (!valid) {
          throw new ExteriorError('E_INVARIANT',
            `door ${o.id} has a frame or movement envelope inconsistent with its opening; exterior bug, report with the request`);
        }
      }
      const ok = o.edge < floor.outline.length
        && o.offset >= -1e-6
        && o.offset + o.width <= edgeLength(floor.outline, o.edge) + 1e-6;
      if (!ok) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} exceeds edge ${o.edge} on floor ${floor.index} (offset ${o.offset}, width ${o.width}, edge ${edgeLength(floor.outline, Math.min(o.edge, floor.outline.length - 1)).toFixed(2)} m); exterior bug, report with the request`);
      }
      const top = o.sill + o.height + (o.transom ? FACADE.curtainWall.transomGap + o.transom : 0);
      if (top > floor.height + 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `opening ${o.id} spans ${top.toFixed(2)} m in a ${floor.height.toFixed(2)} m floor ${floor.index}; exterior bug, report with the request`);
      }
    }
    checkEdgeRuns(floor);
  }
}

/**
 * Every plate holds a core: the interior lays its stairs, lifts and risers in
 * one rectangle behind the facade, so every floor, ground and setbacks alike,
 * has to host the rectangle its type and floor count call for. A lot that
 * cannot is named here rather than at assembly.
 */
function inspectCorePlate(
  floors: FloorLayout[], facadeInset: number, aboveGround: number,
): { axis: P2; error: ExteriorError | null } {
  const ground = floors.find((f) => f.index === 0)!.outline;
  const principalAxis = coreAxis(ground);
  const rects = coreRects(floors.map((floor) => floor.height), aboveGround, area(ground));
  const { fits, reached, axis } = bestCoreFit(
    floors.map((floor) => floor.outline), principalAxis, facadeInset, rects);
  if (fits) return { axis, error: null };
  return {
    axis,
    error: new ExteriorError('E_CORE_PLATE',
      `the shared core reaches ${reached.band.toFixed(2)} m of plate, under the ${reached.rect.length} x ${reached.rect.depth} m a ${reached.rect.mode} needs`,
      { band: reached.band, needs: [reached.rect.length, reached.rect.depth], mode: reached.rect.mode }),
  };
}

/**
 * One opening owns one stretch of an edge: two openings on the same floor and
 * edge never share any of it, whatever their heights, and consumers can read the
 * facade as a run of exclusive intervals.
 */
function checkEdgeRuns(floor: Layout['floors'][number]): void {
  const byEdge = new Map<number, Layout['floors'][number]['openings']>();
  for (const o of floor.openings) {
    const list = byEdge.get(o.edge) ?? [];
    list.push(o);
    byEdge.set(o.edge, list);
  }
  for (const [edge, list] of byEdge) {
    const sorted = [...list].sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!, cur = sorted[i]!;
      if (cur.offset < prev.offset + prev.width - 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `openings ${prev.id} and ${cur.id} overlap on edge ${edge} of floor ${floor.index}; exterior bug, report with the request`);
      }
    }
  }
}

/**
 * Nothing overlaid on a facade sits on its structure: every sign and every ad
 * screen keeps clear of the columns, ribs, floor bands and openings already on
 * that face.
 */
function checkOverlays(layout: Layout, obstacles: Map<number, Rect[]>): void {
  const ground = layout.floors.find((f) => f.index === 0);
  if (!ground) return;
  const check = (what: string, edge: number, center: P3, width: number, height: number, standoff: number) => {
    const u = edgeU(ground.outline, edge, center[0], center[2]);
    const rect: Rect = {
      u0: u - width / 2, u1: u + width / 2, y0: center[1] - height / 2, y1: center[1] + height / 2,
      what, kind: 'relief', depth: standoff,
    };
    for (const o of crossed(obstacles.get(edge), rect)) {
      if (o.kind === 'opening') {
        throw new ExteriorError('E_INVARIANT',
          `${what} on edge ${edge} covers ${o.what}; exterior bug, report with the request`);
      }
      if (standoff < o.depth - 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `${what} on edge ${edge} stands ${standoff.toFixed(2)} m off the wall and runs into ${o.what} at ${o.depth.toFixed(2)} m; exterior bug, report with the request`);
      }
    }
  };
  layout.signage.forEach((s, i) => check(`signage:${i}`, s.edge, s.center, s.width, s.height, s.standoff));
  layout.screens.forEach((s, i) => check(`screen:${i}`, s.edge, s.center, s.width, s.height, s.standoff));
}

/**
 * The slab line reads solid: every pane of glass starts above the band the
 * facade keeps over its own floor line and stops below the band it keeps under
 * the next one, so an interior slab seen through the glazing sits inside opaque
 * facade instead of floating between two window rows.
 */
function checkSlabBands(layout: Layout): void {
  const above = layout.style.facade.kind === 'curtain-wall' ? SLAB_BAND.below : 0;
  for (const floor of layout.floors) {
    if (floor.index < 0) continue;
    for (const o of floor.openings) {
      if (o.kind !== 'window') continue;
      const glassLow = o.sill + (o.spandrel ?? 0);
      const glassHigh = o.sill + o.height - (o.head ?? 0);
      if (glassLow < above - 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `window ${o.id} on floor ${floor.index} starts ${glassLow.toFixed(2)} m over its floor line, inside the ${above} m band the facade keeps there; exterior bug, report with the request`);
      }
      if (glassHigh > floor.height - SLAB_BAND.below + 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `window ${o.id} on floor ${floor.index} reaches ${glassHigh.toFixed(2)} m of a ${floor.height.toFixed(2)} m floor, into the ${SLAB_BAND.below} m band under the slab above; exterior bug, report with the request`);
      }
    }
  }
}

/**
 * Nothing hung on a facade covers an opening or a window: every condenser unit
 * and every utility box lies inside its edge and its floor and sits on wall,
 * standing proud of any relief it crosses.
 */
function checkFacadeArtifacts(layout: Layout, obstacles: Map<number, Rect[]>): void {
  const byFloor = new Map(layout.floors.map((f) => [f.index, f]));
  for (const a of layout.facadeArtifacts) {
    const floor = byFloor.get(a.floor);
    if (!floor) continue;
    const [w, h] = a.size;
    const L = edgeLength(floor.outline, a.edge);
    const what = `${a.kind} on edge ${a.edge} of floor ${a.floor}`;
    if (a.offset < -1e-6 || a.offset + w > L + 1e-6 || a.sill < -1e-6 || a.sill + h > floor.height + 1e-6) {
      throw new ExteriorError('E_INVARIANT',
        `${what} (offset ${a.offset}, sill ${a.sill}) leaves its ${L.toFixed(2)} x ${floor.height.toFixed(2)} m face; exterior bug, report with the request`);
    }
    const standoff = a.standoff ?? 0;
    const rect: Rect = {
      u0: a.offset, u1: a.offset + w,
      y0: floor.elevation + a.sill, y1: floor.elevation + a.sill + h,
      what, kind: 'relief', depth: standoff,
    };
    const own = acClusterName(a.floor, a.edge);
    for (const o of crossed(obstacles.get(a.edge), rect)) {
      if (o.what === own) continue; // the unit's own cluster, registered when it landed
      if (o.kind !== 'relief') {
        throw new ExteriorError('E_INVARIANT',
          `${what} covers ${o.what}; exterior bug, report with the request`);
      }
      if (standoff < o.depth - 1e-6) {
        throw new ExteriorError('E_INVARIANT',
          `${what} stands ${standoff.toFixed(2)} m off the wall and runs into ${o.what} at ${o.depth.toFixed(2)} m; exterior bug, report with the request`);
      }
    }
  }
}

/**
 * The proportion table is a promise: entrance doors stand in their family's
 * height range at the standard width, punched windows reach their share of the
 * floor's clear height on a sill inside the range, a storefront reaches the
 * head band on a low sill, and the small deep megablock window is the poor
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
    const storefront = floor.index === 0 && isStorefrontFloor(layout.family, floor.kind);
    for (const o of floor.openings) {
      if (o.id === 'entrance') {
        const want = minEntranceHeight(prop, clear);
        if (o.height < want - 1e-6 || o.height > prop.entrance[1] + 1e-6) {
          fail(`entrance is ${o.height.toFixed(2)} m tall, outside ${want.toFixed(2)}..${prop.entrance[1]} m for ${layout.family}`);
        }
        // an entrance is whole metres wide: the least its edge allows, on the module
        const minWidth = onModule(Math.min(PROPORTIONS.entranceWidth.standard[0], edgeLength(floor.outline, o.edge) - 2 * OPENING.cornerMargin), 'down', MODULE_U);
        if (o.width < minWidth - 0.051) {
          fail(`entrance is ${o.width.toFixed(2)} m wide, under the ${minWidth.toFixed(2)} m its edge allows`);
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
        const glass = o.height - (o.spandrel ?? 0) - (o.head ?? 0);
        if (glass < FACADE.curtainWall.minBay - 1e-6) {
          fail(`curtain-wall bay ${o.id} carries ${glass.toFixed(2)} m of glass, under the ${FACADE.curtainWall.minBay} m minimum`);
        }
        continue;
      }
      if (storefront) {
        if (o.sill > PROPORTIONS.storefront.sill[1] + 1e-6) {
          fail(`storefront window ${o.id} sits on a ${o.sill.toFixed(2)} m sill, over the ${PROPORTIONS.storefront.sill[1]} m limit`);
        }
        if (o.sill + o.height < clear - 0.051) {
          fail(`storefront window ${o.id} stops at ${(o.sill + o.height).toFixed(2)} m in a ${clear.toFixed(2)} m clear floor instead of reaching the head band`);
        }
        continue;
      }
      if (megablock) continue;
      // Openings sit on the module grid, so a proportion is met to the nearest half module.
      if (o.height < minWindowHeight(prop, clear) - MODULE / 2 - 1e-6) {
        fail(`window ${o.id} is ${o.height.toFixed(2)} m in a ${clear.toFixed(2)} m clear floor, under the ${prop.windowHeight[0]} share`);
      }
      if (o.sill > prop.sill[1] + MODULE / 2 + 1e-6) {
        fail(`window ${o.id} sits on a ${o.sill.toFixed(2)} m sill, over the ${prop.sill[1]} m limit`);
      }
    }
  }
}
