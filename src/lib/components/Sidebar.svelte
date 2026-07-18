<script lang="ts">
  import {
    ArchiveRestore,
    FileText,
    LogOut,
    Star,
    X
  } from '@lucide/svelte';
  import type { TagDto } from '$lib/types';

  interface UserInfo {
    name: string;
    email: string;
    image?: string | null;
  }

  let {
    user,
    tags,
    activeView,
    activeTagId,
    open = false,
    onView,
    onTag,
    onBackup,
    onLogout,
    onClose
  }: {
    user: UserInfo;
    tags: TagDto[];
    activeView: 'all' | 'favorites';
    activeTagId: string | null;
    open?: boolean;
    onView: (view: 'all' | 'favorites') => void;
    onTag: (id: string | null) => void;
    onBackup: () => void;
    onLogout: () => void;
    onClose: () => void;
  } = $props();
</script>

{#if open}
  <button class="sidebar-scrim" aria-label="Close navigation" onclick={onClose}></button>
{/if}

<aside class:open class="sidebar" aria-label="Notebook navigation">
  <div class="brand-row">
    <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
    <strong>Fresh</strong>
    <button class="icon-button mobile-only" aria-label="Close navigation" title="Close" onclick={onClose}>
      <X size={18} />
    </button>
  </div>

  <nav class="primary-nav" aria-label="Notes">
    <button
      class:active={activeView === 'all' && activeTagId === null}
      onclick={() => { onView('all'); onTag(null); onClose(); }}
    >
      <FileText size={17} />
      <span>All notes</span>
    </button>
    <button
      class:active={activeView === 'favorites'}
      onclick={() => { onView('favorites'); onClose(); }}
    >
      <Star size={17} />
      <span>Favorites</span>
    </button>
  </nav>

  <div class="sidebar-section">
    <div class="section-label"><span>Tags</span><span>{tags.length}</span></div>
    <div class="tag-nav">
      {#each tags as tag (tag.id)}
        <button
          class:active={activeTagId === tag.id}
          onclick={() => { onView('all'); onTag(activeTagId === tag.id ? null : tag.id); onClose(); }}
        >
          <span class="tag-dot" style={`--tag-color: ${tag.color}`}></span>
          <span class="tag-name">{tag.name}</span>
          <span class="tag-count">{tag.count}</span>
        </button>
      {:else}
        <div class="empty-tags">No tags yet</div>
      {/each}
    </div>
  </div>

  <div class="sidebar-footer">
    <div class="user-row">
      {#if user.image}
        <img src={user.image} alt="" />
      {:else}
        <div class="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
      {/if}
      <div class="user-copy">
        <strong>{user.name}</strong>
        <span>{user.email}</span>
      </div>
      <button class="icon-button" aria-label="Backups" title="Backups" onclick={onBackup}>
        <ArchiveRestore size={17} />
      </button>
      <button class="icon-button" aria-label="Sign out" title="Sign out" onclick={onLogout}>
        <LogOut size={17} />
      </button>
    </div>
  </div>
</aside>
