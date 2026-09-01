// Fixture picker, seed field, generate trigger. The seed field always shows the
// seed the building was built from, so any run can be reproduced; with none
// given, one is rolled and shown.

import { el, field } from '../components/dom.ts';
import { toast } from '../components/Toast.ts';
import { randomSeed } from '../../core/seed.ts';

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
    this.select = el('select', { 'aria-label': 'Select fixture' });
    for (const name of Object.keys(fixtures).sort()) {
      this.select.append(el('option', { value: name }, name));
    }
    this.seedInput = el('input', {
      type: 'text',
      placeholder: 'hex seed or string',
      spellcheck: 'false',
      'aria-label': 'Building generation seed',
    });
    const generateBtn = el('button', { class: 'btn-primary', type: 'button' }, 'generate');
    const randomBtn = el('button', { type: 'button' }, 'random seed');
    const btnRow = el('div', { class: 'button-row' }, generateBtn, randomBtn);
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
    randomBtn.addEventListener('click', () => {
      const rolled = randomSeed();
      this.seedInput.value = rolled;
      toast(`Rolled seed ${rolled}`, { type: 'info', durationMs: 2000 });
      fire();
    });

    // A new fixture brings its own seed back into the field.
    this.select.addEventListener('change', () => {
      this.seedInput.value = '';
      fire();
    });

    this.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fire();
      }
    });

    this.root = el(
      'div',
      { class: 'panel-section' },
      el('h2', {}, 'request'),
      field('fixture', this.select),
      field('seed', this.seedInput),
      btnRow,
      this.errorBox,
    );
  }

  currentRequest(): unknown {
    const req = structuredClone(this.fixtures[this.select.value]) as { seed?: string };
    const typed = this.seedInput.value.trim();
    const seed = typed || (typeof req.seed === 'string' && req.seed ? req.seed : randomSeed());
    this.seedInput.value = seed;
    req.seed = seed;
    return req;
  }

  showError(message: string): void {
    this.errorBox.textContent = message;
    toast(message, { type: 'error', durationMs: 4500 });
  }
}
