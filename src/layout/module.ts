import { quant } from '../core/polygon.ts';
import { MODULE } from '../rules/tables.ts';

/** A length as whole modules: rounded down, or to the nearest. */
export function onModule(v: number, mode: 'down' | 'near', module: number = MODULE): number {
  const k = mode === 'down' ? Math.floor(v / module + 1e-9) : Math.round(v / module);
  return quant(k * module);
}

/** Whether a length is a whole number of modules. */
export function onGrid(v: number, module: number = MODULE): boolean {
  return Math.abs(v / module - Math.round(v / module)) < 1e-6;
}

/** The centre of the module cell a coordinate falls in. */
export function cellCentre(v: number, module: number): number {
  return quant(Math.floor(v / module + 1e-9) * module + module / 2);
}

/** The module length nearest `v` that stays inside [lo, hi]; `v` itself when the range holds no whole module. */
export function moduleWithin(v: number, lo: number, hi: number, module: number = MODULE): number {
  const below = onModule(v, 'down', module);
  const above = quant(below + module);
  const inside = [below, above].filter((c) => c >= lo - 1e-9 && c <= hi + 1e-9);
  if (inside.length === 0) return v;
  return inside.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best));
}

/**
 * The panel a face really carries: the declared module stretched or squeezed to
 * the nearest whole count that spans the face exactly, so no face ends on a cut
 * panel. A face already a whole number of modules long gets the module itself.
 */
export function panelOn(span: number, module: number): number {
  return span / Math.max(1, Math.round(span / module));
}

export interface FixedPanelAxis {
  /** Every boundary, including the two face or storey endpoints. */
  boundaries: number[];
  /** Deliberate solid regions before and after the full-size panel run. */
  borders: [number, number];
}

/**
 * Fit only complete fixed-size panels. A remainder becomes equal solid border
 * regions at the two ends instead of changing the panel's world scale.
 */
export function fixedPanelAxis(span: number, module: number): FixedPanelAxis {
  const mm = (value: number) => Math.round(value * 1000) / 1000;
  const halfMillimetre = (value: number) => Math.round(value * 2000) / 2000;
  const closedSpan = mm(span);
  if (span <= 0 || module <= 0) return { boundaries: [0, closedSpan], borders: [0, 0] };
  const count = Math.floor(closedSpan / module + 1e-9);
  const border = halfMillimetre((closedSpan - count * module) / 2);
  if (count === 0) return { boundaries: [0, closedSpan], borders: [border, border] };
  const boundaries = [0];
  if (border > 1e-6) boundaries.push(border);
  for (let i = 1; i <= count; i++) boundaries.push(halfMillimetre(border + i * module));
  if (Math.abs(boundaries.at(-1)! - closedSpan) > 1e-6) boundaries.push(closedSpan);
  else boundaries[boundaries.length - 1] = closedSpan;
  return { boundaries, borders: [border, border] };
}
