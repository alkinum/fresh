interface ModalFocusOptions {
  active?: boolean;
  initialFocus?: string;
  onDismiss: () => void;
}

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function modalFocus(node: HTMLElement, initialOptions: ModalFocusOptions) {
  let options = initialOptions;
  let active = false;
  let returnFocus: HTMLElement | null = null;
  let previousOverflow = '';
  let lastFocusedWithin: HTMLElement | null = null;
  const backgroundInert = new Map<HTMLElement, boolean>();
  const backgroundObserver = new MutationObserver(() => {
    if (active) setBackgroundInert();
  });

  const focusableElements = (): HTMLElement[] => Array.from(
    node.querySelectorAll<HTMLElement>(focusableSelector)
  ).filter((element) => (
    element.getClientRects().length > 0
    && !element.closest('[inert]')
    && !element.closest('[aria-hidden="true"]')
  ));

  const focusInitial = (): void => {
    const requested = options.initialFocus
      ? node.querySelector<HTMLElement>(options.initialFocus)
      : node.querySelector<HTMLElement>('[data-dialog-initial-focus]');
    const target = requested ?? focusableElements()[0] ?? node;
    lastFocusedWithin = target;
    target.focus();
  };

  const setBackgroundInert = (): void => {
    const overlayRoot = node.closest<HTMLElement>('.dialog-layer') ?? node;
    let branch: HTMLElement = overlayRoot;

    while (branch.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of parent.children) {
        if (
          !(sibling instanceof HTMLElement)
          || sibling === branch
          || sibling.matches('.sidebar-scrim, [data-modal-live]')
        ) continue;
        if (!backgroundInert.has(sibling)) backgroundInert.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (parent === document.body) break;
      branch = parent;
    }
  };

  const restoreBackground = (): void => {
    for (const [element, wasInert] of backgroundInert) {
      if (element.isConnected) element.inert = wasInert;
    }
    backgroundInert.clear();
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.onDismiss();
      return;
    }
    if (event.key !== 'Tab') return;

    const elements = focusableElements();
    if (elements.length === 0) {
      event.preventDefault();
      node.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleFocusIn = (event: FocusEvent): void => {
    if (!active) return;
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (node.contains(target)) {
        lastFocusedWithin = target;
        return;
      }
      if (target.closest('[data-modal-live="context-menu"]')) return;
    }

    queueMicrotask(() => {
      if (!active || !node.isConnected || node.contains(document.activeElement)) return;
      const fallback = lastFocusedWithin?.isConnected && node.contains(lastFocusedWithin)
        ? lastFocusedWithin
        : null;
      (fallback ?? focusableElements()[0] ?? node).focus();
    });
  };

  const activate = (): void => {
    if (active) return;
    active = true;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setBackgroundInert();
    backgroundObserver.observe(document.body, { childList: true, subtree: true });
    node.addEventListener('keydown', handleKeydown);
    document.addEventListener('focusin', handleFocusIn, true);
    queueMicrotask(() => {
      if (active && node.isConnected) focusInitial();
    });
  };

  const deactivate = (): void => {
    if (!active) return;
    active = false;
    backgroundObserver.disconnect();
    node.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('focusin', handleFocusIn, true);
    document.body.style.overflow = previousOverflow;
    restoreBackground();
    const target = returnFocus;
    returnFocus = null;
    lastFocusedWithin = null;
    queueMicrotask(() => {
      const fallback = document.querySelector<HTMLElement>('[data-modal-fallback-focus]');
      const canReceiveFocus = (element: HTMLElement | null): element is HTMLElement => {
        if (
          !element?.isConnected
          || element.getClientRects().length === 0
          || element.closest('[inert]')
          || getComputedStyle(element).visibility === 'hidden'
        ) return false;
        const sidebar = element.closest<HTMLElement>('.sidebar');
        if (sidebar && !sidebar.classList.contains('open') && getComputedStyle(sidebar).position === 'fixed') {
          return false;
        }
        const bounds = element.getBoundingClientRect();
        return bounds.right > 0
          && bounds.bottom > 0
          && bounds.left < window.innerWidth
          && bounds.top < window.innerHeight;
      };
      const focusTarget = canReceiveFocus(target) ? target : canReceiveFocus(fallback) ? fallback : null;
      focusTarget?.focus();
    });
  };

  const sync = (): void => {
    if (options.active ?? true) activate();
    else deactivate();
  };

  node.tabIndex = node.tabIndex < 0 ? node.tabIndex : -1;
  sync();

  return {
    update(nextOptions: ModalFocusOptions) {
      options = nextOptions;
      sync();
    },
    destroy() {
      deactivate();
    }
  };
}
