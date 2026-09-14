// A mesh material slot is a canonical key plus an optional authored variant.
// The GLB material keeps the plain key as its name and carries the variant in
// extras, matching the shared Interior and Engine convention.

export function materialSlot(key: string, variant?: string, finish?: string): string {
  return `${key}${variant ? `#${variant}` : ''}${finish ? `@${finish}` : ''}`;
}

export function exactMaterialSlot(key: string): string { return `${key}~exact`; }

export function splitMaterialSlot(slot: string): [key: string, variant?: string, finish?: string, mapping?: 'exact'] {
  const exact = slot.endsWith('~exact');
  const value = exact ? slot.slice(0, -6) : slot;
  const [surface, finish] = value.split('@');
  const cut = surface!.indexOf('#');
  return cut < 0 ? [surface!, undefined, finish, exact ? 'exact' : undefined]
    : [surface!.slice(0, cut), surface!.slice(cut + 1), finish, exact ? 'exact' : undefined];
}
