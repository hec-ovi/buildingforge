// Inspection controls: clip height, wireframe, opening highlights, stats.

import { el, field, toggle } from '../components/dom.ts';
import type { ViewMode } from '../views/cameras.ts';
import type { Blueprint } from '../../types.ts';

export interface InspectEvents {
  onClip(fraction: number): void;
  onWireframe(on: boolean): void;
  onHighlight(on: boolean): void;
  onFlat(on: boolean): void;
  onView(view: ViewMode): void;
}

export class InspectPanel {
  readonly root: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly clipSlider: HTMLInputElement;
  private readonly clipValueLabel: HTMLElement;

  constructor(events: InspectEvents) {
    this.clipSlider = el('input', {
      type: 'range',
      min: '0',
      max: '100',
      value: '100',
      'aria-label': 'Clip height fraction',
    });
    this.clipValueLabel = el('span', { class: 'field-value' }, '100%');

    this.clipSlider.addEventListener('input', () => {
      const val = Number(this.clipSlider.value);
      this.clipValueLabel.textContent = `${val}%`;
      events.onClip(val / 100);
    });

    const view = el('select', { 'aria-label': 'Camera view preset' });
    view.append(
      el('option', { value: 'orbit' }, 'orbit'),
      el('option', { value: 'eye' }, 'street eye 1.7 m'),
    );
    view.addEventListener('change', () => events.onView(view.value as ViewMode));

    this.stats = el('div', { class: 'stats' });

    this.root = el(
      'div',
      { class: 'panel-section' },
      el('h2', {}, 'inspect'),
      field('camera', view),
      field('clip height', this.clipSlider, this.clipValueLabel),
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
