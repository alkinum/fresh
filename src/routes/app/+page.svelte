<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { Menu, Plus, Search, X } from '@lucide/svelte';
  import BackupDialog from '$lib/components/BackupDialog.svelte';
  import NoteCard from '$lib/components/NoteCard.svelte';
  import NoteComposer from '$lib/components/NoteComposer.svelte';
  import PasskeyDialog from '$lib/components/PasskeyDialog.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { authClient } from '$lib/auth-client';
  import type { AttachmentDto, NoteDto, PaginatedResult, TagDto } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let notes = $state<NoteDto[]>([]);
  let tags = $state<TagDto[]>([]);
  let pagination = $state({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0
  });
  let activeView = $state<'all' | 'favorites'>('all');
  let activeTagId = $state<string | null>(null);
  let search = $state('');
  let editing = $state<NoteDto | null>(null);
  let sidebarOpen = $state(false);
  let backupOpen = $state(false);
  let passkeysOpen = $state(false);
  let loading = $state(false);
  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    notes = data.notes?.items ?? [];
    tags = data.tags ?? [];
    pagination = {
      currentPage: data.notes?.currentPage ?? 1,
      totalPages: data.notes?.totalPages ?? 0,
      totalItems: data.notes?.totalItems ?? 0
    };
  });

  let visibleNotes = $derived.by(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      note.title.toLowerCase().includes(query)
      || note.content.toLowerCase().includes(query)
      || note.tags.some((tag) => tag.name.toLowerCase().includes(query))
      || note.attachments.some((attachment) => attachment.fileName.toLowerCase().includes(query))
    );
  });

  function showToast(message: string, type: 'success' | 'error' = 'success'): void {
    if (toastTimer) clearTimeout(toastTimer);
    toast = { message, type };
    toastTimer = setTimeout(() => toast = null, 3800);
  }

  async function responseError(response: Response): Promise<string> {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  function filterQuery(page = 1): URLSearchParams {
    // This object is created for a request only and is never component state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const query = new URLSearchParams({ page: String(page), limit: '30' });
    if (activeView === 'favorites') query.set('favorite', 'true');
    if (activeTagId) query.set('tagId', activeTagId);
    return query;
  }

  async function loadNotes(page = 1, append = false): Promise<void> {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(`/api/notes?${filterQuery(page)}`);
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as PaginatedResult<NoteDto>;
      notes = append ? [...notes, ...result.items] : result.items;
      pagination = {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems
      };
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load notes', 'error');
    } finally {
      loading = false;
    }
  }

  async function refreshTags(): Promise<void> {
    const response = await fetch('/api/tags');
    if (response.ok) tags = await response.json() as TagDto[];
  }

  function changeView(view: 'all' | 'favorites'): void {
    if (activeView === view && (view !== 'favorites' || activeTagId === null)) return;
    activeView = view;
    if (view === 'favorites') activeTagId = null;
    void loadNotes();
  }

  function changeTag(id: string | null): void {
    if (activeTagId === id) return;
    activeTagId = id;
    activeView = 'all';
    void loadNotes();
  }

  function savedNote(note: NoteDto, created: boolean): void {
    const matchesFilter = (activeView !== 'favorites' || note.isFavorite)
      && (!activeTagId || note.tags.some((tag) => tag.id === activeTagId));
    const index = notes.findIndex((item) => item.id === note.id);
    if (!matchesFilter && index >= 0) notes.splice(index, 1);
    else if (matchesFilter && index >= 0) notes[index] = note;
    else if (matchesFilter) notes = [note, ...notes];
    notes = [...notes];
    editing = null;
    if (created && matchesFilter) pagination.totalItems += 1;
    showToast(created ? 'Note saved' : 'Note updated');
    void refreshTags();
  }

  async function toggleFavorite(note: NoteDto): Promise<void> {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isFavorite: !note.isFavorite })
      });
      if (!response.ok) throw new Error(await responseError(response));
      const updated = await response.json() as NoteDto;
      if (activeView === 'favorites' && !updated.isFavorite) {
        notes = notes.filter((item) => item.id !== note.id);
        pagination.totalItems = Math.max(0, pagination.totalItems - 1);
      } else notes = notes.map((item) => item.id === note.id ? updated : item);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update favorite', 'error');
    }
  }

  async function toggleTask(note: NoteDto, taskIndex: number, checked: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskIndex, taskChecked: checked })
      });
      if (!response.ok) throw new Error(await responseError(response));

      const updated = await response.json() as NoteDto;
      notes = notes.map((item) => item.id === note.id ? updated : item);
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
      pagination.totalItems = Math.max(0, pagination.totalItems - 1);
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
      notes = notes.map((item) => item.id === note.id
        ? { ...item, attachments: item.attachments.filter((file) => file.id !== attachment.id) }
        : item
      );
      showToast('Attachment deleted');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete attachment', 'error');
    }
  }

  function editNote(note: NoteDto): void {
    editing = note;
    document.querySelector('.composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function logout(): Promise<void> {
    await authClient.signOut();
    location.reload();
  }

  async function backupImported(): Promise<void> {
    await invalidateAll();
    location.reload();
  }
</script>

<div class="app-shell">
  <Sidebar
    user={data.user}
    {tags}
    {activeView}
    {activeTagId}
    open={sidebarOpen}
    onView={changeView}
    onTag={changeTag}
    onPasskeys={() => { passkeysOpen = true; sidebarOpen = false; }}
    onBackup={() => { backupOpen = true; sidebarOpen = false; }}
    onLogout={() => void logout()}
    onClose={() => sidebarOpen = false}
  />

  <main class="workspace">
    <header class="mobile-header">
      <button class="icon-button" aria-label="Open navigation" title="Menu" onclick={() => sidebarOpen = true}>
        <Menu size={19} />
      </button>
      <div class="mobile-brand">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </div>
      <button class="icon-button" aria-label="New note" title="New note" onclick={() => editing = null}>
        <Plus size={19} />
      </button>
    </header>

    <div class="workspace-inner">
      <NoteComposer
        note={editing}
        onSaved={savedNote}
        onCancel={() => editing = null}
        onError={(message) => showToast(message, 'error')}
      />

      <div class="notes-header">
        <div>
          <h1>{activeView === 'favorites' ? 'Favorites' : activeTagId ? `#${tags.find((tag) => tag.id === activeTagId)?.name ?? 'Tag'}` : 'Notes'}</h1>
          <span>{pagination.totalItems}</span>
        </div>
        <label class="search-box">
          <Search size={16} />
          <input bind:value={search} type="search" placeholder="Search notes" />
          {#if search}
            <button aria-label="Clear search" title="Clear" onclick={() => search = ''}><X size={14} /></button>
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
              onDelete={(item) => void deleteNote(item)}
              onDeleteAttachment={(item, attachment) => void deleteAttachment(item, attachment)}
              onTag={changeTag}
              onTaskToggle={toggleTask}
            />
          {/each}
        </div>
        {#if pagination.currentPage < pagination.totalPages}
          <button class="load-more" disabled={loading} onclick={() => void loadNotes(pagination.currentPage + 1, true)}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        {/if}
      {:else}
        <div class="empty-state">
          <div class="empty-glyph"><Plus size={22} /></div>
          <h2>{search ? 'No matching notes' : 'Your next note starts here'}</h2>
        </div>
      {/if}
    </div>
  </main>
</div>

<BackupDialog
  open={backupOpen}
  onClose={() => backupOpen = false}
  onComplete={backupImported}
  onError={(message) => showToast(message, 'error')}
/>

<PasskeyDialog
  open={passkeysOpen}
  onClose={() => passkeysOpen = false}
  onError={(message) => showToast(message, 'error')}
/>

{#if toast}
  <div class:error={toast.type === 'error'} class="toast" role="status">{toast.message}</div>
{/if}
