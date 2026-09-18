<script lang="ts">
  import { useI18n } from '$lib/i18n.svelte';
  const i18n = useI18n();
  const t = i18n.t;

  import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
  import { FileText, LayoutDashboard, LoaderCircle, Menu, Plus, Search, Star, X } from '@lucide/svelte';
  import { onDestroy, tick, untrack } from 'svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import KanbanWorkspace from '$lib/components/KanbanWorkspace.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import NoteComposer from '$lib/components/NoteComposer.svelte';
  import VirtualNoteGrid from '$lib/components/VirtualNoteGrid.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { authClient } from '$lib/auth-client';
  import { NoteCache } from '$lib/note-cache';
  import type { AttachmentDto, KanbanBoardSummaryDto, NoteDto, PaginatedResult, TagDto } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let noteIds = $state<string[]>([]);
  const noteCache = new NoteCache();
  let cachedNotes = $state.raw<ReadonlyMap<string, NoteDto>>(noteCache.snapshot());
  let visibleIds: string[] = [];
  let feedRevision = $state(0);
  let restoreError = $state('');
  let restoreController: AbortController | undefined;
  let loadingMore = $state(false);
  let nearEnd = $state(false);
  let retryPage = 1;
  let retryAppend = false;
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
  let settingsOpen = $state(false);
  let accountProfilePatch = $state<Partial<typeof data.user>>({});
  let accountUser = $derived({ ...data.user, ...accountProfilePatch });
  let loading = $state(false);
  let loadError = $state('');
  let composer = $state<NoteComposer>();
  let confirmation = $state<ConfirmDialog>();
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let allowNavigation = false;
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
    const initialNotes = data.notes?.items ?? [];
    untrack(() => resetNotes(initialNotes));
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

  function cacheNotes(items: NoteDto[]): void {
    noteCache.put(items);
    cachedNotes = noteCache.snapshot();
  }

  function resetNotes(items: NoteDto[]): void {
    restoreController?.abort();
    restoreController = undefined;
    visibleIds = [];
    restoreError = '';
    noteCache.clear();
    noteIds = items.map((note) => note.id);
    cacheNotes(items);
    feedRevision += 1;
  }

  function removeNote(id: string): void {
    noteIds = noteIds.filter((item) => item !== id);
    noteCache.delete(id);
    cachedNotes = noteCache.snapshot();
  }

  function protectNotes(): void {
    noteCache.protect(editing ? [...visibleIds, editing.id] : visibleIds);
    cachedNotes = noteCache.snapshot();
  }

  $effect(() => {
    void editing;
    untrack(protectNotes);
  });

  function visibleNotes(ids: string[]): void {
    if (ids.length === visibleIds.length && ids.every((id, index) => id === visibleIds[index])) return;
    visibleIds = ids;
    protectNotes();
    void restoreNotes();
  }

  async function restoreNotes(): Promise<void> {
    // Coalesce rapid range changes into a single in-flight read. Aborting each
    // scroll event still makes the server do work and can starve visible rows.
    if (restoreController) return;
    restoreError = '';
    const missing = visibleIds.filter((id) => !noteCache.has(id)).slice(0, 100);
    if (!missing.length) return;
    const controller = new AbortController();
    restoreController = controller;
    let failed = false;
    try {
      const response = await fetch('/api/notes/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: missing }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const items = (await response.json()) as NoteDto[];
      if (controller.signal.aborted) return;
      // A task/favorite response may have updated the cache while this read was pending.
      cacheNotes(items.filter((item) => !noteCache.has(item.id) && noteIds.includes(item.id)));
      const returned = new Set(items.map((item) => item.id));
      const removed = missing.filter((id) => !returned.has(id) && noteIds.includes(id));
      if (removed.length) {
        noteIds = noteIds.filter((id) => !removed.includes(id));
        updateTotalItems(-removed.length);
      }
    } catch (error) {
      failed = true;
      if (!controller.signal.aborted)
        restoreError = error instanceof Error ? error.message : t('Could not reload notes');
    } finally {
      if (restoreController === controller) restoreController = undefined;
      if (
        !controller.signal.aborted &&
        (!failed || !missing.some((id) => visibleIds.includes(id))) &&
        visibleIds.some((id) => noteIds.includes(id) && !noteCache.has(id))
      )
        void restoreNotes();
    }
  }

  function watchEnd(node: HTMLElement) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        nearEnd = entry.isIntersecting;
      },
      { rootMargin: '800px' },
    );
    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
        nearEnd = false;
      },
    };
  }

  $effect(() => {
    if (
      activeWorkspace === 'notes' &&
      nearEnd &&
      !loading &&
      !loadError &&
      pagination.currentPage < pagination.totalPages
    ) {
      untrack(() => void loadNotes(pagination.currentPage + 1, true));
    }
  });

  let workspaceTitle = $derived(
    activeView === 'favorites'
      ? t('Favorites')
      : activeTagId
        ? `#${tags.find((tag) => tag.id === activeTagId)?.name ?? t('Tag')}`
        : t('Your notebook'),
  );

  beforeNavigate((navigation) => {
    if (allowNavigation || !composer?.hasUnsavedChanges()) return;
    navigation.cancel();
    if (!navigation.willUnload && navigation.to) {
      const destination = navigation.to.url;
      void composer.canDiscard().then(async (confirmed) => {
        if (!confirmed) return;
        allowNavigation = true;
        try {
          // SvelteKit has already resolved this navigation destination, including the base path.
          // eslint-disable-next-line svelte/no-navigation-without-resolve
          await goto(destination);
        } finally {
          allowNavigation = false;
        }
      });
    }
  });

  function searchNotes(): void {
    clearTimeout(searchTimer);
    notesAbortController?.abort();
    notesRequestId += 1;
    loading = true;
    loadingMore = false;
    loadError = '';
    searchTimer = setTimeout(() => void loadNotes(), 250);
  }

  function clearSearch(): void {
    search = '';
    void loadNotes();
  }

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
    return body?.error ?? t('Request failed ({status})', { status: response.status });
  }

  function filterQuery(page = 1): URLSearchParams {
    // This object is created for a request only and is never component state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (activeView === 'favorites') query.set('favorite', 'true');
    if (activeTagId) query.set('tagId', activeTagId);
    if (search.trim()) query.set('search', search.trim());
    return query;
  }

  async function loadNotes(page = 1, append = false): Promise<void> {
    if (append && loading) return;
    clearTimeout(searchTimer);
    notesAbortController?.abort();
    const controller = new AbortController();
    const requestId = ++notesRequestId;
    notesAbortController = controller;
    loading = true;
    loadingMore = append;
    loadError = '';
    retryPage = page;
    retryAppend = append;
    try {
      const response = await fetch(`/api/notes?${filterQuery(page)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as PaginatedResult<NoteDto>;
      if (requestId !== notesRequestId) return;
      if (append) {
        noteIds = [...new Set([...noteIds, ...result.items.map((note) => note.id)])];
        cacheNotes(result.items);
      } else {
        const header = document.querySelector('.notes-header');
        if (header && header.getBoundingClientRect().top < 0) {
          window.scrollTo({ top: header.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
        }
        resetNotes(result.items);
      }
      pagination = {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (requestId === notesRequestId) loadError = error instanceof Error ? error.message : t('Could not load notes');
    } finally {
      if (requestId === notesRequestId) loading = false;
    }
  }

  onDestroy(() => {
    notesAbortController?.abort();
    restoreController?.abort();
    clearTimeout(searchTimer);
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
    const index = noteIds.indexOf(note.id);
    if (!matchesFilter && index >= 0) {
      removeNote(note.id);
      updateTotalItems(-1);
    } else if (matchesFilter) {
      if (index < 0) noteIds = [note.id, ...noteIds];
      cacheNotes([note]);
    }
    editing = null;
    if (created && matchesFilter) updateTotalItems(1);
    showToast(created ? t('Note saved') : t('Note updated'));
    void refreshTags();
    void loadNotes();
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
        removeNote(note.id);
        updateTotalItems(-1);
      } else cacheNotes([updated]);
      void loadNotes();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Could not update favorite'), 'error');
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
    void copyText(note.content, t('Markdown copied'), t('Could not copy Markdown'));
  }

  function copyTag(tag: TagDto): void {
    void copyText(`#${tag.name}`, t('Tag copied'), t('Could not copy tag'));
  }

  function copyBoard(board: KanbanBoardSummaryDto): void {
    void copyText(board.name, t('Board name copied'), t('Could not copy board name'));
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
      cacheNotes([updated]);
      if (editing?.id === note.id) editing = updated;
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Could not update task'), 'error');
      throw error;
    }
  }

  async function deleteNote(note: NoteDto): Promise<void> {
    if (
      !(await confirmation?.ask(
        t('Delete this note?'),
        t('“{name}” and its attachments will be permanently deleted.', { name: note.title }),
      ))
    )
      return;
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      removeNote(note.id);
      updateTotalItems(-1);
      if (editing?.id === note.id) editing = null;
      showToast(t('Note deleted'));
      void refreshTags();
      void loadNotes();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Could not delete note'), 'error');
    }
  }

  async function deleteAttachment(note: NoteDto, attachment: AttachmentDto): Promise<void> {
    if (
      !(await confirmation?.ask(
        t('Delete this attachment?'),
        t('“{name}” will be permanently deleted.', { name: attachment.fileName }),
      ))
    )
      return;
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      const current = noteCache.peek(note.id) ?? note;
      cacheNotes([{ ...current, attachments: current.attachments.filter((file) => file.id !== attachment.id) }]);
      showToast(t('Attachment deleted'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Could not delete attachment'), 'error');
    }
  }

  async function focusComposer(nextEditing: NoteDto | null): Promise<void> {
    if (editing?.id !== nextEditing?.id && !(await composer?.canDiscard())) return;
    activeWorkspace = 'notes';
    editing = nextEditing;
    await tick();
    const element = document.querySelector<HTMLElement>('.composer');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    await composer?.focusEditor();
  }

  function editNote(note: NoteDto): void {
    void focusComposer(note);
  }

  async function logout(): Promise<void> {
    sidebarOpen = false;
    await tick();
    if (!(await composer?.canDiscard())) return;
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message ?? t('Could not sign out'));
      allowNavigation = true;
      location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Could not sign out'), 'error');
    }
  }

  async function backupImported(): Promise<void> {
    await invalidateAll();
    location.reload();
  }
</script>

<svelte:head><title>{activeWorkspace === 'notes' ? workspaceTitle : t('Kanban')} | Fresh</title></svelte:head>

<a class="skip-link" href="#app-main">{t('Skip to content')}</a>
<div class="app-shell">
  <Sidebar
    user={accountUser}
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
    onSettings={async () => {
      sidebarOpen = false;
      await tick();
      settingsOpen = true;
    }}
    onClose={() => (sidebarOpen = false)}
  />

  <main id="app-main" class="workspace">
    <header class="mobile-header">
      <button
        class="icon-button"
        data-modal-fallback-focus
        aria-label={t('Open navigation')}
        title={t('Menu')}
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
        aria-label={activeWorkspace === 'notes' ? t('New note') : t('New board')}
        title={activeWorkspace === 'notes' ? t('New note') : t('New board')}
        onclick={() => (activeWorkspace === 'notes' ? void focusComposer(null) : (createBoardRequest += 1))}
      >
        {#if activeWorkspace === 'notes'}<Plus size={19} />{:else}<LayoutDashboard size={19} />{/if}
      </button>
    </header>

    <div class:kanban-mode={activeWorkspace === 'kanban'} class="workspace-inner">
      <div hidden={activeWorkspace !== 'notes'}>
        <header class="workspace-heading">
          <div>
            <span class="workspace-eyebrow">{t('A little room to think')}</span>
            <h1>{workspaceTitle}</h1>
          </div>
          <button class="secondary-button" onclick={() => void focusComposer(null)}
            ><Plus size={16} /> {t('New note')}</button
          >
        </header>
      </div>
      <NoteComposer
        bind:this={composer}
        hidden={activeWorkspace !== 'notes'}
        note={editing}
        onSaved={savedNote}
        onCancel={() => (editing = null)}
        onError={(message) => showToast(message, 'error')}
      />

      <div hidden={activeWorkspace !== 'notes'}>
        <div class="notes-header">
          <div>
            <h2>{search.trim() ? t('Search results') : t('Saved notes')}</h2>
            <span>{loading ? '…' : pagination.totalItems}</span>
          </div>
          <label class="search-box">
            <Search size={16} />
            <span class="sr-only">{t('Search notes')}</span>
            <input
              bind:value={search}
              oninput={searchNotes}
              maxlength="200"
              type="search"
              placeholder={t('Search your notebook')}
            />
            {#if search}
              <button aria-label={t('Clear search')} title={t('Clear')} onclick={clearSearch}><X size={14} /></button>
            {/if}
          </label>
        </div>

        {#if loading && !loadingMore}
          <p class="notes-feedback" role="status"><LoaderCircle class="spin" size={16} /> {t('Loading notes…')}</p>
        {/if}
        {#if loadError}
          <div class="notes-feedback error" role="alert">
            <span>{t(loadError)}</span><button
              class="secondary-button"
              onclick={() => void loadNotes(retryPage, retryAppend)}>{t('Try again')}</button
            >
          </div>
        {/if}
        {#if noteIds.length > 0}
          <div aria-busy={loading && !loadingMore} inert={loading && !loadingMore}>
            {#key feedRevision}
              <VirtualNoteGrid
                ids={noteIds}
                notes={cachedNotes}
                active={activeWorkspace === 'notes'}
                onVisible={visibleNotes}
                error={restoreError}
                onRetry={() => void restoreNotes()}
              >
                {#snippet children(note, onRetain)}
                  <NoteCard
                    {note}
                    {onRetain}
                    onFavorite={toggleFavorite}
                    onEdit={editNote}
                    onCopy={copyNote}
                    onDelete={(item) => void deleteNote(item)}
                    onDeleteAttachment={(item, attachment) => void deleteAttachment(item, attachment)}
                    onTag={changeTag}
                    onCopyTag={copyTag}
                    onTaskToggle={toggleTask}
                  />
                {/snippet}
              </VirtualNoteGrid>
            {/key}
          </div>
          {#if pagination.currentPage < pagination.totalPages}
            <div use:watchEnd>
              <button
                class="load-more"
                disabled={loading}
                onclick={() => void loadNotes(pagination.currentPage + 1, true)}
              >
                {loading ? t('Loading...') : t('Load more')}
              </button>
            </div>
          {/if}
        {:else if !loading && !loadError}
          <div class="empty-state">
            <div class="empty-glyph">
              {#if search}<Search size={24} />{:else if activeView === 'favorites'}<Star size={24} />{:else}<FileText
                  size={24}
                />{/if}
            </div>
            <h2>
              {search
                ? t('No matching notes')
                : activeView === 'favorites'
                  ? t('Keep your favorites close')
                  : activeTagId
                    ? t('No notes with this tag')
                    : t('Your next note starts here')}
            </h2>
            <p>
              {search
                ? t('Try a different word, tag, or filename.')
                : activeView === 'favorites'
                  ? t('Tap the star on a note to find it here.')
                  : t('Save a thought above. Give it a #tag to make it easy to find.')}
            </p>
            <button
              class="secondary-button"
              onclick={() =>
                search ? clearSearch() : activeView === 'favorites' ? changeView('all') : void focusComposer(null)}
              >{search ? t('Clear search') : activeView === 'favorites' ? t('Browse notes') : t('Write a note')}</button
            >
          </div>
        {/if}
      </div>
      {#if activeWorkspace === 'kanban'}
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

<ConfirmDialog bind:this={confirmation} />

<SettingsDialog
  open={settingsOpen}
  user={accountUser}
  hasUnsavedChanges={composer?.hasUnsavedChanges() ?? false}
  onClose={() => (settingsOpen = false)}
  onProfileChange={(profile) => (accountProfilePatch = { ...accountProfilePatch, ...profile })}
  onLogout={() => void logout()}
  onBackupComplete={backupImported}
/>

<p class="sr-only" data-modal-live role="status">{toast?.type === 'success' ? toast.message : ''}</p>
<p class="sr-only" data-modal-live role="alert">{toast?.type === 'error' ? toast.message : ''}</p>
{#if toast}
  <div
    class:error={toast.type === 'error'}
    class="toast"
    role="group"
    aria-label={t('Notification')}
    onmouseenter={pauseToastDismiss}
    onmouseleave={resumeToastDismiss}
    onfocusin={pauseToastDismiss}
    onfocusout={resumeToastDismiss}
  >
    <span>{t(toast.message)}</span>
    <button
      aria-label={t('Dismiss notification: {message}', { message: t(toast.message) })}
      title={t('Dismiss')}
      onclick={dismissToast}
    >
      <X size={15} />
    </button>
  </div>
{/if}
