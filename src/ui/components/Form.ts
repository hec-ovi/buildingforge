import { el, field, toggle } from './dom.ts';

export interface Choice { value: string; label: string; group?: string }
export interface FormSchema {
  title: string;
  fields: { type: string; id: string; label?: string; aria?: string; placeholder?: string; class?: string;
    source?: string; options?: Choice[]; min?: number; max?: number; value?: number; suffix?: string;
    buttons?: { id: string; label: string; class?: string }[] }[];
}

/** Renders controls from JSON; the caller owns request and action handling. */
export class Form {
  readonly root = el('div', { class: 'panel-section' });
  private readonly controls = new Map<string, HTMLElement>();

  constructor(schema: FormSchema, choices: Record<string, Choice[]>, onEvent: (id: string) => void) {
    this.root.append(el('h2', {}, schema.title));
    for (const spec of schema.fields) {
      if (spec.type === 'toggle') {
        this.root.append(toggle(spec.label!, () => onEvent(spec.id)));
        this.controls.set(spec.id, this.root.lastElementChild!.querySelector('input')!);
        continue;
      }
      if (spec.type === 'buttons') {
        const row = el('div', { class: 'button-row' });
        for (const button of spec.buttons!) {
          const node = el('button', { type: 'button', class: button.class ?? '' }, button.label);
          node.addEventListener('click', () => onEvent(button.id));
          row.append(node);
        }
        this.root.append(row);
        continue;
      }
      const control = spec.type === 'slot' ? el('div', { class: spec.class ?? '' })
        : spec.type === 'select' ? el('select') : el('input', { type: spec.type });
      this.controls.set(spec.id, control);
      if (spec.aria) control.setAttribute('aria-label', spec.aria);
      if (spec.type === 'select') {
        const groups = new Map<string, HTMLElement>();
        for (const option of spec.options ?? choices[spec.source!] ?? []) {
          let parent: HTMLElement = control;
          if (option.group) {
            if (!groups.has(option.group)) {
              const group = el('optgroup', { label: option.group });
              groups.set(option.group, group); control.append(group);
            }
            parent = groups.get(option.group)!;
          }
          parent.append(el('option', { value: option.value }, option.label));
        }
        control.addEventListener('change', () => onEvent(spec.id));
      }
      if (control instanceof HTMLInputElement) {
        control.spellcheck = false;
        if (spec.placeholder) control.placeholder = spec.placeholder;
        for (const key of ['min', 'max', 'value'] as const) if (spec[key] !== undefined) control[key] = String(spec[key]);
        control.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onEvent(spec.id); } });
      }
      const value = spec.suffix ? el('span', { class: 'field-value' }, `${spec.value}${spec.suffix}`) : undefined;
      if (spec.type === 'range') control.addEventListener('input', () => {
        if (value) value.textContent = `${(control as HTMLInputElement).value}${spec.suffix}`;
        onEvent(spec.id);
      });
      this.root.append(spec.label ? field(spec.label, control, value) : control);
    }
  }

  control<T extends HTMLElement>(id: string): T { return this.controls.get(id) as T; }
}
