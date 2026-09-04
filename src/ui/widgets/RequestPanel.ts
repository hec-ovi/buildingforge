// Fixture picker, seed field, generate trigger. The seed field always shows the
// seed the building was built from, so any run can be reproduced; with none
// given, one is rolled and shown.

import { el, field } from '../components/dom.ts';
import { toast } from '../components/Toast.ts';
import { randomSeed } from '../../core/seed.ts';
import requestSchema from '../../../schemas/building-request.schema.json' with { type: 'json' };
import styleManifest from '../../../../materials/bindings/exterior-styles.json' with { type: 'json' };

export interface RequestPanelEvents {
  onGenerate(request: unknown): void;
}

export class RequestPanel {
  readonly root: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly seedInput: HTMLInputElement;
  private readonly styleSelect: HTMLSelectElement;
  private readonly shapeSelect: HTMLSelectElement;
  private readonly errorBox: HTMLElement;

  private readonly fixtures: Record<string, unknown>;

  constructor(fixtures: Record<string, unknown>, events: RequestPanelEvents) {
    this.fixtures = fixtures;
    this.select = el('select', { 'aria-label': 'Select fixture' });
    for (const name of Object.keys(fixtures).sort()) {
      this.select.append(el('option', { value: name }, name));
    }
    this.styleSelect = el('select', { 'aria-label': 'Exterior style' }, el('option', { value: 'auto' }, 'auto'));
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const style of styleManifest.styles) {
      let group = groups.get(style.group);
      if (!group) {
        group = el('optgroup', { label: style.group });
        groups.set(style.group, group);
        this.styleSelect.append(group);
      }
      group.append(el('option', { value: style.id }, style.id));
    }
    this.shapeSelect = el('select', { 'aria-label': 'Building shape' });
    for (const shape of requestSchema.properties.options.properties.shape.enum) {
      this.shapeSelect.append(el('option', { value: shape }, shape));
    }
    this.restoreFixtureOptions();
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
      this.restoreFixtureOptions();
      fire();
    });
    this.styleSelect.addEventListener('change', fire);
    this.shapeSelect.addEventListener('change', fire);

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
      field('style', this.styleSelect),
      field('shape', this.shapeSelect),
      field('seed', this.seedInput),
      btnRow,
      this.errorBox,
    );
  }

  currentRequest(): unknown {
    const req = structuredClone(this.fixtures[this.select.value]) as {
      seed?: string;
      options?: Record<string, unknown>;
    };
    const typed = this.seedInput.value.trim();
    const seed = typed || (typeof req.seed === 'string' && req.seed ? req.seed : randomSeed());
    this.seedInput.value = seed;
    req.seed = seed;
    for (const [key, value] of [['exteriorStyle', this.styleSelect.value], ['shape', this.shapeSelect.value]] as const) {
      if (value === 'auto') {
        if (req.options) delete req.options[key];
      } else {
        req.options ??= {};
        req.options[key] = value;
      }
    }
    return req;
  }

  private restoreFixtureOptions(): void {
    const req = this.fixtures[this.select.value] as { options?: Record<string, unknown> };
    this.styleSelect.value = typeof req.options?.exteriorStyle === 'string' ? req.options.exteriorStyle : 'auto';
    this.shapeSelect.value = typeof req.options?.shape === 'string' ? req.options.shape : 'auto';
  }

  showError(message: string): void {
    this.errorBox.textContent = message;
    toast(message, { type: 'error', durationMs: 4500 });
  }
}
