import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import katex from 'katex';
import MarkdownIt from 'markdown-it';
import { full as emoji } from 'markdown-it-emoji';
import githubAlerts from 'markdown-it-github-alerts';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';

const languages = { bash, css, go, javascript, json, markdown, python, rust, typescript, xml, yaml };

for (const [name, language] of Object.entries(languages)) {
  hljs.registerLanguage(name, language);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight(code, language): string {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  }
})
  .use(emoji)
  .use(githubAlerts)
  .use(taskLists, { enabled: true })
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: {
      throwOnError: false,
      strict: 'warn',
      trust: false
    }
  });

const taskCheckboxPrefix = '<input class="task-list-item-checkbox"';

md.core.ruler.after('github-task-lists', 'fresh-task-items', (state: StateCore) => {
  const disableTasks = Boolean((state.env as { disableTaskInputs?: boolean }).disableTaskInputs);
  let taskIndex = 0;

  for (const block of state.tokens) {
    const checkbox = block.children?.find((token) => (
      token.type === 'html_inline' && token.content.startsWith(taskCheckboxPrefix)
    ));
    if (!checkbox) continue;

    const label = block.content.replace(/\s+/g, ' ').trim().slice(0, noteTitleLimit) || `Task ${taskIndex + 1}`;
    const attributes = [
      `data-task-index="${taskIndex}"`,
      `aria-label="Toggle task: ${md.utils.escapeHtml(label)}"`,
      disableTasks ? 'disabled="" aria-disabled="true"' : ''
    ].filter(Boolean).join(' ');

    checkbox.content = checkbox.content.replace('<input ', `<input ${attributes} `);
    checkbox.meta = { ...(checkbox.meta ?? {}), freshTaskIndex: taskIndex };
    block.meta = { ...(block.meta ?? {}), freshTaskIndex: taskIndex };
    taskIndex += 1;
  }
});

md.core.ruler.after('inline', 'fresh-tags', (state: StateCore) => {
  for (const block of state.tokens) {
    if (!block.children) continue;

    const children: NonNullable<typeof block.children> = [];
    for (const token of block.children) {
      if (token.type !== 'text' || !/(^|\s)#[\p{L}\p{N}_-]+/u.test(token.content)) {
        children.push(token);
        continue;
      }

      let cursor = 0;
      const pattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
      for (const match of token.content.matchAll(pattern)) {
        const index = match.index ?? 0;
        const prefix = match[1];
        const name = match[2];
        const before = token.content.slice(cursor, index) + prefix;
        if (before) {
          const text = new state.Token('text', '', 0);
          text.content = before;
          children.push(text);
        }

        const tag = new state.Token('html_inline', '', 0);
        const escaped = md.utils.escapeHtml(name);
        tag.meta = { freshTag: name };
        tag.content = `<span class="note-tag" data-tag="${escaped}">#${escaped}</span>`;
        children.push(tag);
        cursor = index + match[0].length;
      }

      const remainder = token.content.slice(cursor);
      if (remainder) {
        const text = new state.Token('text', '', 0);
        text.content = remainder;
        children.push(text);
      }
    }
    block.children = children;
  }
});

const fencePattern = /^\s*```/;
const tagPattern = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
const noteTitleLimit = 120;

type MarkdownToken = ReturnType<MarkdownIt['parse']>[number];

function tokenText(token: MarkdownToken): string {
  if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
  if (token.type === 'html_inline') {
    const tag = token.meta?.freshTag;
    return typeof tag === 'string' ? `#${tag}` : '';
  }
  if (token.children) return token.children.map(tokenText).join('');
  if (token.type === 'image') return token.content;
  return token.nesting === 0 ? token.content : '';
}

function normalizedTokenText(token: MarkdownToken | undefined): string {
  return token ? tokenText(token).replace(/\s+/g, ' ').trim() : '';
}

export function deriveNoteTitle(content: string): string {
  const tokens = md.parse(content, {});

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== 'heading_open' || tokens[index].tag !== 'h1') continue;
    const heading = normalizedTokenText(tokens[index + 1]);
    if (heading) return heading.slice(0, noteTitleLimit);
  }

  const fallback = tokens.find((token) => token.type === 'inline' && normalizedTokenText(token));
  return (normalizedTokenText(fallback) || 'Untitled note').slice(0, noteTitleLimit);
}

export function renderNoteBody(content: string): string {
  const env = {};
  const tokens = md.parse(content, env);
  const titleIndex = tokens.findIndex((token, index) => (
    token.type === 'heading_open'
    && token.tag === 'h1'
    && normalizedTokenText(tokens[index + 1])
  ));

  if (
    titleIndex >= 0
    && tokens[titleIndex + 1]?.type === 'inline'
    && tokens[titleIndex + 2]?.type === 'heading_close'
  ) {
    tokens.splice(titleIndex, 3);
  }

  return md.renderer.render(tokens, md.options, env);
}

const taskMarkerPattern = /^((?:\s*>\s*)*\s*(?:[-+*]|\d+[.)])\s+)\[([ xX])\](?=\s)/;

export function toggleTaskItem(content: string, index: number, checked: boolean): string | null {
  if (!Number.isInteger(index) || index < 0) return null;

  const tokens = md.parse(content, {});
  const task = tokens.find((token) => token.meta?.freshTaskIndex === index);
  const lineIndex = task?.map?.[0];
  if (lineIndex === undefined) return null;

  const lines = content.split('\n');
  const line = lines[lineIndex];
  const marker = line?.match(taskMarkerPattern);
  if (!marker) return null;

  const markerStart = marker[1].length;
  lines[lineIndex] = `${line.slice(0, markerStart)}[${checked ? 'x' : ' '}]${line.slice(markerStart + 3)}`;
  return lines.join('\n');
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  let inFence = false;

  for (const line of content.split('\n')) {
    if (fencePattern.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^\s*>/.test(line)) continue;
    for (const match of line.matchAll(tagPattern)) tags.add(match[1]);
  }

  return [...tags];
}

export function renderMarkdown(content: string): string {
  return md.render(content, { disableTaskInputs: true });
}
