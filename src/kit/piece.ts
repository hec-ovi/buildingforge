// Builds one piece of a family's set and measures what it costs.

import { MeshBuilder, type V3 } from '../mesh/primitives.ts';
import { measureRuntime } from '../glb/measure.ts';
import { ExteriorError } from '../core/errors.ts';
import { bayCell, cornerCells, type Cell } from './cell.ts';
import { KIT, type Band, type PieceKind } from './module.ts';
import { recipeFor } from './recipes/index.ts';
import { writePieceGlb } from './glb.ts';
import type { PieceContext } from './recipe.ts';
import type { DoorRecord, PieceManifest, PieceRequest, PieceResult, SignAnchor } from './types.ts';
import type { TextureOptions } from '../materials/apply.ts';

export interface BuiltPiece { mb: MeshBuilder; manifest: PieceManifest }

export function pieceId(family: string, band: Band, piece: PieceKind): string {
  return `${family}/${band}/${piece}`;
}

/** Geometry and manifest of one piece, without serializing it. */
export function buildPieceMesh(request: PieceRequest): BuiltPiece {
  const recipe = recipeFor(request.family);
  const band = request.band, kind = request.piece;
  const seed = request.seed ?? 'kit';
  const height = request.height ?? recipe.heights[band];
  if (!(height > 0)) throw new ExteriorError('E_SCHEMA', `piece height must be positive: ${height}`);
  const runs: Cell[] = kind === 'corner' ? cornerCells(KIT.cornerArm) : [bayCell(KIT.bay)];
  const mb = new MeshBuilder();
  const anchors: SignAnchor[] = [];
  const doors: DoorRecord[] = [];
  const context: PieceContext = {
    family: recipe.family, band, piece: kind, runs, height,
    material: (role) => {
      const slot = recipe.materials[role];
      if (!slot) throw new ExteriorError('E_MATERIAL_UNRESOLVED', `${recipe.family} has no material role "${role}"`, { role });
      return slot;
    },
    part: (name, options) => mb.part(name, options ?? {}),
    anchor: (anchor) => anchors.push(anchor),
    door: (door) => doors.push(door),
  };
  recipe.build(context);
  const geometry = measureRuntime(mb);
  const manifest: PieceManifest = {
    id: pieceId(recipe.family, band, kind),
    family: recipe.family, band, piece: kind, seed,
    arms: runs.map(run => run.length),
    height,
    depth: recipe.backing,
    geometry,
    parts: mb.parts.filter(p => p.prims.size > 0).map(p => p.name).sort(),
    materials: mb.materialSlots(),
    signAnchors: anchors,
    doors,
    sections: sections(mb, runs, kind, height),
  };
  return { mb, manifest };
}

export async function buildPiece(request: PieceRequest, options: TextureOptions = {}): Promise<PieceResult> {
  const built = buildPieceMesh(request);
  const { glb, textures } = await writePieceGlb(built.mb, built.manifest.id, request.theme ?? 'cyberpunk', built.manifest.seed, options);
  return { glb, manifest: built.manifest, textures };
}

const PLANE = 1e-6;
const SNAP = 1e4;

type Flat = { plane: number; a: number; b: number };
type Segment = { a: [number, number]; b: [number, number]; slot: string };

/**
 * Every triangle edge that lies in one boundary plane, as a segment in that
 * plane's own two coordinates. Two pieces meet without a seam when their
 * sections cover the same outline, however each side happens to be tessellated.
 */
function planeEdges(mb: MeshBuilder, project: (p: V3) => Flat, plane: number): Segment[] {
  const segments: Segment[] = [];
  for (const part of mb.parts) {
    const shift = part.pivot ?? [0, 0, 0];
    for (const [slot, prim] of part.prims) {
      const at = (v: number): Flat => project([
        prim.positions[v * 3]! + shift[0], prim.positions[v * 3 + 1]! + shift[1], prim.positions[v * 3 + 2]! + shift[2],
      ]);
      for (let i = 0; i < prim.indices.length; i += 3) {
        const corners = [at(prim.indices[i]!), at(prim.indices[i + 1]!), at(prim.indices[i + 2]!)];
        for (let e = 0; e < 3; e++) {
          const p = corners[e]!, q = corners[(e + 1) % 3]!;
          if (Math.abs(p.plane - plane) > PLANE || Math.abs(q.plane - plane) > PLANE) continue;
          if (Math.hypot(q.a - p.a, q.b - p.b) < PLANE) continue;
          segments.push({ a: [p.a, p.b], b: [q.a, q.b], slot });
        }
      }
    }
  }
  return segments;
}

const round = (v: number) => (Math.round(v * SNAP) / SNAP).toFixed(4);

/** Collinear segments merged into their covered intervals, then hashed. */
function outline(segments: Segment[], withMaterial: boolean): string {
  const lines = new Map<string, { t0: number; t1: number }[]>();
  for (const segment of segments) {
    let [dx, dy] = [segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]];
    const length = Math.hypot(dx, dy);
    dx /= length; dy /= length;
    if (dx < -PLANE || (Math.abs(dx) <= PLANE && dy < 0)) { dx = -dx; dy = -dy; }
    const offset = dx * segment.a[1] - dy * segment.a[0];
    const key = `${round(dx)},${round(dy)},${round(offset)}${withMaterial ? `,${segment.slot}` : ''}`;
    const t = [dx * segment.a[0] + dy * segment.a[1], dx * segment.b[0] + dy * segment.b[1]].sort((m, n) => m - n) as [number, number];
    const list = lines.get(key) ?? [];
    list.push({ t0: t[0], t1: t[1] });
    lines.set(key, list);
  }
  const keys: string[] = [];
  for (const [key, spans] of lines) {
    spans.sort((m, n) => m.t0 - n.t0);
    const merged: { t0: number; t1: number }[] = [];
    for (const span of spans) {
      const last = merged.at(-1);
      if (last && span.t0 <= last.t1 + 1e-4) last.t1 = Math.max(last.t1, span.t1);
      else merged.push({ ...span });
    }
    for (const span of merged) keys.push(`${key}|${round(span.t0)}|${round(span.t1)}`);
  }
  let h = 0x811c9dc5;
  for (const key of keys.sort()) for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

function sections(mb: MeshBuilder, runs: Cell[], kind: PieceKind, height: number): PieceManifest['sections'] {
  const along = (run: Cell) => (p: V3): Flat => {
    const dx = p[0] - run.origin[0], dz = p[2] - run.origin[1];
    return { plane: dx * run.run[0] + dz * run.run[1], a: p[1], b: dx * run.outward[0] + dz * run.outward[1] };
  };
  const across = (run: Cell) => (p: V3): Flat => {
    const dx = p[0] - run.origin[0], dz = p[2] - run.origin[1];
    return { plane: p[1], a: dx * run.run[0] + dz * run.run[1], b: dx * run.outward[0] + dz * run.outward[1] };
  };
  const atU = (index: number, u: number) => outline(planeEdges(mb, along(runs[index]!), u), true);
  const atY = (y: number) => outline(runs.flatMap(run => planeEdges(mb, across(run), y)), false);
  const boundary = kind === 'corner'
    ? { start: atU(0, runs[0]!.length), end: atU(runs.length - 1, runs.at(-1)!.length) }
    : { start: atU(0, 0), end: atU(0, runs[0]!.length) };
  return { ...boundary, bottom: atY(0), top: atY(height) };
}
