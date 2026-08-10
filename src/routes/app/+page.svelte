<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { LayoutDashboard, Menu, Plus, Search, X } from '@lucide/svelte';
  import { onDestroy, tick, untrack } from 'svelte';
  import BackupDialog from '$lib/components/BackupDialog.svelte';
  import KanbanWorkspace from '$lib/components/KanbanWorkspace.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import NoteComposer from '$lib/components/NoteComposer.svelte';
  import PasskeyDialog from '$lib/components/PasskeyDialog.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { authClient } from '$lib/auth-client';
  import type { AttachmentDto, KanbanBoardSummaryDto, NoteDto, PaginatedResult, TagDto } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let notes = $state<NoteDto[]>([]);
  let tags = $state<TagDto[]>([]);
  let kanbanBoards = $state<KanbanBoardSummaryDto[]>([]);
  let pagination = $state({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
  });
  let activeView = $state<'all' | 'favorites'>('all');
  let activeWorkspace = $state<'notes' | 'kanban'>('notes');
  let activeTagId = $state<string | null>(null);
  let activeBoardId = $state<string | null>(null);
  let createBoardRequest = $state(0);
  let search = $state('');
  let editing = $state<NoteDto | null>(null);
  let sidebarOpen = $state(false);
  let backupOpen = $state(false);
  let passkeysOpen = $state(false);
  let loading = $state(false);
  let notesRequestId = 0;
  let notesAbortController: AbortController | undefined;
  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let toastDeadline = 0;
  let toastRemaining = 0;

  const pageSize = 30;
  const successToastDuration = 6000;

  $effect(() => {
    const nextBoards = data.kanbanBoards ?? [];
    notes = data.notes?.items ?? [];
    tags = data.tags ?? [];
    kanbanBoards = nextBoards;
    const selectedBoardId = untrack(() => activeBoardId);
    if (!selectedBoardId || !nextBoards.some((board) => board.id === selectedBoardId)) {
      activeBoardId = nextBoards[0]?.id ?? null;
    }
    pagination = {
      currentPage: data.notes?.currentPage ?? 1,
      totalPages: data.notes?.totalPages ?? 0,
      totalItems: data.notes?.totalItems ?? 0,
    };
  });

  let visibleNotes = $derived.by(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.name.toLowerCase().includes(query)) ||
        note.attachments.some((attachment) => attachment.fileName.toLowerCase().includes(query)),
    );
  });

  function clearToastTimer(): void {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = undefined;
    toastDeadline = 0;
  }

  function dismissToast(): void {
    clearToastTimer();
    toastRemaining = 0;
    toast = null;
  }

  function scheduleToastDismiss(delay: number): void {
    clearToastTimer();
    toastRemaining = delay;
    toastDeadline = Date.now() + delay;
    toastTimer = setTimeout(dismissToast, delay);
  }

  function showToast(message: string, type: 'success' | 'error' = 'success'): void {
    clearToastTimer();
    toast = { message, type };
    if (type === 'success') scheduleToastDismiss(successToastDuration);
  }

  function pauseToastDismiss(): void {
    if (!toastTimer || toast?.type !== 'success') return;
    toastRemaining = Math.max(0, toastDeadline - Date.now());
    clearToastTimer();
  }

  function resumeToastDismiss(): void {
    if (toast?.type !== 'success' || toastTimer) return;
    scheduleToastDismiss(Math.max(1000, toastRemaining || successToastDuration));
  }

  function updateTotalItems(delta: number): void {
    const totalItems = Math.max(0, pagination.totalItems + delta);
    const totalPages = Math.ceil(totalItems / pageSize);
    pagination = {
      currentPage: totalPages === 0 ? 1 : Math.min(pagination.currentPage, totalPages),
      totalPages,
      totalItems,
    };
  }

  async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  function filterQuery(page = 1): URLSearchParams {
    // This object is created for a request only and is never component state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (activeView === 'favorites') query.set('favorite', 'true');
    if (activeTagId) query.set('tagId', activeTagId);
    return query;
  }

  async function loadNotes(page = 1, append = false): Promise<void> {
    if (append && loading) return;
    notesAbortController?.abort();
    const controller = new AbortController();
    const requestId = ++notesRequestId;
    notesAbortController = controller;
    loading = true;
    try {
      const response = await fetch(`/api/notes?${filterQuery(page)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as PaginatedResult<NoteDto>;
      if (requestId !== notesRequestId) return;
      notes = append ? [...notes, ...result.items] : result.items;
      pagination = {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      showToast(error instanceof Error ? error.message : 'Could not load notes', 'error');
    } finally {
      if (requestId === notesRequestId) loading = false;
    }
  }

  onDestroy(() => {
    notesAbortController?.abort();
    clearToastTimer();
  });

  async function refreshTags(): Promise<void> {
    const response = await fetch('/api/tags');
    if (response.ok) tags = (await response.json()) as TagDto[];
  }

  function changeView(view: 'all' | 'favorites'): void {
    if (activeView === view && (view !== 'favorites' || activeTagId === null)) return;
    activeView = view;
    if (view === 'favorites') activeTagId = null;
    void loadNotes();
  }

  function changeWorkspace(workspace: 'notes' | 'kanban'): void {
    activeWorkspace = workspace;
  }

  function selectBoard(id: string | null): void {
    activeBoardId = id;
    activeWorkspace = 'kanban';
  }

  function changeTag(id: string | null): void {
    if (activeTagId === id) return;
    activeTagId = id;
    activeView = 'all';
    void loadNotes();
  }

  function savedNote(note: NoteDto, created: boolean): void {
    const matchesFilter =
      (activeView !== 'favorites' || note.isFavorite) &&
      (!activeTagId || note.tags.some((tag) => tag.id === activeTagId));
    const index = notes.findIndex((item) => item.id === note.id);
    if (!matchesFilter && index >= 0) {
      notes.splice(index, 1);
      updateTotalItems(-1);
    }
    else if (matchesFilter && index >= 0) notes[index] = note;
    else if (matchesFilter) notes = [note, ...notes];
    notes = [...notes];
    editing = null;
    if (created && matchesFilter) updateTotalItems(1);
    showToast(created ? 'Note saved' : 'Note updated');
    void refreshTags();
  }

  async function toggleFavorite(note: NoteDto): Promise<void> {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isFavorite: !note.isFavorite }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = (await response.json()) as NoteDto;
      if (activeView === 'favorites' && !updated.isFavorite) {
        notes = notes.filter((item) => item.id !== note.id);
        updateTotalItems(-1);
      } else notes = notes.map((item) => (item.id === note.id ? updated : item));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update favorite', 'error');
    }
  }

  async function copyText(text: string, successMessage: string, failureMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch {
      showToast(failureMessage, 'error');
    }
  }

  function copyNote(note: NoteDto): void {
    void copyText(note.content, 'Markdown copied', 'Could not copy Markdown');
  }

  function copyTag(tag: TagDto): void {
    void copyText(`#${tag.name}`, 'Tag copied', 'Could not copy tag');
  }

  function copyBoard(board: KanbanBoardSummaryDto): void {
    void copyText(board.name, 'Board name copied', 'Could not copy board name');
  }

  async function toggleTask(note: NoteDto, taskIndex: number, checked: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskIndex, taskChecked: checked }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const updated = (await response.json()) as NoteDto;
      notes = notes.map((item) => (item.id === note.id ? updated : item));
      if (editing?.id === note.id) editing = updated;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update task', 'error');
      throw error;
    }
  }

  async function deleteNote(note: NoteDto): Promise<void> {
    if (!confirm(`Delete “${note.title}” and its attachments?`)) return;
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      notes = notes.filter((item) => item.id !== note.id);
      updateTotalItems(-1);
      if (editing?.id === note.id) editing = null;
      showToast('Note deleted');
      void refreshTags();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete note', 'error');
    }
  }

  async function deleteAttachment(note: NoteDto, attachment: AttachmentDto): Promise<void> {
    if (!confirm(`Delete “${attachment.fileName}”?`)) return;
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      notes = notes.map((item) =>
        item.id === note.id
          ? { ...item, attachments: item.attachments.filter((file) => file.id !== attachment.id) }
          : item,
      );
      showToast('Attachment deleted');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete attachment', 'error');
    }
  }

  async function focusComposer(nextEditing: NoteDto | null): Promise<void> {
    activeWorkspace = 'notes';
    editing = nextEditing;
    await tick();
    const composer = document.querySelector<HTMLElement>('.composer');
    const textarea = composer?.querySelector<HTMLTextAreaElement>('textarea');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    composer?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    textarea?.focus({ preventScroll: true });
  }

  function editNote(note: NoteDto): void {
    void focusComposer(note);
  }

  async function logout(): Promise<void> {
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message ?? 'Could not sign out');
      location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign out', 'error');
    }
  }

  async function backupImported(): Promise<void> {
    await invalidateAll();
    location.reload();
  }
</script>

<a class="skip-link" href="#app-main">Skip to content</a>
<div class="app-shell">
  <Sidebar
    user={data.user}
    {tags}
    boards={kanbanBoards}
    {activeWorkspace}
    {activeView}
    {activeTagId}
    {activeBoardId}
    open={sidebarOpen}
    onView={changeView}
    onTag={changeTag}
    onCopyTag={copyTag}
    onWorkspace={changeWorkspace}
    onBoard={(id) => selectBoard(id)}
    onCopyBoard={copyBoard}
    onCreateBoard={() => {
      activeWorkspace = 'kanban';
      createBoardRequest += 1;
      sidebarOpen = false;
    }}
    onPasskeys={() => {
      passkeysOpen = true;
      sidebarOpen = false;
    }}
    onBackup={() => {
      backupOpen = true;
      sidebarOpen = false;
    }}
    onLogout={() => void logout()}
    onClose={() => (sidebarOpen = false)}
  />

  <main id="app-main" class="workspace">
    <header class="mobile-header">
      <button
        class="icon-button"
        data-modal-fallback-focus
        aria-label="Open navigation"
        title="Menu"
        onclick={() => (sidebarOpen = true)}
      >
        <Menu size={19} />
      </button>
      <div class="mobile-brand">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </div>
      <button
        class="icon-button"
        aria-label={activeWorkspace === 'notes' ? 'New note' : 'New board'}
        title={activeWorkspace === 'notes' ? 'New note' : 'New board'}
        onclick={() => (activeWorkspace === 'notes' ? void focusComposer(null) : (createBoardRequest += 1))}
      >
        {#if activeWorkspace === 'notes'}<Plus size={19} />{:else}<LayoutDashboard size={19} />{/if}
      </button>
    </header>

    <div class:kanban-mode={activeWorkspace === 'kanban'} class="workspace-inner">
      {#if activeWorkspace === 'notes'}
        <NoteComposer
          note={editing}
          onSaved={savedNote}
          onCancel={() => (editing = null)}
          onError={(message) => showToast(message, 'error')}
        />

        <div class="notes-header">
          <div>
            <h1>
              {activeView === 'favorites'
                ? 'Favorites'
                : activeTagId
                  ? `#${tags.find((tag) => tag.id === activeTagId)?.name ?? 'Tag'}`
                  : 'Notes'}
            </h1>
            <span>{pagination.totalItems}</span>
          </div>
          <label class="search-box">
            <Search size={16} />
            <span class="sr-only">Search notes</span>
            <input bind:value={search} type="search" placeholder="Search notes" />
            {#if search}
              <button aria-label="Clear search" title="Clear" onclick={() => (search = '')}><X size={14} /></button>
            {/if}
          </label>
        </div>

        {#if visibleNotes.length > 0}
          <div class="notes-grid">
            {#each visibleNotes as note (note.id)}
              <NoteCard
                {note}
                onFavorite={(item) => void toggleFavorite(item)}
                onEdit={editNote}
                onCopy={copyNote}
                onDelete={(item) => void deleteNote(item)}
                onDeleteAttachment={(item, attachment) => void deleteAttachment(item, attachment)}
                onTag={changeTag}
                onCopyTag={copyTag}
                onTaskToggle={toggleTask}
              />
            {/each}
          </div>
          {#if pagination.currentPage < pagination.totalPages}
            <button
              class="load-more"
              disabled={loading}
              onclick={() => void loadNotes(pagination.currentPage + 1, true)}
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          {/if}
        {:else}
          <div class="empty-state">
            <div class="empty-glyph"><Plus size={22} /></div>
            <h2>{search ? 'No matching notes' : 'Your next note starts here'}</h2>
          </div>
        {/if}
      {:else}
        <KanbanWorkspace
          initialBoards={kanbanBoards}
          {activeBoardId}
          createRequest={createBoardRequest}
          onBoardsChange={(boards) => (kanbanBoards = boards)}
          onSelectBoard={selectBoard}
          onError={(message) => showToast(message, 'error')}
          onSuccess={(message) => showToast(message)}
        />
      {/if}
    </div>
  </main>
</div>

<BackupDialog
  open={backupOpen}
  onClose={() => (backupOpen = false)}
  onComplete={backupImported}
  onError={(message) => showToast(message, 'error')}
/>

<PasskeyDialog
  open={passkeysOpen}
  onClose={() => (passkeysOpen = false)}
  onError={(message) => showToast(message, 'error')}
/>

<p class="sr-only" data-modal-live role="status">{toast?.type === 'success' ? toast.message : ''}</p>
<p class="sr-only" data-modal-live role="alert">{toast?.type === 'error' ? toast.message : ''}</p>
{#if toast}
  <div
    class:error={toast.type === 'error'}
    class="toast"
    role="group"
    aria-label="Notification"
    onmouseenter={pauseToastDismiss}
    onmouseleave={resumeToastDismiss}
    onfocusin={pauseToastDismiss}
    onfocusout={resumeToastDismiss}
  >
    <span>{toast.message}</span>
    <button aria-label={`Dismiss notification: ${toast.message}`} title="Dismiss" onclick={dismissToast}>
      <X size={15} />
    </button>
  </div>
{/if}
