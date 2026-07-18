<script lang="ts">
  import {
    Bold,
    Braces,
    Eye,
    Heading1,
    Italic,
    Link,
    List,
    ListChecks,
    Paperclip,
    PenLine,
    Send,
    Sigma,
    X
  } from '@lucide/svelte';
  import type { NoteDto } from '$lib/types';

  let {
    note = null,
    onSaved,
    onCancel,
    onError
  }: {
    note?: NoteDto | null;
    onSaved: (note: NoteDto, created: boolean) => void;
    onCancel: () => void;
    onError: (message: string) => void;
  } = $props();

  let content = $state('');
  let mode = $state<'write' | 'preview'>('write');
  let previewHtml = $state('');
  let pendingFiles = $state<File[]>([]);
  let draftNoteId = $state<string | null>(null);
  let saving = $state(false);
  let rendering = $state(false);
  let textarea = $state<HTMLTextAreaElement>();
  let activeId = $state<string | null | undefined>(undefined);
  let characterCount = $derived(content.trim().length);

  function resizeTextarea(): void {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const styles = getComputedStyle(textarea);
    const minHeight = Number.parseFloat(styles.minHeight) || 172;
    const computedMaxHeight = Number.parseFloat(styles.maxHeight);
    const maxHeight = Number.isFinite(computedMaxHeight) ? computedMaxHeight : 680;
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    textarea.style.overflowY = contentHeight > maxHeight + 1 ? 'auto' : 'hidden';
  }

  $effect(() => {
    const contentSnapshot = content;
    if (mode !== 'write') return;
    const frame = requestAnimationFrame(() => {
      if (content === contentSnapshot) resizeTextarea();
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const nextId = note?.id ?? null;
    if (activeId !== nextId) {
      activeId = nextId;
      content = note?.content ?? '';
      previewHtml = note?.renderedContent ?? '';
      pendingFiles = [];
      draftNoteId = null;
      mode = 'write';
    }
  });

  async function responseError(response: Response): Promise<string> {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  async function renderPreview(): Promise<void> {
    mode = 'preview';
    if (!content.trim()) {
      previewHtml = '';
      return;
    }

    rendering = true;
    try {
      const response = await fetch('/api/markdown', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error(await responseError(response));
      previewHtml = ((await response.json()) as { html: string }).html;
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not render preview');
    } finally {
      rendering = false;
    }
  }

  function addFiles(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const incoming = [...(input.files ?? [])];
    pendingFiles = [...pendingFiles, ...incoming].filter(
      (file, index, files) => files.findIndex((item) => item.name === file.name && item.size === file.size) === index
    );
    input.value = '';
  }

  function insertMarkdown(prefix: string, suffix = prefix, placeholder = ''): void {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    content = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    const selectionStart = start + prefix.length;
    const input = textarea;
    if (!input) return;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }

  async function uploadFiles(noteId: string): Promise<NoteDto['attachments']> {
    const uploaded: NoteDto['attachments'] = [];
    for (const file of pendingFiles) {
      const response = await fetch(`/api/notes/${noteId}/attachments`, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name),
          'x-file-size': String(file.size)
        },
        body: file
      });
      if (!response.ok) throw new Error(await responseError(response));
      uploaded.push(await response.json() as NoteDto['attachments'][number]);
    }
    return uploaded;
  }

  async function save(): Promise<void> {
    if (!content.trim() || saving) return;
    saving = true;
    const noteId = note?.id ?? draftNoteId;
    const created = !noteId;

    try {
      const response = await fetch(noteId ? `/api/notes/${noteId}` : '/api/notes', {
        method: noteId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error(await responseError(response));
      const saved = await response.json() as NoteDto;
      if (created) draftNoteId = saved.id;
      const uploaded = await uploadFiles(saved.id);
      saved.attachments = [...uploaded, ...saved.attachments];
      pendingFiles = [];
      draftNoteId = null;
      onSaved(saved, created);
      if (created) {
        content = '';
        previewHtml = '';
        mode = 'write';
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save note');
    } finally {
      saving = false;
    }
  }

  function keyboardSave(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  }
</script>

<section class="composer" aria-label={note ? 'Edit note' : 'New note'}>
  <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter id="fresh-attachment-file-lens" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.08 0.12" numOctaves="1" seed="17" result="lensMap" />
        <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="refracted" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="refracted" />
        </feMerge>
      </filter>
    </defs>
  </svg>
  <div class="format-toolbar">
    <div class="format-tools" aria-label="Formatting">
      <button aria-label="Bold" title="Bold" onclick={() => insertMarkdown('**', '**', 'bold')}><Bold size={16} /></button>
      <button aria-label="Italic" title="Italic" onclick={() => insertMarkdown('_', '_', 'italic')}><Italic size={16} /></button>
      <button aria-label="Title heading" title="Heading 1" onclick={() => insertMarkdown('# ', '', 'Title')}><Heading1 size={16} /></button>
      <button aria-label="List" title="List" onclick={() => insertMarkdown('- ', '', 'item')}><List size={16} /></button>
      <button aria-label="Task list" title="Task list" onclick={() => insertMarkdown('- [ ] ', '', 'task')}><ListChecks size={16} /></button>
      <button aria-label="Code" title="Code" onclick={() => insertMarkdown('`', '`', 'code')}><Braces size={16} /></button>
      <button aria-label="Link" title="Link" onclick={() => insertMarkdown('[', '](https://)', 'label')}><Link size={16} /></button>
      <button aria-label="Formula" title="KaTeX formula" onclick={() => insertMarkdown('$', '$', 'E = mc^2')}><Sigma size={16} /></button>
      <label class="toolbar-upload" title="Attach files">
        <Paperclip size={16} />
        <span class="sr-only">Attach files</span>
        <input type="file" multiple onchange={addFiles} />
      </label>
    </div>
    <div class="composer-modes">
      <div class="segmented-control" aria-label="Editor mode">
        <button class:active={mode === 'write'} onclick={() => mode = 'write'}>
          <PenLine size={15} /> <span>Write</span>
        </button>
        <button class:active={mode === 'preview'} onclick={() => void renderPreview()}>
          <Eye size={15} /> <span>Preview</span>
        </button>
      </div>
      {#if note}
        <button class="icon-button" aria-label="Cancel editing" title="Cancel editing" onclick={onCancel}>
          <X size={17} />
        </button>
      {/if}
    </div>
  </div>

  {#if mode === 'write'}
    <textarea
      bind:this={textarea}
      bind:value={content}
      oninput={resizeTextarea}
      onkeydown={keyboardSave}
      placeholder="Write something fresh here..."
      spellcheck="true"
    ></textarea>
  {:else}
    <div class="composer-preview markdown-body" class:loading={rendering}>
      {#if rendering}
        <span class="muted">Rendering...</span>
      {:else if previewHtml}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html previewHtml}
      {:else}
        <span class="muted">Nothing to preview</span>
      {/if}
    </div>
  {/if}

  {#if pendingFiles.length > 0}
    <div class="pending-files" aria-label="Pending attachments">
      {#each pendingFiles as file, index (`${file.name}-${file.size}`)}
        <span>
          <Paperclip size={13} /> {file.name}
          <button aria-label={`Remove ${file.name}`} onclick={() => pendingFiles = pendingFiles.filter((_, i) => i !== index)}>
            <X size={13} />
          </button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="composer-foot">
    <span>{characterCount}</span>
    <button class="primary-button" disabled={!content.trim() || saving} onclick={() => void save()}>
      <Send size={15} />
      <span>{saving ? 'Saving...' : note ? 'Update' : 'Save note'}</span>
    </button>
  </div>
</section>
