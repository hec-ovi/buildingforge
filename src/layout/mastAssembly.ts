import type { MastAssembly, MastVariant, P2, P3, RoofArtifact } from '../types.ts';
import { ExteriorError } from '../core/errors.ts';

const q = (value: number): number => Math.round(value * 1000) / 1000;
const point = (center: P2, y: number, axis: P2, offset = 0): P3 => [
  q(center[0] + axis[0] * offset), q(y), q(center[1] + axis[1] * offset),
];

/** Builds an exact roof-mounted antenna or mast assembly inside its fitted footprint. */
export function buildMastAssembly(
  artifact: RoofArtifact, roof: number, variant: MastVariant,
): MastAssembly {
  const [width, depth, height] = artifact.size;
  const along: P2 = artifact.rotationDeg === 90 ? [0, 1] : [1, 0];
  const across: P2 = [-along[1], along[0]];
  const base = point(artifact.center, roof + 0.1, along);
  const top = point(artifact.center, roof + height, along);
  const braceTop = point(artifact.center, roof + Math.min(height * 0.3, 1.5), along);
  const supports = ([-1, 1] as const).flatMap((u) => ([-1, 1] as const).map((v) => ({
    from: [
      q(artifact.center[0] + along[0] * width * 0.35 * u + across[0] * depth * 0.35 * v),
      q(roof + 0.1),
      q(artifact.center[1] + along[1] * width * 0.35 * u + across[1] * depth * 0.35 * v),
    ] as P3,
    to: braceTop,
  })));

  const arms = variant === 'crossarm-mast'
    ? [0.66, 0.8, 0.94].map((heightFraction) => {
      const y = roof + height * heightFraction;
      const half = width * (0.34 + heightFraction * 0.12);
      return {
        from: point(artifact.center, y, along, -half),
        to: point(artifact.center, y, along, half),
      };
    })
    : [];
  const cableAttachments = variant === 'crossarm-mast'
    ? arms.flatMap((arm) => [arm.from, arm.to])
    : [top];
  const junction = point(artifact.center, roof + 0.18, across, Math.min(depth * 0.2, 0.2));
  const cables = cableAttachments.map((attachment, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const offset = Math.min(depth * 0.08, 0.08) * side;
    return {
      id: `mast-cable:${index}`,
      path: [
        attachment,
        point(artifact.center, attachment[1] - 0.08, across, offset),
        point(artifact.center, roof + 0.3, across, offset),
        junction,
      ],
    };
  });
  return { variant, mast: { from: base, to: top }, arms, supports, cableAttachments, cables };
}

/** Fails closed when published mast records no longer describe their fitted geometry. */
export function validateMastAssemblies(artifacts: RoofArtifact[], roof: number): void {
  for (const artifact of artifacts) {
    const isMast = artifact.kind === 'antenna' || artifact.kind === 'mast';
    if (isMast !== (artifact.mastAssembly !== undefined)) fail(artifact, 'has no matching assembly');
    const assembly = artifact.mastAssembly;
    if (!assembly) continue;
    if ((artifact.kind === 'antenna') !== (assembly.variant === 'whip')) {
      fail(artifact, `has incompatible ${assembly.variant} geometry`);
    }
    const expectedArms = assembly.variant === 'crossarm-mast' ? 3 : 0;
    if (assembly.supports.length !== 4 || assembly.cableAttachments.length === 0
      || assembly.arms.length !== expectedArms
      || assembly.cables.length !== assembly.cableAttachments.length
      || new Set(assembly.cables.map((cable) => cable.id)).size !== assembly.cables.length) {
      fail(artifact, 'has incomplete supports or cable routes');
    }
    if (!same(assembly.mast.from[1], roof + 0.1)
      || !same(assembly.mast.to[1], roof + artifact.size[2])) {
      fail(artifact, 'mast height disagrees with its fitted size');
    }
    const junction = assembly.cables[0]?.path.at(-1);
    for (let index = 0; index < assembly.cables.length; index++) {
      const cable = assembly.cables[index]!;
      if (cable.path.length < 2 || !samePoint(cable.path[0], assembly.cableAttachments[index])
        || !samePoint(cable.path.at(-1), junction)) {
        fail(artifact, `cable ${cable.id} is disconnected`);
      }
    }
    const points = [assembly.mast.from, assembly.mast.to, ...assembly.cableAttachments,
      ...assembly.arms.flatMap((segment) => [segment.from, segment.to]),
      ...assembly.supports.flatMap((segment) => [segment.from, segment.to]),
      ...assembly.cables.flatMap((cable) => cable.path)];
    if (points.some((candidate) => !inside(artifact, roof, candidate))) {
      fail(artifact, 'assembly leaves its fitted footprint');
    }
  }
}

function inside(artifact: RoofArtifact, roof: number, candidate: P3): boolean {
  const along: P2 = artifact.rotationDeg === 90 ? [0, 1] : [1, 0];
  const across: P2 = [-along[1], along[0]];
  const dx = candidate[0] - artifact.center[0];
  const dz = candidate[2] - artifact.center[1];
  const u = dx * along[0] + dz * along[1];
  const v = dx * across[0] + dz * across[1];
  return Math.abs(u) <= artifact.size[0] / 2 + 1e-6
    && Math.abs(v) <= artifact.size[1] / 2 + 1e-6
    && candidate[1] >= roof - 1e-6
    && candidate[1] <= roof + artifact.size[2] + 1e-6;
}

function same(a: number | undefined, b: number | undefined): boolean {
  return a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-6;
}

function samePoint(a: P3 | undefined, b: P3 | undefined): boolean {
  return a !== undefined && b !== undefined && same(a[0], b[0]) && same(a[1], b[1]) && same(a[2], b[2]);
}

function fail(artifact: RoofArtifact, reason: string): never {
  throw new ExteriorError('E_INVARIANT',
    `roof artifact ${artifact.kind} ${reason}; exterior bug, report with the request`);
}
