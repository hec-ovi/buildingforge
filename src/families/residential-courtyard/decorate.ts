import { Rng, tubeSegment, type DecorationContext, type FloorLayout, type PartSink } from '../api.ts';
import type { Opening } from '../../types.ts';
import { Surface, type Area } from './surface.ts';
import { clothesline } from './clothesline.ts';

/** Weathered wall bays retain the same solid partitions, floor bands and real openings as the host. */
export function decorate(context: DecorationContext): void {
  const { builder, layout, material } = context, previous = builder.floor;
  try {
    for (const floor of layout.floors) {
      if (floor.index < 0 || !floor.assembly) continue;
      builder.floor = floor.index;
      for (let edge = 0; edge < floor.outline.length; edge++) {
        const surface = new Surface(layout, floor, edge), { field } = surface;
        const sink = builder.part(`courtyard:skin:${floor.index}:${edge}`);
        const top = floor.elevation + floor.height;
        // Whole apartment panels and shallow joints make the repeated human-scale grid visible.
        for (const section of floor.assembly.sections.filter(s => s.edge === edge)) {
          surface.solid(sink, material(floor.index === 0 ? 'ground' : 'wall'), {
            left: section.offset, right: section.offset + section.width, bottom: floor.elevation, top,
          }, .035);
          surface.solid(sink, material('wall-trim'), {
            left: section.offset + .03, right: section.offset + .075, bottom: floor.elevation + .2, top: top - .22,
          }, .05);
        }
        surface.solid(sink, material('column'), { left: 0, right: field.length, bottom: top - .27, top }, .16);
        surface.solid(sink, material('wall-trim'), { left: 0, right: field.length, bottom: top - .055, top: top - .015 }, .175);
        surface.solid(sink, material('column'), { left: 0, right: field.length, bottom: floor.elevation, top: floor.elevation + .19 }, .11);
        // Edge zero is reserved for the host's floor-connected stair and its movement volumes.
        if (edge === 0 || floor.index === 0) continue;
        for (const opening of floor.openings.filter(o => o.edge === edge && o.kind === 'window')) {
          ornaments(context, floor, surface, opening);
        }
        drains(context, floor, surface, edge);
      }
    }
  } finally { builder.floor = previous; }
}

function ornaments(context: DecorationContext, floor: FloorLayout, surface: Surface, window: Opening): void {
  const { builder, layout, material } = context;
  const random = new Rng(layout.request.seed, `courtyard:${floor.index}:${window.sectionId ?? window.id}`);
  const left = window.offset, right = left + window.width;
  const bottom = floor.elevation + window.sill, top = bottom + window.height;
  const featureBay = floor.index === 1 && window.sectionId === 'rc:2:1';
  const simple = layout.detail?.has('fittings') ?? false;
  const sparse = layout.detail?.has('coverings') ?? false;
  const area: Area = { left: left - .6, right: right + .6, bottom: bottom - .08, top: top + .28 };
  if (!surface.clear(area) || surface.depth(area.left, area.right, .2) < .19) return;
  if (featureBay) clothesline(context, floor, surface, window);
  const shutterSides = sparse && !featureBay ? [] : random.chance(.45) ? [-1, 1] : [random.chance(.5) ? -1 : 1];
  if (shutterSides.length) {
    const sink = builder.part(`courtyard:shutters:${floor.index}:${window.id}`);
    for (const side of shutterSides) {
      const start = side < 0 ? left - .59 : right + .12;
      shutter(surface, sink, material('courtyard-shutter'), start, start + .47, bottom, top, simple);
    }
  }
  if (featureBay || !sparse && random.chance(.48)) grille(surface, builder.part(`courtyard:grille:${floor.index}:${window.id}`),
    material('courtyard-metal'), left, right, bottom, top, simple);
  const canopyFloor = !sparse || floor.index % 2 === 1 || featureBay;
  if (canopyFloor && (featureBay || random.chance(.38)) && surface.depth(left - .12, right + .12, .56) > .55) {
    canopy(surface, builder.part(`courtyard:canopy:${floor.index}:${window.id}`),
      material('courtyard-canopy'), material('courtyard-metal'), left, right, top + .2, simple);
  }
}

function shutter(surface: Surface, sink: PartSink, material: string, left: number, right: number, bottom: number, top: number, simple: boolean): void {
  const { field } = surface;
  const solid = (u0: number, u1: number, y0: number, y1: number, front: number) =>
    field.solid(sink, material, u0, u1, y0, y1, front, .065, [0, 1], undefined, true);
  for (const u of [left, right - .038]) solid(u, u + .038, bottom, top, .13);
  for (const y of [bottom, top - .045]) solid(left, right, y, y + .045, .13);
  const count = Math.max(3, Math.floor((top - bottom - .11) / .14)), pitch = (top - bottom - .1) / count;
  for (let blade = 0; blade < count; blade++) {
    const y = bottom + .05 + blade * pitch;
    // An actual tilted blade has a lit upper edge and a dark lower return.
    const a = field.point(left + .04, y, .145), b = field.point(right - .04, y, .145);
    const c = field.point(right - .04, y + pitch * .78, .095), d = field.point(left + .04, y + pitch * .78, .095);
    sink.quadFacing(material, a, b, c, d, [field.normal[0], .4, field.normal[1]],
      [[0, 0], [right - left, 0], [right - left, pitch], [0, pitch]]);
    if (!simple) solid(left + .04, right - .04, y - .008, y + .008, .15);
  }
}

function grille(surface: Surface, sink: PartSink, metal: string, left: number, right: number, bottom: number, top: number, simple: boolean): void {
  const { field } = surface;
  const frame = (u0: number, u1: number, y0: number, y1: number, width = .028) =>
    field.solid(sink, metal, u0, u1, y0, y1, .21, .21 - width, [0, 1], undefined, true);
  for (const u of [left - .03, right]) frame(u, u + .03, bottom - .03, top + .03);
  for (const y of [bottom - .03, top]) frame(left - .03, right + .03, y, y + .03);
  const bars = Math.max(2, Math.round((right - left) / (simple ? .55 : .33)));
  for (let i = 1; i < bars; i++) { const u = left + (right - left) * i / bars; frame(u - .009, u + .009, bottom, top, .02); }
  const rows = simple ? 2 : Math.max(2, Math.round((top - bottom) / .38));
  for (let i = 1; i < rows; i++) { const y = bottom + (top - bottom) * i / rows; frame(left, right, y - .009, y + .009, .02); }
  for (const u of [left, right]) for (const y of [bottom, top]) {
    tubeSegment(sink, metal, field.point(u, y, .035), field.point(u, y, .21), .016);
  }
}

function canopy(surface: Surface, sink: PartSink, roof: string, metal: string, left: number, right: number, height: number, simple: boolean): void {
  const { field } = surface, u0 = left - .12, u1 = right + .12;
  const a = field.point(u0, height, .07), b = field.point(u1, height, .07);
  const c = field.point(u1, height - .14, .54), d = field.point(u0, height - .14, .54);
  sink.quadFacing(roof, a, b, c, d, [field.normal[0] * .14, .47, field.normal[1] * .14],
    [[u0, 0], [u1, 0], [u1, .49], [u0, .49]]);
  sink.quadFacing(roof, d, c, b, a, [-field.normal[0] * .14, -.47, -field.normal[1] * .14],
    [[u0, .49], [u1, .49], [u1, 0], [u0, 0]]);
  tubeSegment(sink, metal, d, c, .025);
  tubeSegment(sink, metal, a, b, .025);
  for (const u of [u0, u1]) {
    const tip = field.point(u, height - .14, .54);
    tubeSegment(sink, metal, field.point(u, height, .05), tip, .024);
    tubeSegment(sink, metal, field.point(u, height - .57, .035), tip, .024);
  }
  const ribs = simple ? 1 : Math.max(2, Math.round((u1 - u0) / .55));
  for (let i = 1; i < ribs; i++) {
    const u = u0 + (u1 - u0) * i / ribs;
    tubeSegment(sink, metal, field.point(u, height - .012, .075), field.point(u, height - .152, .53), .012);
  }
}

function drains(context: DecorationContext, floor: FloorLayout, surface: Surface, edge: number): void {
  const { field } = surface, sections = floor.assembly!.sections.filter(s => s.edge === edge);
  for (let i = 2; i < sections.length; i += 3) {
    const u = sections[i]!.offset + .035, bottom = floor.elevation, top = bottom + floor.height;
    if (!surface.clear({ left: u - .11, right: u + .11, bottom, top }) || surface.depth(u - .11, u + .11, .24) < .23) continue;
    const sink = context.builder.part(`courtyard:drain:${floor.index}:${edge}:${i}`), metal = context.material('courtyard-metal');
    const start = field.point(u, bottom, .2), end = field.point(u, top, .2);
    tubeSegment(sink, metal, start, end, .035);
    for (const y of [bottom + .35, top - .3]) {
      field.solid(sink, metal, u - .075, u + .075, y - .022, y + .022, .24, .035, [0, 1], undefined, true);
    }
    if (floor.index === 1) tubeSegment(sink, metal, start, field.point(u, bottom, .035), .035);
    if (floor.index === context.layout.floors.at(-1)?.index) tubeSegment(sink, metal, end, field.point(u, top, .035), .035);
  }
}
