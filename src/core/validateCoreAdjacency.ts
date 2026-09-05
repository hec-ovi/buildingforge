import { ExteriorError } from './errors.ts';
import type { CoreAdjacency, CoreAdjacencyRule } from '../types.ts';

function fail(path: string, reason: string): never {
  throw new ExteriorError('E_SCHEMA', `${path}: ${reason}`);
}

function object(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected object');
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown property');
  return record;
}

function rule(value: Record<string, unknown>, path: string): CoreAdjacencyRule {
  const { role, clearDepth } = value;
  if (role !== 'structure' && role !== 'circulation' && role !== 'room') fail(`${path}.role`, 'expected structure, circulation or room');
  if (typeof clearDepth !== 'number' || !Number.isFinite(clearDepth) || clearDepth < 0) fail(`${path}.clearDepth`, 'expected nonnegative finite number');
  return { role, clearDepth };
}

export function validateCoreAdjacency(value: unknown): CoreAdjacency {
  const path = 'options.coreAdjacency';
  const record = object(value, path, ['glazing', 'overrides']);
  const glazing = rule(object(record.glazing, `${path}.glazing`, ['role', 'clearDepth']), `${path}.glazing`);
  if (record.overrides === undefined) return { glazing };
  if (!Array.isArray(record.overrides)) fail(`${path}.overrides`, 'expected array');
  const ids = new Set<string>();
  const overrides = record.overrides.map((value, index) => {
    const itemPath = `${path}.overrides[${index}]`;
    const item = object(value, itemPath, ['floor', 'opening', 'role', 'clearDepth']);
    if (typeof item.floor !== 'number' || !Number.isInteger(item.floor)) fail(`${itemPath}.floor`, 'expected integer');
    if (typeof item.opening !== 'string' || !item.opening.length) fail(`${itemPath}.opening`, 'expected nonempty opening id');
    const id = JSON.stringify([item.floor, item.opening]);
    if (ids.has(id)) fail(itemPath, 'duplicate floor/opening override');
    ids.add(id);
    return { floor: item.floor, opening: item.opening, ...rule(item, itemPath) };
  });
  return { glazing, overrides };
}
