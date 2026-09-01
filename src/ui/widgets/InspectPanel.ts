// Inspection controls: clip height, wireframe, opening highlights, stats.

import { el, field, toggle } from '../components/dom.ts';
import type { Blueprint } from '../../types.ts';

export interface InspectEvents {
  onClip(fraction: number): void;
  onWireframe(on: boolean): void;
  onHighlight(on: boolean): void;
  onFlat(on: boolean): void;
}

export class InspectPanel {
  readonly root: HTMLElement;
  private readonly stats: HTMLElement;

  constructor(events: InspectEvents) {
    const clip = el('input', { type: 'range', min: '0', max: '100', value: '100' });
    clip.addEventListener('input', () => events.onClip(Number(clip.value) / 100));
    this.stats = el('div', { class: 'stats' });
    this.root = el('div', { class: 'panel-section' },
      el('h2', {}, 'inspect'),
      field('clip height', clip),
      toggle('flat colors', events.onFlat),
      toggle('wireframe', events.onWireframe),
      toggle('highlight openings', events.onHighlight),
      this.stats,
    );
  }

  showBlueprint(bp: Blueprint, glbBytes: number, textureMode: string): void {
    const openings = bp.floors.reduce((n, f) => n + f.openings.length, 0);
    const lines = [
      `building ${bp.buildingId}`,
      `seed ${bp.seed}`,
      `floors ${bp.floors.length} (top ${bp.bounds.height.toFixed(1)} m)`,
      `openings ${openings}`,
      `anchors ${bp.anchors.length}  lights ${bp.lights.length}`,
      `signage ${bp.signage.length}  screens ${bp.screens.length}`,
      `roof artifacts ${bp.roof.artifacts.map((a) => a.kind).join(', ') || 'none'}`,
      `glb ${(glbBytes / 1024).toFixed(0)} KiB, textures ${textureMode}`,
      '',
      'materials:',
      ...bp.materials,
    ];
    this.stats.textContent = lines.join('\n');
  }
}
