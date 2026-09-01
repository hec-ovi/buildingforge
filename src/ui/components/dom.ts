// Tiny DOM factories shared by widgets and views.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child != null) {
      node.append(child);
    }
  }
  return node;
}

export function field(
  labelText: string,
  control: HTMLElement,
  rightElement?: HTMLElement | string,
): HTMLElement {
  if (rightElement) {
    const header = el(
      'div',
      { class: 'field-header' },
      el('label', {}, labelText),
      typeof rightElement === 'string' ? el('span', { class: 'field-value' }, rightElement) : rightElement,
    );
    return el('div', { class: 'field' }, header, control);
  }
  return el('div', { class: 'field' }, el('label', {}, labelText), control);
}

export function toggle(
  labelText: string,
  onChange: (on: boolean) => void,
  initialChecked = false,
): HTMLElement {
  const box = el('input', { type: 'checkbox', class: 'toggle-input' });
  box.checked = initialChecked;

  const indicator = el('span', { class: 'toggle-box' });
  const text = el('span', { class: 'toggle-label' }, labelText);
  const label = el('label', { class: `toggle ${initialChecked ? 'is-checked' : ''}` }, box, indicator, text);

  box.addEventListener('change', () => {
    if (box.checked) {
      label.classList.add('is-checked');
    } else {
      label.classList.remove('is-checked');
    }
    onChange(box.checked);
  });

  return label;
}
