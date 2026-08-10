<script lang="ts">
  import {
    ArchiveRestore,
    Copy as CopyIcon,
    FileText,
    Fingerprint,
    LayoutDashboard,
    LogOut,
    Plus,
    Star,
    Tags,
    X,
  } from '@lucide/svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import { contextMenuAtPointer, contextMenuReturnFocus, type ContextMenuPlacement } from '$lib/context-menu';
  import { modalFocus } from '$lib/modal-focus';
  import type { KanbanBoardSummaryDto, TagDto } from '$lib/types';

  type NavigationMenuState =
    | {
        kind: 'tag';
        item: TagDto;
        placement: ContextMenuPlacement;
        returnFocus: HTMLElement;
      }
    | {
        kind: 'board';
        item: KanbanBoardSummaryDto;
        placement: ContextMenuPlacement;
        returnFocus: HTMLElement;
      };

  interface UserInfo {
    name: string;
    email: string;
    image?: string | null;
  }

  let {
    user,
    tags,
    boards,
    activeWorkspace,
    activeView,
    activeTagId,
    activeBoardId,
    open = false,
    onView,
    onTag,
    onCopyTag,
    onWorkspace,
    onBoard,
    onCopyBoard,
    onCreateBoard,
    onPasskeys,
    onBackup,
    onLogout,
    onClose,
  }: {
    user: UserInfo;
    tags: TagDto[];
    boards: KanbanBoardSummaryDto[];
    activeWorkspace: 'notes' | 'kanban';
    activeView: 'all' | 'favorites';
    activeTagId: string | null;
    activeBoardId: string | null;
    open?: boolean;
    onView: (view: 'all' | 'favorites') => void;
    onTag: (id: string | null) => void;
    onCopyTag: (tag: TagDto) => void;
    onWorkspace: (workspace: 'notes' | 'kanban') => void;
    onBoard: (id: string) => void;
    onCopyBoard: (board: KanbanBoardSummaryDto) => void;
    onCreateBoard: () => void;
    onPasskeys: () => void;
    onBackup: () => void;
    onLogout: () => void;
    onClose: () => void;
  } = $props();

  let navigationMenu = $state<NavigationMenuState | null>(null);

  function openNavigationContextMenu(
    event: MouseEvent,
    kind: NavigationMenuState['kind'],
    item: TagDto | KanbanBoardSummaryDto,
  ): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    event.preventDefault();
    const common = {
      placement: contextMenuAtPointer(event, button),
      returnFocus: contextMenuReturnFocus(button),
    };
    navigationMenu =
      kind === 'tag'
        ? { kind, item: item as TagDto, ...common }
        : { kind, item: item as KanbanBoardSummaryDto, ...common };
  }

  function showNavigationItem(): void {
    if (!navigationMenu) return;
    const current = navigationMenu;
    navigationMenu = null;
    if (current.kind === 'tag') {
      onWorkspace('notes');
      onView('all');
      onTag(current.item.id);
    } else {
      onWorkspace('kanban');
      onBoard(current.item.id);
    }
    onClose();
  }

  function copyNavigationItem(): void {
    if (!navigationMenu) return;
    const current = navigationMenu;
    navigationMenu = null;
    if (current.kind === 'tag') onCopyTag(current.item);
    else onCopyBoard(current.item);
  }
</script>

{#if open}
  <button class="sidebar-scrim" aria-label="Close navigation" onclick={onClose}></button>
{/if}

<aside
  use:modalFocus={{ active: open, onDismiss: onClose, initialFocus: '.brand-row .mobile-only' }}
  class:open
  class="sidebar"
  aria-label="Notebook navigation"
>
  <div class="brand-row">
    <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
    <strong>Fresh</strong>
    <button class="icon-button mobile-only" aria-label="Close navigation" title="Close" onclick={onClose}>
      <X size={18} />
    </button>
  </div>

  <nav class="primary-nav" aria-label="Workspace">
    <button
      class:active={activeWorkspace === 'notes' && activeView === 'all' && activeTagId === null}
      aria-pressed={activeWorkspace === 'notes' && activeView === 'all' && activeTagId === null}
      onclick={() => {
        onWorkspace('notes');
        onView('all');
        onTag(null);
        onClose();
      }}
    >
      <FileText size={17} />
      <span>All notes</span>
    </button>
    <button
      class:active={activeWorkspace === 'notes' && activeView === 'favorites'}
      aria-pressed={activeWorkspace === 'notes' && activeView === 'favorites'}
      onclick={() => {
        onWorkspace('notes');
        onView('favorites');
        onClose();
      }}
    >
      <Star size={17} />
      <span>Favorites</span>
    </button>
    <button
      class:active={activeWorkspace === 'kanban'}
      aria-pressed={activeWorkspace === 'kanban'}
      onclick={() => {
        onWorkspace('kanban');
        onClose();
      }}
    >
      <LayoutDashboard size={17} />
      <span>Kanban</span>
    </button>
  </nav>

  <div class="sidebar-section">
    {#if activeWorkspace === 'notes'}
      <div class="section-label"><span>Tags</span><span>{tags.length}</span></div>
      <div class="tag-nav">
        {#each tags as tag (tag.id)}
          <button
            class:active={activeTagId === tag.id}
            aria-pressed={activeWorkspace === 'notes' && activeTagId === tag.id}
            onclick={() => {
              onView('all');
              onTag(activeTagId === tag.id ? null : tag.id);
              onClose();
            }}
            oncontextmenu={(event) => openNavigationContextMenu(event, 'tag', tag)}
          >
            <span class="tag-dot" style={`--tag-color: ${tag.color}`}></span>
            <span class="tag-name">{tag.name}</span>
            <span class="tag-count">{tag.count}</span>
          </button>
        {:else}
          <div class="empty-tags">No tags yet</div>
        {/each}
      </div>
    {:else}
      <div class="section-label sidebar-board-label">
        <span>Boards</span>
        <button aria-label="Create board" title="Create board" onclick={onCreateBoard}><Plus size={14} /></button>
      </div>
      <div class="board-nav">
        {#each boards as board (board.id)}
          <button
            class:active={activeBoardId === board.id}
            aria-pressed={activeWorkspace === 'kanban' && activeBoardId === board.id}
            onclick={() => {
              onBoard(board.id);
              onClose();
            }}
            oncontextmenu={(event) => openNavigationContextMenu(event, 'board', board)}
          >
            <span class="board-nav-dot" style={`--board-color: ${board.color}`}></span>
            <span class="tag-name">{board.name}</span>
            <span class="tag-count">{board.cardCount}</span>
          </button>
        {:else}
          <div class="empty-tags">No boards yet</div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="sidebar-footer">
    <div class="sidebar-account-tools">
      <button onclick={onPasskeys}>
        <Fingerprint size={16} />
        <span>Passkeys</span>
      </button>
      <button onclick={onBackup}>
        <ArchiveRestore size={16} />
        <span>Backups</span>
      </button>
    </div>
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
      <button class="icon-button" aria-label="Sign out" title="Sign out" onclick={onLogout}>
        <LogOut size={17} />
      </button>
    </div>
  </div>
</aside>

{#if navigationMenu}
  <ContextMenu
    id={`sidebar-${navigationMenu.kind}-menu-${navigationMenu.item.id}`}
    label={`Actions for ${navigationMenu.kind === 'tag' ? `#${navigationMenu.item.name}` : navigationMenu.item.name}`}
    placement={navigationMenu.placement}
    returnFocus={navigationMenu.returnFocus}
    onClose={() => (navigationMenu = null)}
  >
    {#if navigationMenu.kind === 'tag'}
      <button role="menuitem" tabindex="-1" onclick={showNavigationItem}>
        <Tags size={15} aria-hidden="true" />
        <span>Show notes</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={copyNavigationItem}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>Copy tag</span>
      </button>
    {:else}
      <button role="menuitem" tabindex="-1" onclick={showNavigationItem}>
        <LayoutDashboard size={15} aria-hidden="true" />
        <span>Open board</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={copyNavigationItem}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>Copy board name</span>
      </button>
    {/if}
  </ContextMenu>
{/if}
