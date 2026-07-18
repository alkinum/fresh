import { describe, expect, it } from 'vitest';
import {
  deriveNoteTitle,
  extractTags,
  renderMarkdown,
  renderNoteBody,
  toggleTaskItem
} from '../src/lib/server/markdown';

describe('markdown pipeline', () => {
  it('renders KaTeX, tasks, and custom tags', () => {
    const html = renderMarkdown('- [x] ship $E = mc^2$ #release');
    expect(html).toContain('katex');
    expect(html).toContain('task-list-item');
    expect(html).toContain('data-task-index="0"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('note-tag');
  });

  it('does not render raw HTML', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('ignores tags inside fenced code and blockquotes', () => {
    const tags = extractTags('before #keep\n> #ignore\n```\n#also-ignore\n```');
    expect(tags).toEqual(['keep']);
  });

  it('uses the first parsed H1 as the note title', () => {
    const content = 'Intro paragraph\n\n```md\n# Not a title\n```\n\n# **Fresh** `ideas` #daily\n\n# Later';
    expect(deriveNoteTitle(content)).toBe('Fresh ideas #daily');
  });

  it('supports setext H1 titles and falls back to the first text block', () => {
    expect(deriveNoteTitle('Setext title\n============\n\nBody')).toBe('Setext title');
    expect(deriveNoteTitle('A note without a heading')).toBe('A note without a heading');
    expect(deriveNoteTitle('```\nconst value = 1;\n```')).toBe('Untitled note');
  });

  it('removes only the title H1 from rendered note bodies', () => {
    const html = renderNoteBody('#\n\n# Card title\n\nBody copy\n\n# Later heading');
    expect(html).not.toContain('Card title');
    expect(html).toContain('<p>Body copy</p>');
    expect(html).toContain('<h1>Later heading</h1>');
  });

  it('indexes rendered tasks and keeps saved-note tasks interactive', () => {
    const html = renderNoteBody('# Project\n\n- [ ] First\n- [x] Second');
    expect(html).toContain('data-task-index="0"');
    expect(html).toContain('data-task-index="1"');
    expect(html).not.toContain('disabled=""');
  });

  it('checks and unchecks the selected task item', () => {
    const content = '- [ ] First\n- [x] Second';
    expect(toggleTaskItem(content, 0, true)).toBe('- [x] First\n- [x] Second');
    expect(toggleTaskItem(content, 1, false)).toBe('- [ ] First\n- [ ] Second');
  });

  it('updates ordered and nested task items by parsed order', () => {
    const content = '1. [ ] Parent\n   - [ ] Child\n2. [x] Last';
    expect(toggleTaskItem(content, 1, true)).toBe('1. [ ] Parent\n   - [x] Child\n2. [x] Last');
    expect(toggleTaskItem(content, 2, false)).toBe('1. [ ] Parent\n   - [ ] Child\n2. [ ] Last');
  });

  it('ignores task syntax in fenced code and rejects invalid indexes', () => {
    const content = '```md\n- [ ] Example only\n```\n\n- [ ] Real task';
    expect(toggleTaskItem(content, 0, true)).toBe('```md\n- [ ] Example only\n```\n\n- [x] Real task');
    expect(toggleTaskItem(content, 1, true)).toBeNull();
    expect(toggleTaskItem(content, -1, true)).toBeNull();
  });
});
