import type { FamilySection, WindowField } from '../api.ts';
import { END, WINDOW_CELL, PANEL_WING, CASSETTE, CHANNEL_BORDER, CHANNEL_SPACER, CHANNEL_RECESS, FIXED_FRONT, cassetteProfile } from './dimensions.ts';
import { SCREEN_FACE, SERVICE_WIDTH, specialFace } from './faces.ts';

function windowPair(width: number, height: number, equal = false): WindowField[] {
  return [
    { offset: 0.16, width: width - 0.32, sill: 0.3, height: 0.32, panes: { cols: 1, rows: 1 } },
    { offset: 0.16, width: width - 0.32, sill: equal ? height - 0.62 : height - 1.18, height: equal ? 0.32 : 0.72, panes: { cols: 1, rows: 1 } },
  ];
}

class FaceSections {
  readonly values: FamilySection[] = [];
  private offset = 0;
  private readonly floor: number;
  private readonly edge: number;
  private readonly inset: number;
  constructor(floor: number, edge: number, inset: number) { this.floor = floor; this.edge = edge; this.inset = inset; }
  add(kind: string, width: number, windows: WindowField[] = [], depth = 0.18, surfaceDepth = 0): void {
    if (width < 1e-8) return;
    this.values.push({ id: `corporate:${this.floor}:${this.edge}:${kind}:${this.values.length}`, technique: windows.length ? 'paired-glass' : 'paired-solid', edge: this.edge, offset: this.offset, width, border: { side: 0.12, bottom: 0.22, top: 0.22, depth: depth + this.inset, surfaceDepth: surfaceDepth + this.inset }, windows });
    this.offset += width;
  }
}

export function face(floor: number, group: number, edge: number, length: number, height: number, inset: number): FamilySection[] {
  const out = new FaceSections(floor, edge, inset);
  if (floor === 0) {
    out.add('ground-panel', (length - 6) / 2);
    out.add('entry', 6);
    out.values[1]!.technique = 'paired-glass';
    out.add('ground-panel', (length - 6) / 2);
    return out.values;
  }
  out.add('end', inset + END);
  const usable = length - 2 * (inset + END);
  if (group === 0) {
    const count = Math.floor(usable), spare = (usable - count) / 2;
    out.add('end', spare);
    for (let i = 0; i < count; i++) out.add('podium-slit', 1, [{ offset: 0.12, width: 0.76, sill: height - 1.1, height: 0.7 }]);
    out.add('end', spare);
  } else if (specialFace(edge) && group === 1) {
    const count = Math.floor((length - inset * 2 - FIXED_FRONT + 1e-8) / WINDOW_CELL);
    const spare = (usable - PANEL_WING - CASSETTE - 2 * CHANNEL_BORDER - CHANNEL_SPACER - count * WINDOW_CELL) / 2;
    // Increasing face U runs from the viewer's right to left.
    const profile = cassetteProfile(height);
    out.add('cassette', CASSETTE, [{ offset: 0.1, width: CASSETTE * 2 / 3 - 0.2, sill: profile.slotBottom, height: profile.slotHeight, panes: { cols: 2, rows: 1 } }], 0.16);
    out.add('channel-spacer', CHANNEL_SPACER);
    out.add('channel-right', CHANNEL_BORDER + spare);
    for (let i = 0; i < count; i++) out.add('recessed-slit', WINDOW_CELL, windowPair(WINDOW_CELL, height, true), CHANNEL_RECESS + 0.18, CHANNEL_RECESS);
    out.add('channel-left', CHANNEL_BORDER + spare);
    out.add('large-panel', PANEL_WING);
  } else if (edge === SCREEN_FACE) {
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
    out.add('screen', usable * 0.68);
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
  } else {
    out.add('mechanical', SERVICE_WIDTH, [], 0.65);
    const count = Math.floor((usable - SERVICE_WIDTH - 1) / WINDOW_CELL), trim = (usable - SERVICE_WIDTH - count * WINDOW_CELL) / 2;
    out.add('upper-border', trim);
    for (let i = 0; i < count; i++) out.add('upper-window', WINDOW_CELL, windowPair(WINDOW_CELL, height), 0.55);
    out.add('upper-border', trim);
  }
  out.add('end', inset + END);
  return out.values;
}
