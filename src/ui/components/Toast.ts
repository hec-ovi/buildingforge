export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  durationMs?: number;
  type?: ToastType;
}

/**
 * Toast Notification System with square corners, fast slide/fade transitions,
 * and dark technical styling.
 */
export class ToastManager {
  private static instance: ToastManager | null = null;
  readonly root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'toast-container';
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
  }

  static get(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  show(message: string, options: ToastOptions = {}): HTMLElement {
    const { durationMs = 2800, type = 'info' } = options;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const badge = document.createElement('span');
    badge.className = 'toast-badge';
    badge.textContent =
      type === 'success' ? 'OK' :
      type === 'warning' ? 'WARN' :
      type === 'error' ? 'ERR' : 'SYS';

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';

    let timer: number | undefined;

    const dismiss = () => {
      if (timer) clearTimeout(timer);
      toast.classList.add('toast-exit');
      toast.addEventListener(
        'animationend',
        () => {
          toast.remove();
        },
        { once: true },
      );
      // Fallback removal if animationend doesn't fire in test environment
      setTimeout(() => toast.remove(), 160);
    };

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    toast.append(badge, text, closeBtn);
    this.root.appendChild(toast);

    if (durationMs > 0) {
      timer = window.setTimeout(dismiss, durationMs);
    }

    return toast;
  }
}

export const toast = (message: string, options?: ToastOptions) => ToastManager.get().show(message, options);
