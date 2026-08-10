<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { FilePenLine } from '@lucide/svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import NoteComposer from '$lib/components/NoteComposer.svelte';
  import type { AttachmentDto, AttachmentKind, NoteDto, TagDto } from '$lib/types';

  let { initialNote }: { initialNote: NoteDto } = $props();

  const initialDraft = `# Morning field notes

A quiet place for **clear thinking**.

- [x] Review sketches
- [ ] Share the final idea

\`const room = 'for wonder';\`

#design #morning`;
  const noteColors = ['#4f8cff', '#36b37e', '#f5a524', '#f05d5e', '#a879ff', '#e75b9b'];
  const previewKinds = new Map<string, AttachmentKind>([
    ['image/avif', 'image'],
    ['image/bmp', 'image'],
    ['image/gif', 'image'],
    ['image/jpeg', 'image'],
    ['image/png', 'image'],
    ['image/webp', 'image'],
    ['image/x-icon', 'image'],
    ['audio/aac', 'audio'],
    ['audio/flac', 'audio'],
    ['audio/mp4', 'audio'],
    ['audio/mpeg', 'audio'],
    ['audio/ogg', 'audio'],
    ['audio/wav', 'audio'],
    ['audio/webm', 'audio'],
    ['audio/x-wav', 'audio'],
    ['video/mp4', 'video'],
    ['video/ogg', 'video'],
    ['video/quicktime', 'video'],
    ['video/webm', 'video'],
    ['application/pdf', 'pdf']
  ]);
  const documentExtensions = new Set([
    'doc', 'docx', 'odt', 'pages', 'ppt', 'pptx', 'odp', 'key', 'xls', 'xlsx', 'ods', 'numbers', 'rtf'
  ]);
  const archiveExtensions = new Set(['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz']);

  let note = $state<NoteDto | null>(untrack(() => initialNote));
  let editing = $state<NoteDto | null>(null);
  let root = $state<HTMLDivElement>();
  let status = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const objectUrls = new SvelteSet<string>();

  function tagColor(name: string): string {
    let hash = 0;
    for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
    return `hsl(${hash % 360} 58% 64%)`;
  }

  function attachmentKind(file: File): AttachmentKind {
    const mediaType = file.type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const previewKind = previewKinds.get(mediaType);
    if (previewKind) return previewKind;
    if (mediaType.startsWith('text/') || ['md', 'markdown', 'json', 'yaml', 'yml', 'csv', 'log'].includes(extension)) {
      return 'text';
    }
    if (documentExtensions.has(extension) || mediaType.includes('officedocument') || mediaType.includes('opendocument')) {
      return 'document';
    }
    if (archiveExtensions.has(extension) || mediaType.includes('zip') || mediaType.includes('compressed')) {
      return 'archive';
    }
    return 'other';
  }

  function makeAttachments(files: File[], noteId: string, createdAt: string): AttachmentDto[] {
    return files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.add(url);
      return {
        id: crypto.randomUUID(),
        noteId,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        kind: attachmentKind(file),
        size: file.size,
        createdAt,
        url,
        downloadUrl: url
      };
    });
  }

  function releaseAttachment(attachment: AttachmentDto): void {
    if (!objectUrls.delete(attachment.url)) return;
    URL.revokeObjectURL(attachment.url);
  }

  function replaceNote(nextNote: NoteDto | null): void {
    const retainedUrls = new SvelteSet(nextNote?.attachments.map((attachment) => attachment.url) ?? []);
    note?.attachments.forEach((attachment) => {
      if (!retainedUrls.has(attachment.url)) releaseAttachment(attachment);
    });
    note = nextNote;
  }

  function showStatus(message: string): void {
    if (statusTimer) clearTimeout(statusTimer);
    status = message;
    statusTimer = setTimeout(() => (status = ''), 6000);
  }

  async function renderContent(content: string): Promise<string> {
    const { renderMarkdown } = await import('$lib/markdown');
    return renderMarkdown(content);
  }

  async function buildNote(content: string, existing: NoteDto | null, files: File[]): Promise<NoteDto> {
    const { deriveNoteTitle, extractTags, renderNoteBody } = await import('$lib/markdown');
    const normalizedContent = content.trim();
    const now = new Date().toISOString();
    const id = existing?.id ?? crypto.randomUUID();
    const colorIndex = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % noteColors.length;
    const existingTags = new Map(existing?.tags.map((tag) => [tag.name, tag]) ?? []);
    const tags: TagDto[] = extractTags(normalizedContent).map((name) => {
      const current = existingTags.get(name);
      return current ?? {
        id: `landing-tag-${name}`,
        name,
        color: tagColor(name),
        count: 1,
        createdAt: now,
        updatedAt: now
      };
    });

    return {
      id,
      title: deriveNoteTitle(normalizedContent),
      content: normalizedContent,
      renderedContent: renderNoteBody(normalizedContent),
      date: existing?.date ?? now.slice(0, 10),
      colorIndicator: existing?.colorIndicator ?? noteColors[colorIndex],
      isFavorite: existing?.isFavorite ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      tags,
      attachments: [...makeAttachments(files, id, now), ...(existing?.attachments ?? [])]
    };
  }

  async function saveContent(content: string, files: File[], currentNote: NoteDto | null) {
    return {
      note: await buildNote(content, currentNote, files),
      created: currentNote === null
    };
  }

  function savedNote(saved: NoteDto, created: boolean): void {
    replaceNote(saved);
    editing = null;
    showStatus(created ? 'Note saved' : 'Note updated');
  }

  function toggleFavorite(item: NoteDto): void {
    const updated = { ...item, isFavorite: !item.isFavorite };
    replaceNote(updated);
    if (editing?.id === item.id) editing = updated;
    showStatus(updated.isFavorite ? 'Added to favorites' : 'Removed from favorites');
  }

  async function editNote(item: NoteDto): Promise<void> {
    editing = item;
    await tick();
    root?.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root?.querySelector('.composer')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }

  async function copyText(value: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      showStatus(message);
    } catch {
      showStatus('Could not copy');
    }
  }

  function deleteNote(item: NoteDto): void {
    if (!confirm(`Delete “${item.title}” from this demo?`)) return;
    replaceNote(null);
    if (editing?.id === item.id) editing = null;
    showStatus('Note deleted');
  }

  function deleteAttachment(item: NoteDto, attachment: AttachmentDto): void {
    const updated = {
      ...item,
      attachments: item.attachments.filter((current) => current.id !== attachment.id)
    };
    releaseAttachment(attachment);
    note = updated;
    if (editing?.id === item.id) editing = updated;
    showStatus('Attachment deleted');
  }

  async function toggleTask(item: NoteDto, taskIndex: number, checked: boolean): Promise<void> {
    const { toggleTaskItem } = await import('$lib/markdown');
    const content = toggleTaskItem(item.content, taskIndex, checked);
    if (content === null) throw new Error('Task could not be updated');
    const updated = await buildNote(content, item, []);
    replaceNote(updated);
    if (editing?.id === item.id) editing = updated;
    showStatus('Task updated');
  }

  onDestroy(() => {
    if (statusTimer) clearTimeout(statusTimer);
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  });
</script>

<div class="landing-note-demo" bind:this={root} role="region" aria-label="Interactive note demo">
  <NoteComposer
    note={editing}
    initialContent={initialDraft}
    {renderContent}
    {saveContent}
    onSaved={savedNote}
    onCancel={() => (editing = null)}
    onError={showStatus}
  />

  {#if note}
    <NoteCard
      {note}
      onFavorite={toggleFavorite}
      onEdit={(item) => void editNote(item)}
      onCopy={(item) => void copyText(item.content, 'Markdown copied')}
      onDelete={deleteNote}
      onDeleteAttachment={deleteAttachment}
      onTag={(id) => showStatus(`Selected ${note?.tags.find((tag) => tag.id === id)?.name ?? 'tag'}`)}
      onCopyTag={(tag) => void copyText(`#${tag.name}`, 'Tag copied')}
      onTaskToggle={toggleTask}
    />
  {:else}
    <div class="landing-demo-empty">
      <FilePenLine size={22} aria-hidden="true" />
      <strong>Your next note starts here</strong>
    </div>
  {/if}

  <div class:visible={Boolean(status)} class="landing-demo-status" role="status" aria-atomic="true">{status}</div>
</div>

<style>
  .landing-note-demo {
    position: relative;
    min-width: 0;
  }

  .landing-note-demo :global(.composer) {
    box-shadow: var(--shadow-lg);
  }

  .landing-demo-empty {
    min-height: 180px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 9px;
    border-radius: var(--radius-panel);
    color: var(--muted);
    background: var(--surface-subtle);
    box-shadow: inset 0 1px 0 var(--glass-highlight);
  }

  .landing-demo-empty :global(svg) {
    color: var(--primary-hover);
  }

  .landing-demo-empty strong {
    color: var(--text);
    font-size: 13px;
  }

  .landing-demo-status {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 85;
    max-width: calc(100% - 24px);
    padding: 8px 11px;
    border-radius: var(--radius-small);
    color: var(--surface);
    background: var(--text);
    box-shadow: var(--shadow-lg);
    font-size: 11px;
    font-weight: 700;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 140ms ease,
      visibility 140ms ease;
  }

  .landing-demo-status.visible {
    opacity: 1;
    visibility: visible;
  }

  @media (max-width: 520px) {
    .landing-demo-status {
      position: fixed;
      right: 12px;
      bottom: 12px;
    }
  }
</style>
