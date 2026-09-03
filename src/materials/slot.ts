// A mesh material slot is a canonical key plus an optional authored variant.
// The GLB material keeps the plain key as its name and carries the variant in
// extras, matching the shared Interior and Engine convention.

export function materialSlot(key: string, variant?: string): string {
  return variant ? `${key}#${variant}` : key;
}

export function splitMaterialSlot(slot: string): [key: string, variant?: string] {
  const cut = slot.indexOf('#');
  return cut < 0 ? [slot] : [slot.slice(0, cut), slot.slice(cut + 1)];
}
