import type { FamilySection, WindowField } from '../api.ts';
import { DIMENSIONS as D } from './dimensions.ts';

type Kind = 'ribbon' | 'bank' | 'spine' | 'corner' | 'ground';

/** The long faces flank a perforated service spine with two curtain-wall banks. */
export function sections(edge: number, length: number, floor: number, height: number): FamilySection[] {
  const result: FamilySection[] = [];
  let cursor = 0;
  const clear = height - D.slab;
  const add = (kind: Kind, width: number): void => {
    const windows: WindowField[] = [];
    const ribbonHeight = Math.min(1.7, clear * 0.46);
    const ribbonSill = Math.max(0.3, clear - ribbonHeight - 0.45);
    if (floor > 0 && kind === 'ribbon') windows.push({ offset: 0.10, width: width - 0.20, sill: ribbonSill, height: ribbonHeight,
      panes: { cols: Math.max(1, Math.round(width / D.mullionPitch)), rows: 1 } });
    if (floor > 0 && kind === 'bank') windows.push({ offset: 0.12, width: width - 0.24, sill: 0.30, height: clear - 0.50,
      panes: { cols: Math.round(width / D.mullionPitch), rows: 1 } });
    if (floor > 0 && kind === 'spine') {
      for (let i = 0; i < 3; i++) windows.push({ offset: (width - 2.55) / 2 + i, width: 0.55,
        sill: clear * 0.37, height: Math.min(1.25, clear * 0.4), panes: { cols: 1, rows: 1 } });
    }
    const first = windows[0];
    const border = { side: kind === 'corner' ? 0.04 : 0.10, bottom: first?.sill ?? 0.25,
      top: first ? height - first.sill - first.height : 0.25, depth: kind === 'bank' ? 0.28 : 0.16 };
    result.push({ id: `mirror:${edge}:${kind}:${result.length}`, edge, offset: cursor, width,
      technique: kind === 'corner' ? 'paired-pier' : 'paired-glass', border, windows });
    cursor += width;
  };
  add('corner', D.corner);
  const usable = length - 2 * D.corner;
  if (floor === 0) {
    const side = (usable - 4) / 2;
    add('ground', side);
    add('ground', 4);
    add('ground', side);
  } else if (edge % 2 === 0) {
    const bank = usable >= 43 ? 10 : 5;
    const ribbon = (usable - D.service - bank * 2) / 2;
    ribbonCells(ribbon, add);
    add('bank', bank);
    add('spine', D.service);
    add('bank', bank);
    ribbonCells(ribbon, add);
  } else {
    const ribbon = (usable - D.service) / 2;
    ribbonCells(ribbon, add);
    add('spine', D.service);
    ribbonCells(ribbon, add);
  }
  add('corner', D.corner);
  return result;
}

function ribbonCells(width: number, add: (kind: Kind, width: number) => void): void {
  const count = Math.max(1, Math.floor(width / D.room));
  for (let i = 0; i < count; i++) add('ribbon', width / count);
}
