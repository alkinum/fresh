import { describe, expect, it } from 'vitest';
import { resolveContextMenuPosition } from '../src/lib/context-menu';

describe('context menu positioning', () => {
  it('end-aligns an anchored menu', () => {
    expect(
      resolveContextMenuPosition(
        { x: 200, y: 100, alignX: 'end' },
        { width: 180, height: 140 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 20, top: 100 });
  });

  it('flips left and above a pointer near the viewport edge', () => {
    expect(
      resolveContextMenuPosition(
        { x: 780, y: 580, fallbackY: 580 },
        { width: 180, height: 140 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 600, top: 440 });
  });

  it('uses an anchor fallback edge when opening above a trigger', () => {
    expect(
      resolveContextMenuPosition(
        { x: 400, y: 560, alignX: 'end', fallbackY: 520 },
        { width: 160, height: 120 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 240, top: 400 });
  });

  it('keeps an oversized menu inside the viewport gutter', () => {
    expect(
      resolveContextMenuPosition({ x: 100, y: 60 }, { width: 190, height: 140 }, { width: 160, height: 100 }),
    ).toEqual({ left: 8, top: 8 });
  });
});
