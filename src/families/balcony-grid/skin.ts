import { FacadeField, cutWall, meshPanelField, rectHole, type DecorationContext, type FamilySection, type FloorLayout } from '../api.ts';
import { finishes } from './materials.ts';

/** Jointed skin follows the actual openings, including infrastructure cuts. */
export function skin(context: DecorationContext, floor: FloorLayout, section: FamilySection): void {
  if (section.spans) {
    for (const [index, span] of section.spans.entries()) skinField(context, floor,
      { ...section, id: `${section.id}:span:${index}`, edge: span.edge, offset: span.offset, width: span.width });
  } else skinField(context, floor, section);
}

function skinField(context: DecorationContext, floor: FloorLayout, section: FamilySection): void {
  const holes = floor.openings.filter(o => o.edge === section.edge).map(o =>
    rectHole(o.offset - section.offset, floor.elevation + o.sill, o.width, o.height));
  for (const carved of context.layout.carved) {
    if (carved.aperture.floor !== floor.index || carved.aperture.face !== section.edge) continue;
    holes.push({ poly: carved.facePoly.map(([u, y]) => [u - section.offset, y]) });
  }
  const pieces = cutWall(section.width, floor.elevation, floor.elevation + floor.height, holes).map(piece => ({
    bl: [piece.bl[0] + section.offset, piece.bl[1]] as [number, number],
    br: [piece.br[0] + section.offset, piece.br[1]] as [number, number],
    tr: [piece.tr[0] + section.offset, piece.tr[1]] as [number, number],
    tl: [piece.tl[0] + section.offset, piece.tl[1]] as [number, number],
  }));
  const solid = floor.index === 0 || section.technique === 'paired-solid';
  const material = solid ? finishes.pier : finishes.slab;
  const sink = context.builder.part(`balcony-grid-skin:${floor.index}:${section.id}`);
  const field = new FacadeField(floor.outline, section.edge);
  for (const piece of pieces) {
    const points = [piece.bl, piece.br, piece.tr, piece.tl] as const;
    sink.quadFacing(material, field.point(...piece.bl, -0.016), field.point(...piece.br, -0.016),
      field.point(...piece.tr, -0.016), field.point(...piece.tl, -0.016), [field.normal[0], 0, field.normal[1]],
      points.map(([u, y]) => [u, -y]));
  }
  meshPanelField(sink, {
    outline: floor.outline, edge: section.edge, elevation: floor.elevation, height: floor.height,
    width: solid ? 1 : 5, panelHeight: solid ? floor.height / 2 : floor.height,
    jointWidth: solid ? 0.014 : 0.009, pieces, material,
  });
}
