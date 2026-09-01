// Tiny DOM factories shared by widgets.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

export function field(labelText: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, el('label', {}, labelText), control);
}

export function toggle(labelText: string, onChange: (on: boolean) => void): HTMLElement {
  const box = el('input', { type: 'checkbox' });
  box.addEventListener('change', () => onChange(box.checked));
  return el('label', { class: 'toggle' }, box, labelText);
}
