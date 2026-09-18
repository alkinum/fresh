<script lang="ts">
  import { useI18n } from '$lib/i18n.svelte';
  const i18n = useI18n();
  const t = i18n.t;

  import { Settings2, Copy as CopyIcon, FileText, LayoutDashboard, Plus, Star, Tags, X } from '@lucide/svelte';
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
    onSettings,
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
    onSettings: () => void;
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
  <button class="sidebar-scrim" aria-label={t('Close navigation')} onclick={onClose}></button>
{/if}

<aside
  use:modalFocus={{ active: open, onDismiss: onClose, initialFocus: '.brand-row .mobile-only' }}
  class:open
  class="sidebar"
  aria-label={t('Notebook navigation')}
>
  <div class="brand-row">
    <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
    <strong>Fresh</strong>
    <button class="icon-button mobile-only" aria-label={t('Close navigation')} title={t('Close')} onclick={onClose}>
      <X size={18} />
    </button>
  </div>

  <nav class="primary-nav" aria-label={t('Workspace')}>
    <button
      class:active={activeWorkspace === 'notes' && activeView === 'all' && activeTagId === null}
      class:liquid-glass-surface={activeWorkspace === 'notes' && activeView === 'all' && activeTagId === null}
      aria-pressed={activeWorkspace === 'notes' && activeView === 'all' && activeTagId === null}
      onclick={() => {
        onWorkspace('notes');
        onView('all');
        onTag(null);
        onClose();
      }}
    >
      <FileText size={16} />
      <span>{t('All notes')}</span>
    </button>
    <button
      class:active={activeWorkspace === 'notes' && activeView === 'favorites'}
      class:liquid-glass-surface={activeWorkspace === 'notes' && activeView === 'favorites'}
      aria-pressed={activeWorkspace === 'notes' && activeView === 'favorites'}
      onclick={() => {
        onWorkspace('notes');
        onView('favorites');
        onClose();
      }}
    >
      <Star size={16} />
      <span>{t('Favorites')}</span>
    </button>
    <button
      class:active={activeWorkspace === 'kanban'}
      class:liquid-glass-surface={activeWorkspace === 'kanban'}
      aria-pressed={activeWorkspace === 'kanban'}
      onclick={() => {
        onWorkspace('kanban');
        onClose();
      }}
    >
      <LayoutDashboard size={16} />
      <span>{t('Kanban')}</span>
    </button>
  </nav>

  <div class="sidebar-section">
    {#if activeWorkspace === 'notes'}
      <div class="section-label"><span>{t('Tags')}</span><span>{tags.length}</span></div>
      <div class="tag-nav">
        {#each tags as tag (tag.id)}
          <button
            class:active={activeTagId === tag.id}
            class:liquid-glass-surface={activeTagId === tag.id}
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
          <div class="empty-tags">{t('Add #tags to a note to organize your thoughts here.')}</div>
        {/each}
      </div>
    {:else}
      <div class="section-label sidebar-board-label">
        <span>{t('Boards')}</span>
        <button aria-label={t('Create board')} title={t('Create board')} onclick={onCreateBoard}
          ><Plus size={14} /></button
        >
      </div>
      <div class="board-nav">
        {#each boards as board (board.id)}
          <button
            class:active={activeBoardId === board.id}
            class:liquid-glass-surface={activeBoardId === board.id}
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
          <div class="empty-tags">{t('No boards yet')}</div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="sidebar-footer">
    <button
      class="user-row liquid-glass-surface"
      aria-label={t('Account settings')}
      title={t('Account settings')}
      aria-haspopup="dialog"
      onclick={onSettings}
    >
      {#if user.image}
        <img src={user.image} alt="" />
      {:else}
        <span class="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
      {/if}
      <span class="user-copy">
        <strong>{user.name}</strong>
        <span>{user.email}</span>
      </span>
      <Settings2 size={16} aria-hidden="true" />
    </button>
  </div>
</aside>

{#if navigationMenu}
  <ContextMenu
    id={`sidebar-${navigationMenu.kind}-menu-${navigationMenu.item.id}`}
    label={t('Actions for {name}', {
      name: navigationMenu.kind === 'tag' ? `#${navigationMenu.item.name}` : navigationMenu.item.name,
    })}
    placement={navigationMenu.placement}
    returnFocus={navigationMenu.returnFocus}
    onClose={() => (navigationMenu = null)}
  >
    {#if navigationMenu.kind === 'tag'}
      <button role="menuitem" tabindex="-1" onclick={showNavigationItem}>
        <Tags size={15} aria-hidden="true" />
        <span>{t('Show notes')}</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={copyNavigationItem}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>{t('Copy tag')}</span>
      </button>
    {:else}
      <button role="menuitem" tabindex="-1" onclick={showNavigationItem}>
        <LayoutDashboard size={15} aria-hidden="true" />
        <span>{t('Open board')}</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={copyNavigationItem}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>{t('Copy board name')}</span>
      </button>
    {/if}
  </ContextMenu>
{/if}
