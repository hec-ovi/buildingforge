export const finishes = {
  pier: 'cyberpunk/paired-cladding-metal/mid#surface',
  frame: 'cyberpunk/paired-frame-metal/mid#surface',
  slab: 'cyberpunk/exterior-cast-concrete/mid#native',
  glass: 'cyberpunk/paired-window-glass/mid#clear',
  light: 'cyberpunk/paired-light-cool/mid#surface',
  lightOff: 'cyberpunk/paired-light-off/mid#surface',
  lining: 'cyberpunk/wall/rich#meridian-mineral',
  roof: 'cyberpunk/roof/mid#meridian-mineral',
} as const;

export const materials: Record<string, string> = {
  ground: finishes.pier, wall: finishes.pier, 'inner-wall': finishes.lining,
  column: finishes.pier, 'wall-trim': finishes.slab,
  'window-frame': finishes.frame, roof: finishes.roof, parapet: finishes.slab,
  // A dark/unoccupied room changes its lighting, never the transparency of its
  // real glass. Interior removes scenic room nodes but retains these panes.
  'window-glass': finishes.glass, 'window-black': finishes.glass,
};
