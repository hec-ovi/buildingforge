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
