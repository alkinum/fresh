import { describe, expect, it } from 'vitest';
import { NoteCache } from '../src/lib/note-cache';
import type { NoteDto } from '../src/lib/types';

const note = (id: string, content = ''): NoteDto => ({
  id,
  title: id,
  content,
  renderedContent: content,
  date: '2026-09-17',
  colorIndicator: '#5288e8',
  isFavorite: false,
  createdAt: '',
  updatedAt: '',
  tags: [],
  attachments: [],
});

describe('bounded note cache', () => {
  it('evicts older bodies while retaining the visible working set during a long scroll', () => {
    const cache = new NoteCache(10);
    cache.put([note('editing')]);
    for (let page = 0; page < 100; page++) {
      const ids = Array.from({ length: 5 }, (_, index) => `${page}-${index}`);
      cache.protect(['editing', ...ids]);
      cache.put(ids.map((id) => note(id)));
      expect(cache.snapshot().size).toBeLessThanOrEqual(10);
      expect(cache.has('editing')).toBe(true);
      for (const id of ids) expect(cache.has(id)).toBe(true);
    }
    expect(cache.has('0-0')).toBe(false);
    cache.protect([]);
    cache.put(Array.from({ length: 10 }, (_, index) => note(`new-${index}`)));
    expect(cache.has('editing')).toBe(false);
  });

  it('bounds large Markdown bodies by bytes and allows only protected exceptions', () => {
    const cache = new NoteCache(180, 20_000);
    cache.put([note('first', 'a'.repeat(4000)), note('second', 'b'.repeat(4000))]);
    expect(cache.has('first')).toBe(false);
    expect(cache.bytes).toBeLessThanOrEqual(20_000);
    cache.protect(['large']);
    cache.put([note('large', 'c'.repeat(10_000))]);
    expect(cache.has('large')).toBe(true);
    expect(cache.has('second')).toBe(false);
    cache.protect([]);
    expect(cache.bytes).toBe(0);
    expect(cache.snapshot().size).toBe(0);
  });

  it('replaces and removes records without leaking byte accounting or stale snapshots', () => {
    const cache = new NoteCache();
    cache.put([note('a', 'old')]);
    const snapshot = cache.snapshot();
    cache.put([note('a', 'new'), note('b')]);
    expect(cache.peek('a')?.content).toBe('new');
    expect(snapshot.get('a')?.content).toBe('old');
    cache.delete('b');
    cache.delete('b');
    const expected = new NoteCache();
    expected.put([note('a', 'new')]);
    expect(cache.bytes).toBe(expected.bytes);
    cache.clear();
    expect(cache.bytes).toBe(0);
    expect(cache.has('a')).toBe(false);
  });
});
