// Fixture picker, seed override, generate trigger.

import { el, field } from '../components/dom.ts';

export interface RequestPanelEvents {
  onGenerate(request: unknown): void;
}

export class RequestPanel {
  readonly root: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly seedInput: HTMLInputElement;
  private readonly errorBox: HTMLElement;

  private readonly fixtures: Record<string, unknown>;

  constructor(fixtures: Record<string, unknown>, events: RequestPanelEvents) {
    this.fixtures = fixtures;
    this.select = el('select');
    for (const name of Object.keys(fixtures).sort()) {
      this.select.append(el('option', { value: name }, name));
    }
    this.seedInput = el('input', { type: 'text', placeholder: 'seed override (optional)' });
    const generateBtn = el('button', {}, 'generate');
    this.errorBox = el('div', { class: 'error' });

    const fire = () => {
      this.errorBox.textContent = '';
      try {
        events.onGenerate(this.currentRequest());
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err));
      }
    };
    generateBtn.addEventListener('click', fire);
    this.select.addEventListener('change', fire);

    this.root = el('div', { class: 'panel-section' },
      el('h2', {}, 'request'),
      field('fixture', this.select),
      field('seed', this.seedInput),
      generateBtn,
      this.errorBox,
    );
  }

  currentRequest(): unknown {
    const base = this.fixtures[this.select.value];
    const req = structuredClone(base) as { seed?: string };
    const seed = this.seedInput.value.trim();
    if (seed) req.seed = seed;
    return req;
  }

  showError(message: string): void {
    this.errorBox.textContent = message;
  }
}
