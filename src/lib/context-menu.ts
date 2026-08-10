export type ContextMenuInitialFocus = 'first' | 'last';

export interface ContextMenuPlacement {
  x: number;
  y: number;
  alignX?: 'start' | 'end';
  fallbackY?: number;
}

interface Dimensions {
  width: number;
  height: number;
}

interface Point {
  left: number;
  top: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function resolveContextMenuPosition(
  placement: ContextMenuPlacement,
  menu: Dimensions,
  viewport: Dimensions,
  gutter = 8,
): Point {
  const maximumLeft = Math.max(gutter, viewport.width - menu.width - gutter);
  const maximumTop = Math.max(gutter, viewport.height - menu.height - gutter);

  let left = placement.alignX === 'end' ? placement.x - menu.width : placement.x;
  if (placement.alignX !== 'end' && left + menu.width > viewport.width - gutter) {
    left = placement.x - menu.width;
  }

  let top = placement.y;
  if (top + menu.height > viewport.height - gutter) {
    top = (placement.fallbackY ?? placement.y) - menu.height;
  }

  return {
    left: clamp(left, gutter, maximumLeft),
    top: clamp(top, gutter, maximumTop),
  };
}

export function contextMenuAtPointer(event: MouseEvent, fallback: HTMLElement): ContextMenuPlacement {
  if (event.clientX === 0 && event.clientY === 0) {
    const rect = fallback.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.bottom + 4,
      fallbackY: rect.top - 4,
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
    fallbackY: event.clientY,
  };
}

export function contextMenuAtElement(element: HTMLElement): ContextMenuPlacement {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.right,
    y: rect.bottom + 4,
    alignX: 'end',
    fallbackY: rect.top - 4,
  };
}

export function contextMenuReturnFocus(fallback: HTMLElement): HTMLElement {
  return document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : fallback;
}
