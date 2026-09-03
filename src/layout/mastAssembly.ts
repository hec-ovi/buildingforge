import type { ExternalAttachment, MastAssembly, MastVariant, P2, P3, RoofArtifact } from '../types.ts';
import { ExteriorError } from '../core/errors.ts';

const q = (value: number): number => Math.round(value * 1000) / 1000;
const EXTERNAL_CLEARANCE = 0.08;
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
  const externalAttachments: ExternalAttachment[] = variant === 'whip'
    ? [{
      id: `${artifact.id}:external:0`, position: top,
      orientation: 'omnidirectional', clearanceRadius: EXTERNAL_CLEARANCE,
    }]
    : [arms.at(-1)!.from, arms.at(-1)!.to].map((position, index): ExternalAttachment => {
      const dx = position[0] - artifact.center[0];
      const dz = position[2] - artifact.center[1];
      const length = Math.hypot(dx, dz);
      return {
        id: `${artifact.id}:external:${index}`, position,
        orientation: 'directional', normal: [q(dx / length), 0, q(dz / length)],
        clearanceRadius: EXTERNAL_CLEARANCE,
      };
    });
  return {
    variant, mast: { from: base, to: top }, arms, supports,
    cableAttachments, cables, externalAttachments,
  };
}

/** Fails closed unless each published mast record describes its fitted geometry. */
export function validateMastAssemblies(artifacts: RoofArtifact[], roof: number): void {
  const artifactIds = new Set<string>();
  const externalIds = new Set<string>();
  for (const artifact of artifacts) {
    if (!artifact.id || artifactIds.has(artifact.id)) fail(artifact, 'has no unique stable id');
    artifactIds.add(artifact.id);
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
    const expectedExternal = assembly.variant === 'whip' ? [assembly.mast.to]
      : [assembly.arms.at(-1)!.from, assembly.arms.at(-1)!.to];
    if (assembly.externalAttachments.length !== expectedExternal.length) {
      fail(artifact, 'has incomplete external attachments');
    }
    for (let index = 0; index < assembly.externalAttachments.length; index++) {
      const attachment = assembly.externalAttachments[index]!;
      const expectedPosition = expectedExternal[index]!;
      if (attachment.id !== `${artifact.id}:external:${index}`
        || externalIds.has(attachment.id)
        || !samePoint(attachment.position, expectedPosition)
        || !insidePlan(artifact, attachment.position, attachment.clearanceRadius)) {
        fail(artifact, `external attachment ${attachment.id} is not fitted`);
      }
      externalIds.add(attachment.id);
      if (assembly.variant === 'whip') {
        if (attachment.orientation !== 'omnidirectional') {
          fail(artifact, `external attachment ${attachment.id} has the wrong orientation`);
        }
      } else {
        if (attachment.orientation !== 'directional'
          || Math.abs(attachment.normal[1]) > 1e-6
          || !same(length3(attachment.normal), 1)
          || outwardDot(artifact, attachment.position, attachment.normal) < 0.999) {
          fail(artifact, `external attachment ${attachment.id} has the wrong orientation`);
        }
      }
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

function insidePlan(artifact: RoofArtifact, candidate: P3, clearance: number): boolean {
  if (!(clearance > 0)) return false;
  const along: P2 = artifact.rotationDeg === 90 ? [0, 1] : [1, 0];
  const across: P2 = [-along[1], along[0]];
  const dx = candidate[0] - artifact.center[0];
  const dz = candidate[2] - artifact.center[1];
  const u = dx * along[0] + dz * along[1];
  const v = dx * across[0] + dz * across[1];
  return Math.abs(u) + clearance <= artifact.size[0] / 2 + 1e-6
    && Math.abs(v) + clearance <= artifact.size[1] / 2 + 1e-6;
}

function outwardDot(artifact: RoofArtifact, position: P3, normal: P3): number {
  const dx = position[0] - artifact.center[0];
  const dz = position[2] - artifact.center[1];
  const length = Math.hypot(dx, dz);
  return length > 0 ? (dx * normal[0] + dz * normal[2]) / length : -1;
}

function length3(vector: P3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
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
