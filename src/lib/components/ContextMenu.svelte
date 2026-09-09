<script lang="ts">
  import { onDestroy, tick, type Snippet } from 'svelte';
  import {
    resolveContextMenuPosition,
    type ContextMenuInitialFocus,
    type ContextMenuPlacement
  } from '$lib/context-menu';

  let {
    id,
    label,
    placement,
    returnFocus,
    initialFocus = 'first',
    onClose,
    children
  }: {
    id: string;
    label: string;
    placement: ContextMenuPlacement;
    returnFocus: HTMLElement | null;
    initialFocus?: ContextMenuInitialFocus;
    onClose: () => void;
    children: Snippet;
  } = $props();

  let menuElement = $state<HTMLDivElement>();
  let left = $state(0);
  let top = $state(0);
  let ready = $state(false);
  let placementToken = 0;
  let restoreFocusOnDestroy = true;

  const pageFocusableSelector = [
    'a[href]',
    'button:not(:disabled)',
    'input:not(:disabled):not([type="hidden"])',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function portal(node: HTMLElement): { destroy: () => void } {
    node.ownerDocument.body.appendChild(node);
    return {
      destroy: () => node.remove()
    };
  }

  function menuItems(): HTMLElement[] {
    if (!menuElement) return [];
    return Array.from(
      menuElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)')
    );
  }

  function focusItem(items: HTMLElement[], index: number): void {
    if (items.length === 0) return;
    const normalizedIndex = (index + items.length) % items.length;
    for (const [itemIndex, item] of items.entries()) item.tabIndex = itemIndex === normalizedIndex ? 0 : -1;
    items[normalizedIndex].focus({ preventScroll: true });
  }

  async function placeMenu(
    requestedPlacement: ContextMenuPlacement,
    requestedInitialFocus: ContextMenuInitialFocus
  ): Promise<void> {
    const token = ++placementToken;
    ready = false;
    await tick();
    if (!menuElement || token !== placementToken) return;

    const bounds = menuElement.getBoundingClientRect();
    const position = resolveContextMenuPosition(
      requestedPlacement,
      { width: bounds.width, height: bounds.height },
      { width: window.innerWidth, height: window.innerHeight }
    );
    left = position.left;
    top = position.top;
    ready = true;

    await tick();
    if (token !== placementToken) return;
    const items = menuItems();
    focusItem(items, requestedInitialFocus === 'last' ? items.length - 1 : 0);
  }

  function dismiss(restoreFocus = false): void {
    const focusTarget = returnFocus;
    onClose();
    if (restoreFocus) {
      queueMicrotask(() => {
        if (focusTarget?.isConnected) focusTarget.focus();
      });
    }
  }

  function adjacentPageControl(backward: boolean): HTMLElement | null {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(pageFocusableSelector)).filter(
      (element) =>
        !menuElement?.contains(element) &&
        !element.closest('[inert]') &&
        !element.closest('[aria-hidden="true"]') &&
        element.getClientRects().length > 0
    );
    const triggerIndex = returnFocus ? candidates.indexOf(returnFocus) : -1;
    if (triggerIndex < 0) return returnFocus;
    return candidates[triggerIndex + (backward ? -1 : 1)] ?? returnFocus;
  }

  function dismissToPageControl(target: HTMLElement | null): void {
    restoreFocusOnDestroy = false;
    onClose();
    queueMicrotask(() => {
      if (target?.isConnected) target.focus();
    });
  }

  function handleKeydown(event: KeyboardEvent): void {
    const items = menuItems();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(items, currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(items, currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(items, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items, items.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      dismissToPageControl(adjacentPageControl(event.shiftKey));
    } else if (event.key === ' ' && document.activeElement instanceof HTMLAnchorElement) {
      event.preventDefault();
      document.activeElement.click();
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const query = event.key.toLocaleLowerCase();
      const orderedItems = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)];
      const match = orderedItems.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(query));
      if (match) {
        event.preventDefault();
        focusItem(items, items.indexOf(match));
      }
    }
  }

  function handleFocusOut(event: FocusEvent): void {
    if (event.relatedTarget instanceof Node && menuElement?.contains(event.relatedTarget)) return;
    queueMicrotask(() => {
      if (menuElement && !menuElement.contains(document.activeElement)) onClose();
    });
  }

  $effect(() => {
    const requestedPlacement = placement;
    const requestedInitialFocus = initialFocus;
    void placeMenu(requestedPlacement, requestedInitialFocus);
  });

  onDestroy(() => {
    if (restoreFocusOnDestroy && menuElement?.contains(document.activeElement) && returnFocus?.isConnected) {
      returnFocus.focus();
    }
  });

  $effect(() => {
    function closeFromPointer(event: PointerEvent | MouseEvent): void {
      if (!menuElement?.contains(event.target as Node)) onClose();
    }

    function closeFromViewport(): void {
      onClose();
    }

    window.addEventListener('pointerdown', closeFromPointer, true);
    window.addEventListener('contextmenu', closeFromPointer, true);
    window.addEventListener('resize', closeFromViewport);
    window.addEventListener('scroll', closeFromViewport, true);

    return () => {
      window.removeEventListener('pointerdown', closeFromPointer, true);
      window.removeEventListener('contextmenu', closeFromPointer, true);
      window.removeEventListener('resize', closeFromViewport);
      window.removeEventListener('scroll', closeFromViewport, true);
    };
  });
</script>

<div
  use:portal
  bind:this={menuElement}
  {id}
  class:ready
  class="context-menu"
  data-modal-live="context-menu"
  role="menu"
  tabindex="-1"
  aria-label={label}
  aria-orientation="vertical"
  style={`--context-menu-left: ${left}px; --context-menu-top: ${top}px`}
  onkeydown={handleKeydown}
  onfocusout={handleFocusOut}
>
  {@render children()}
</div>
