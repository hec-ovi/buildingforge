// Inspection controls: clip height, wireframe, opening highlights, stats.

import { Form } from '../components/Form.ts';
import layout from '../views/preview.json' with { type: 'json' };
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
  constructor(events: InspectEvents) {
    const actions: Record<string, () => void> = {
      camera: () => events.onView(form.control<HTMLSelectElement>('camera').value as ViewMode),
      clip: () => events.onClip(Number(form.control<HTMLInputElement>('clip').value) / 100),
      flat: () => events.onFlat(form.control<HTMLInputElement>('flat').checked),
      wireframe: () => events.onWireframe(form.control<HTMLInputElement>('wireframe').checked),
      highlight: () => events.onHighlight(form.control<HTMLInputElement>('highlight').checked),
    };
    const form = new Form(layout.inspect, {}, id => actions[id]?.());
    this.root = form.root;
    this.stats = form.control('stats');
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
