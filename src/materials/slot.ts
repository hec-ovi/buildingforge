// A mesh material slot is a canonical key plus an optional authored variant.
// The GLB material keeps the plain key as its name and carries the variant in
// extras, matching the shared Interior and Engine convention.

export function materialSlot(key: string, variant?: string, finish?: string): string {
  return `${key}${variant ? `#${variant}` : ''}${finish ? `@${finish}` : ''}`;
}

export function splitMaterialSlot(slot: string): [key: string, variant?: string, finish?: string] {
  const [surface, finish] = slot.split('@');
  const cut = surface!.indexOf('#');
  return cut < 0 ? [surface!, undefined, finish] : [surface!.slice(0, cut), surface!.slice(cut + 1), finish];
}
