import type { FamilySection, WindowField } from '../api.ts';
import { END, WINDOW_CELL, PANEL_WING, CASSETTE, CHANNEL_BORDER, FIXED_FRONT } from './dimensions.ts';

function windowPair(width: number, height: number): WindowField[] {
  return [
    { offset: 0.16, width: width - 0.32, sill: 0.3, height: 0.32, panes: { cols: 1, rows: 1 } },
    { offset: 0.16, width: width - 0.32, sill: height - 1.18, height: 0.72, panes: { cols: 1, rows: 1 } },
  ];
}

class FaceSections {
  readonly values: FamilySection[] = [];
  private offset = 0;
  private readonly floor: number;
  private readonly edge: number;
  private readonly inset: number;
  constructor(floor: number, edge: number, inset: number) { this.floor = floor; this.edge = edge; this.inset = inset; }
  add(kind: string, width: number, windows: WindowField[] = [], depth = 0.18): void {
    if (width < 1e-8) return;
    this.values.push({ id: `corporate:${this.floor}:${this.edge}:${kind}:${this.values.length}`, technique: windows.length ? 'paired-glass' : 'paired-solid', edge: this.edge, offset: this.offset, width, border: { side: 0.12, bottom: 0.22, top: 0.22, depth: depth + this.inset }, windows });
    this.offset += width;
  }
}

export function face(floor: number, group: number, localFloor: number, edge: number, length: number, height: number, inset: number): FamilySection[] {
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
  } else if (edge === 0 && group === 1) {
    const count = Math.floor((length - inset * 2 - FIXED_FRONT + 1e-8) / WINDOW_CELL);
    const spare = (usable - PANEL_WING - CASSETTE - 2 * CHANNEL_BORDER - count * WINDOW_CELL) / 2;
    // Increasing face U runs from the viewer's right to left.
    out.add('cassette', CASSETTE, [0, 1].map(j => ({ offset: j * 3 + 0.16, width: 2.68, sill: height - 1.75, height: 0.9, panes: { cols: 1, rows: 1 } })), 0.16);
    out.add('channel-right', CHANNEL_BORDER + spare);
    for (let i = 0; i < count; i++) out.add('recessed-slit', WINDOW_CELL, windowPair(WINDOW_CELL, height), 0.8);
    out.add('channel-left', CHANNEL_BORDER + spare);
    out.add('large-panel', PANEL_WING);
  } else if (edge === 2) {
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
    out.add('screen', usable * 0.68);
    out.add('screen-flank', usable * 0.16, windowPair(usable * 0.16, height));
  } else if (edge === 0 || edge === 1) {
    out.add('mechanical', 2, [], 0.65);
    const count = Math.floor((usable - 3) / WINDOW_CELL), trim = (usable - 2 - count * WINDOW_CELL) / 2;
    out.add('shield-right', trim);
    for (let i = 0; i < count; i++) {
      const masked = localFloor % 4 >= 2 || i % 3 === 0;
      out.add(masked ? 'mask-panel' : 'side-window', WINDOW_CELL, masked ? [] : windowPair(WINDOW_CELL, height), 0.55);
    }
    out.add('shield-left', trim);
  } else {
    const count = Math.floor(usable / WINDOW_CELL), trim = (usable - count * WINDOW_CELL) / 2;
    out.add('service-border', trim);
    for (let i = 0; i < count; i++) out.add('service-window', WINDOW_CELL, windowPair(WINDOW_CELL, height), 0.55);
    out.add('service-border', trim);
  }
  out.add('end', inset + END);
  return out.values;
}
