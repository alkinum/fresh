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
  import { onDestroy, tick } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { MAX_NOTE_CONTENT_CHARACTERS } from '$lib/note-limits';
  import type { NoteDto } from '$lib/types';

  interface SaveContentResult {
    note: NoteDto;
    created: boolean;
  }

  let {
    note = null,
    hidden = false,
    initialContent = '',
    renderContent,
    saveContent,
    onSaved,
    onCancel,
    onError
  }: {
    note?: NoteDto | null;
    hidden?: boolean;
    initialContent?: string;
    renderContent?: (content: string) => string | Promise<string>;
    saveContent?: (content: string, files: File[], note: NoteDto | null) => Promise<SaveContentResult>;
    onSaved: (note: NoteDto, created: boolean) => void;
    onCancel: () => void;
    onError: (message: string) => void;
  } = $props();

  let content = $state('');
  let baselineContent = $state('');
  let mode = $state<'write' | 'preview'>('write');
  let previewHtml = $state('');
  let previewError = $state('');
  let confirmation = $state<ConfirmDialog>();
  let pendingFiles = $state<File[]>([]);
  let draftNoteId = $state<string | null>(null);
  let draftIsNew = $state(false);
  let saving = $state(false);
  let rendering = $state(false);
  let contentError = $state('');
  let textarea = $state<HTMLTextAreaElement>();
  let activeId = $state<string | null | undefined>(undefined);
  let characterCount = $derived(content.trim().length);
  let initialized = false;
  const uploadIds = new WeakMap<File, string>();
  let previewRequestId = 0;
  let previewAbortController: AbortController | undefined;

  const maxAttachmentBytes = 95 * 1024 * 1024;
  const editorPlaceholder = '# A little room to think\n\nWrite a thought, make a list, or add a file…';

  export function hasUnsavedChanges(): boolean {
    return saving || pendingFiles.length > 0 || content !== baselineContent;
  }

  export async function canDiscard(): Promise<boolean> {
    if (saving) {
      onError('Please wait until your note finishes saving.');
      return false;
    }
    return (
      !hasUnsavedChanges() ||
      Boolean(
        await confirmation?.ask(
          'Discard unsaved changes?',
          'Your latest edits and pending attachments have not been saved.',
          'Discard changes'
        )
      )
    );
  }

  export async function focusEditor(): Promise<void> {
    showWriteMode();
    await tick();
    textarea?.focus({ preventScroll: true });
    resizeTextarea();
  }

  function resizeTextarea(): void {
    if (!textarea || textarea.getClientRects().length === 0) return;
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
      cancelPreview();
      activeId = nextId;
      content = note?.content ?? (initialized ? '' : initialContent);
      baselineContent = content;
      previewHtml = note?.renderedContent ?? '';
      pendingFiles = [];
      contentError = '';
      previewError = '';
      draftNoteId = null;
      draftIsNew = false;
      mode = 'write';
      initialized = true;
    }
  });

  async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  function cancelPreview(): void {
    previewRequestId += 1;
    previewAbortController?.abort();
    previewAbortController = undefined;
    rendering = false;
  }

  function showWriteMode(): void {
    cancelPreview();
    mode = 'write';
  }

  async function renderPreview(): Promise<void> {
    previewAbortController?.abort();
    const requestId = ++previewRequestId;
    mode = 'preview';
    previewError = '';
    previewHtml = '';
    if (!content.trim()) {
      previewHtml = '';
      rendering = false;
      return;
    }

    const contentSnapshot = content;
    const controller = new AbortController();
    previewAbortController = controller;
    rendering = true;
    try {
      let html: string;
      if (renderContent) {
        html = await renderContent(contentSnapshot);
      } else {
        const response = await fetch('/api/markdown', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: contentSnapshot }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(await responseError(response));
        html = ((await response.json()) as { html: string }).html;
      }
      if (requestId === previewRequestId && mode === 'preview') previewHtml = html;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (requestId === previewRequestId) {
        previewError = error instanceof Error ? error.message : 'Could not render preview';
      }
    } finally {
      if (requestId === previewRequestId) {
        rendering = false;
        previewAbortController = undefined;
      }
    }
  }

  function addFiles(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const incoming = [...(input.files ?? [])];
    const emptyFiles = incoming.filter((file) => file.size === 0);
    const oversizedFiles = incoming.filter((file) => file.size > maxAttachmentBytes);
    const acceptedFiles = incoming.filter((file) => file.size > 0 && file.size <= maxAttachmentBytes);
    if (emptyFiles.length > 0 || oversizedFiles.length > 0) {
      const messages = [
        emptyFiles.length > 0
          ? `${emptyFiles.length} empty ${emptyFiles.length === 1 ? 'file was' : 'files were'} not added.`
          : '',
        oversizedFiles.length > 0
          ? `${oversizedFiles.length} ${oversizedFiles.length === 1 ? 'file exceeds' : 'files exceed'} the 95 MiB limit.`
          : ''
      ].filter(Boolean);
      onError(messages.join(' '));
    }
    for (const file of acceptedFiles) fileKey(file);
    pendingFiles = [...pendingFiles, ...acceptedFiles];
    input.value = '';
  }

  function fileKey(file: File): string {
    const existing = uploadIds.get(file);
    if (existing) return existing;
    const id = crypto.randomUUID();
    uploadIds.set(file, id);
    return id;
  }

  function insertMarkdown(prefix: string, suffix = prefix, placeholder = ''): void {
    if (!textarea || mode !== 'write' || saving) return;
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
    for (const file of [...pendingFiles]) {
      const uploadId = uploadIds.get(file) ?? crypto.randomUUID();
      uploadIds.set(file, uploadId);
      const response = await fetch(`/api/notes/${noteId}/attachments`, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name),
          'x-file-size': String(file.size),
          'x-upload-id': uploadId
        },
        body: file
      });
      if (!response.ok) throw new Error(await responseError(response));
      uploaded.push((await response.json()) as NoteDto['attachments'][number]);
      pendingFiles = pendingFiles.filter((item) => item !== file);
    }
    return uploaded;
  }

  async function save(): Promise<void> {
    if (saving) return;
    if (!content.trim()) {
      contentError = 'Write something before saving.';
      showWriteMode();
      await tick();
      textarea?.focus();
      return;
    }
    if (content.length > MAX_NOTE_CONTENT_CHARACTERS) {
      contentError = 'This note exceeds the 1,000,000 character limit.';
      return;
    }
    contentError = '';
    saving = true;
    const noteId = note?.id ?? draftNoteId;
    const created = note === null && (draftNoteId === null || draftIsNew);

    try {
      if (saveContent) {
        const result = await saveContent(content, pendingFiles, note);
        pendingFiles = [];
        draftNoteId = null;
        draftIsNew = false;
        onSaved(result.note, result.created);
        if (result.created) {
          content = '';
          baselineContent = '';
          previewHtml = '';
          mode = 'write';
        }
        return;
      }

      const response = await fetch(noteId ? `/api/notes/${noteId}` : '/api/notes', {
        method: noteId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error(await responseError(response));
      const saved = (await response.json()) as NoteDto;
      if (!noteId) {
        draftNoteId = saved.id;
        draftIsNew = true;
      }
      const uploaded = await uploadFiles(saved.id);
      saved.attachments = [
        ...new Map([...uploaded, ...saved.attachments].map((attachment) => [attachment.id, attachment])).values()
      ];
      pendingFiles = [];
      draftNoteId = null;
      draftIsNew = false;
      onSaved(saved, created);
      if (created) {
        content = '';
        baselineContent = '';
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

  function handleInput(): void {
    if (contentError && content.trim()) contentError = '';
    resizeTextarea();
  }

  onDestroy(cancelPreview);
</script>

<section class="composer" {hidden} aria-label={note ? 'Edit note' : 'New note'}>
  <div class="composer-heading">
    <div><PenLine size={16} /><strong>{note ? 'Editing note' : 'A fresh thought'}</strong></div>
    <span>{note ? note.title : 'Markdown, made simple'}</span>
  </div>
  <fieldset class="composer-controls" disabled={saving}>
    <legend class="sr-only">Note editor</legend>
    <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter
          id="fresh-attachment-file-lens"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.08 0.12" numOctaves="1" seed="17" result="lensMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="lensMap"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="refracted" />
          </feMerge>
        </filter>
      </defs>
    </svg>
    <div class="format-toolbar">
      <fieldset class="format-tools" disabled={mode === 'preview'} aria-label="Formatting">
        <button aria-label="Bold" title="Bold" onclick={() => insertMarkdown('**', '**', 'bold')}
          ><Bold size={16} /></button
        >
        <button aria-label="Italic" title="Italic" onclick={() => insertMarkdown('_', '_', 'italic')}
          ><Italic size={16} /></button
        >
        <button aria-label="Title heading" title="Heading 1" onclick={() => insertMarkdown('# ', '', 'Title')}
          ><Heading1 size={16} /></button
        >
        <button aria-label="List" title="List" onclick={() => insertMarkdown('- ', '', 'item')}
          ><List size={16} /></button
        >
        <button aria-label="Task list" title="Task list" onclick={() => insertMarkdown('- [ ] ', '', 'task')}
          ><ListChecks size={16} /></button
        >
        <button aria-label="Code" title="Code" onclick={() => insertMarkdown('`', '`', 'code')}
          ><Braces size={16} /></button
        >
        <button aria-label="Link" title="Link" onclick={() => insertMarkdown('[', '](https://)', 'label')}
          ><Link size={16} /></button
        >
        <button aria-label="Formula" title="KaTeX formula" onclick={() => insertMarkdown('$', '$', 'E = mc^2')}
          ><Sigma size={16} /></button
        >
        <label class="toolbar-upload" title="Attach files">
          <Paperclip size={16} />
          <span class="sr-only">Attach files</span>
          <input type="file" multiple onchange={addFiles} />
        </label>
      </fieldset>
      <div class="composer-modes">
        <div class="segmented-control" aria-label="Editor mode">
          <button class:active={mode === 'write'} aria-pressed={mode === 'write'} onclick={showWriteMode}>
            <PenLine size={15} /> <span>Write</span>
          </button>
          <button
            class:active={mode === 'preview'}
            aria-pressed={mode === 'preview'}
            onclick={() => void renderPreview()}
          >
            <Eye size={15} /> <span>Preview</span>
          </button>
        </div>
        {#if note}
          <button
            class="icon-button"
            aria-label="Cancel editing"
            title="Cancel editing"
            onclick={async () => {
              if (await canDiscard()) onCancel();
            }}
          >
            <X size={17} />
          </button>
        {/if}
      </div>
    </div>

    {#if mode === 'write'}
      <textarea
        bind:this={textarea}
        bind:value={content}
        oninput={handleInput}
        onkeydown={keyboardSave}
        aria-label="Note content"
        aria-invalid={contentError ? 'true' : undefined}
        aria-describedby={contentError ? 'note-content-error' : undefined}
        placeholder={editorPlaceholder}
        spellcheck="true"></textarea>
    {:else}
      <div class="composer-preview markdown-body" class:loading={rendering} aria-busy={rendering}>
        {#if rendering}
          <span class="muted">Rendering...</span>
        {:else if previewError}
          <p class="composer-error" role="alert">{previewError}</p>
          <button class="secondary-button" onclick={() => void renderPreview()}>Retry preview</button>
        {:else if previewHtml}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html previewHtml}
        {:else}
          <span class="muted">Nothing to preview</span>
        {/if}
      </div>
    {/if}

    {#if contentError}
      <p id="note-content-error" class="composer-error">{contentError}</p>
    {/if}

    {#if pendingFiles.length > 0}
      <ul class="pending-files" aria-label="Pending attachments">
        {#each pendingFiles as file, index (fileKey(file))}
          <li>
            <Paperclip size={13} />
            {file.name}
            <button
              aria-label={`Remove ${file.name}`}
              onclick={() => (pendingFiles = pendingFiles.filter((_, i) => i !== index))}
            >
              <X size={13} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="composer-foot">
      <span class="composer-hint"
        >{characterCount
          ? `${characterCount.toLocaleString()} characters`
          : 'Start with # for a title. Add #tags to organize.'}</span
      >
      <button class="primary-button" disabled={saving} aria-busy={saving} onclick={() => void save()}>
        <Send size={15} />
        <span>{saving ? 'Saving...' : note ? 'Update' : 'Save note'}</span>
      </button>
    </div>
  </fieldset>
</section>

<ConfirmDialog bind:this={confirmation} />
