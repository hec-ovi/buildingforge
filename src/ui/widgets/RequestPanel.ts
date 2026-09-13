import { Form } from '../components/Form.ts';
import { toast } from '../components/Toast.ts';
import { randomSeed } from '../../core/seed.ts';
import requestSchema from '../../../schemas/building-request.schema.json' with { type: 'json' };
import layout from '../views/preview.json' with { type: 'json' };

export interface RequestPanelEvents { onGenerate(request: unknown): void }

export class RequestPanel {
  readonly root: HTMLElement;
  private readonly form: Form;
  private readonly fixtures: Record<string, unknown>;

  constructor(fixtures: Record<string, unknown>, events: RequestPanelEvents) {
    this.fixtures = fixtures;
    const values = (items: string[]) => items.map(value => ({ value, label: value }));
    const options = requestSchema.properties.options.properties;
    this.form = new Form(layout.request, {
      fixtures: values(Object.keys(fixtures).sort()),
      shapes: values(options.shape.enum),
      styles: [{ value: 'auto', label: 'auto' }, ...options.exteriorStyle.enum.map(value => ({ value, label: value, group: value.split('-')[0]! }))],
    }, id => {
      if (id === 'fixture') { this.input('seed').value = ''; this.restoreOptions(); }
      if (id === 'random') this.input('seed').value = randomSeed();
      this.form.control('error').textContent = '';
      try { events.onGenerate(this.currentRequest()); }
      catch (error) { this.showError(error instanceof Error ? error.message : String(error)); }
    });
    this.root = this.form.root;
    this.restoreOptions();
  }

  currentRequest(): unknown {
    const request = structuredClone(this.fixtures[this.input('fixture').value]) as { seed?: string; options?: Record<string, unknown> };
    const seed = this.input('seed');
    seed.value = seed.value.trim() || request.seed || randomSeed();
    request.seed = seed.value;
    for (const [key, id] of [['exteriorStyle', 'style'], ['shape', 'shape']]) {
      const value = this.input(id!).value;
      if (value === 'auto') { if (request.options) delete request.options[key!]; }
      else { request.options ??= {}; request.options[key!] = value; }
    }
    return request;
  }

  showError(message: string): void {
    this.form.control('error').textContent = message;
    toast(message, { type: 'error', durationMs: 4500 });
  }

  private input(id: string): HTMLInputElement | HTMLSelectElement { return this.form.control(id); }
  private restoreOptions(): void {
    const request = this.fixtures[this.input('fixture').value] as { options?: Record<string, unknown> };
    this.input('style').value = String(request.options?.exteriorStyle ?? 'auto');
    this.input('shape').value = String(request.options?.shape ?? 'auto');
  }
}
