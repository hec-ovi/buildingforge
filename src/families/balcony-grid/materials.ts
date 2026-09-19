export const finishes = {
  pier: 'cyberpunk/paired-cladding-metal/mid#surface',
  frame: 'cyberpunk/paired-frame-metal/mid#surface',
  slab: 'cyberpunk/exterior-cast-concrete/mid#native',
  glass: 'cyberpunk/paired-window-glass/mid#clear',
  light: 'cyberpunk/paired-light-cool/mid#surface',
  lightOff: 'cyberpunk/paired-light-off/mid#surface',
} as const;

export const materials: Record<string, string> = {
  ground: finishes.pier, wall: finishes.pier, 'inner-wall': finishes.slab,
  column: finishes.pier, 'wall-trim': finishes.slab,
  'window-frame': finishes.frame, roof: finishes.slab, parapet: finishes.slab,
};
