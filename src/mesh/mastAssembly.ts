import type { Layout } from '../layout/model.ts';
import { type MeshBuilder, type V3 } from './primitives.ts';
import { meshRoofEquipment } from './roofEquipment.ts';
import { tubeSegment } from './tube.ts';

/** Emits ordinary roof equipment and fitted antenna or crossarm-mast assemblies. */
export function meshRoofArtifacts(
  mb: MeshBuilder, layout: Layout, top: number, mat: (kind: string) => string,
): void {
  if (layout.roof.artifacts.length === 0) return;
  const sink = mb.part('roof-artifacts');
  for (const artifact of layout.roof.artifacts) {
    const [width, depth, height] = artifact.size;
    const placedWidth = artifact.rotationDeg === 90 ? depth : width;
    const placedDepth = artifact.rotationDeg === 90 ? width : depth;
    const assembly = artifact.mastAssembly;
    if (!assembly) {
      meshRoofEquipment(sink, artifact, top, mat('roof-artifact'), mat('metal'));
      continue;
    }

    const solid = mat('roof-artifact');
    const cable = mat('metal');
    sink.aabox(solid, [artifact.center[0], top + 0.06, artifact.center[1]],
      placedWidth * 0.8, placedDepth * 0.8, 0.12);
    const mastRadius = Math.max(0.045, Math.min(width, depth) * 0.055);
    tubeSegment(sink, solid, assembly.mast.from, assembly.mast.to, mastRadius);
    for (const arm of assembly.arms) tubeSegment(sink, solid, arm.from, arm.to, mastRadius * 0.7);
    for (const support of assembly.supports) tubeSegment(sink, solid, support.from, support.to, 0.035);
    for (const attachment of assembly.cableAttachments) {
      sink.aabox(solid, attachment, 0.09, 0.09, 0.09);
    }
    for (const run of assembly.cables) {
      for (let index = 1; index < run.path.length; index++) {
        tubeSegment(sink, cable, run.path[index - 1] as V3, run.path[index] as V3, 0.012);
      }
    }
  }
}
