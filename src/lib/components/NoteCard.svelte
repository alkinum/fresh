<script lang="ts">
  import { tick } from 'svelte';
  import { Copy as CopyIcon, Edit3, MoreHorizontal, Star, Tags, Trash2 } from '@lucide/svelte';
  import AttachmentGallery from '$lib/components/AttachmentGallery.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import {
    contextMenuAtElement,
    contextMenuAtPointer,
    contextMenuReturnFocus,
    type ContextMenuInitialFocus,
    type ContextMenuPlacement
  } from '$lib/context-menu';
  import type { AttachmentDto, NoteDto, TagDto } from '$lib/types';

  type MenuState =
    | {
        kind: 'note';
        placement: ContextMenuPlacement;
        returnFocus: HTMLElement;
        initialFocus: ContextMenuInitialFocus;
      }
    | {
        kind: 'tag';
        tag: TagDto;
        placement: ContextMenuPlacement;
        returnFocus: HTMLElement;
        initialFocus: ContextMenuInitialFocus;
      };

  let {
    note,
    onFavorite,
    onEdit,
    onCopy,
    onDelete,
    onDeleteAttachment,
    onTag,
    onCopyTag,
    onTaskToggle
  }: {
    note: NoteDto;
    onFavorite: (note: NoteDto) => Promise<void> | void;
    onEdit: (note: NoteDto) => void;
    onCopy: (note: NoteDto) => void;
    onDelete: (note: NoteDto) => void;
    onDeleteAttachment: (note: NoteDto, attachment: AttachmentDto) => void;
    onTag: (id: string) => void;
    onCopyTag: (tag: TagDto) => void;
    onTaskToggle: (note: NoteDto, taskIndex: number, checked: boolean) => Promise<void>;
  } = $props();

  let menu = $state<MenuState | null>(null);
  let taskPending = $state(false);
  let favoritePending = $state(false);
  let contentElement = $state<HTMLDivElement>();

  function dateLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(value)
    );
  }

  async function changeFavorite(): Promise<void> {
    if (favoritePending || taskPending) return;
    favoritePending = true;
    setTaskControlsDisabled(true);
    try {
      await onFavorite(note);
    } finally {
      favoritePending = false;
      await tick();
      setTaskControlsDisabled(false);
    }
  }

  function setTaskControlsDisabled(disabled: boolean): void {
    contentElement?.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox').forEach((input) => {
      input.disabled = disabled;
    });
  }

  function showNoteMenu(
    placement: ContextMenuPlacement,
    returnFocus: HTMLElement,
    initialFocus: ContextMenuInitialFocus = 'first'
  ): void {
    menu = { kind: 'note', placement, returnFocus, initialFocus };
  }

  function toggleNoteMenu(event: MouseEvent): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    if (menu?.kind === 'note') {
      menu = null;
      return;
    }
    showNoteMenu(contextMenuAtElement(button), button);
  }

  function openNoteMenuFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    showNoteMenu(contextMenuAtElement(button), button, event.key === 'ArrowUp' ? 'last' : 'first');
  }

  function openNoteContextMenu(event: MouseEvent): void {
    const article = event.currentTarget;
    const target = event.target;
    if (!(article instanceof HTMLElement) || !(target instanceof Element)) return;

    const selection = window.getSelection()?.toString();
    const keepsNativeMenu = target.closest('a, input, textarea, select, summary, audio, video, iframe');
    if (selection || keepsNativeMenu) return;

    event.preventDefault();
    const menuButton = article.querySelector<HTMLElement>('.note-actions [aria-haspopup="menu"]') ?? article;
    showNoteMenu(contextMenuAtPointer(event, article), contextMenuReturnFocus(menuButton));
  }

  function openTagContextMenu(event: MouseEvent, tag: TagDto): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    menu = {
      kind: 'tag',
      tag,
      placement: contextMenuAtPointer(event, button),
      returnFocus: contextMenuReturnFocus(button),
      initialFocus: 'first'
    };
  }

  function runNoteAction(action: (item: NoteDto) => void): void {
    menu = null;
    action(note);
  }

  function filterMenuTag(): void {
    if (menu?.kind !== 'tag') return;
    const tag = menu.tag;
    menu = null;
    onTag(tag.id);
  }

  function copyMenuTag(): void {
    if (menu?.kind !== 'tag') return;
    const tag = menu.tag;
    menu = null;
    onCopyTag(tag);
  }

  async function changeTask(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('.task-list-item-checkbox') || taskPending) return;

    const taskIndex = Number(input.dataset.taskIndex);
    if (!Number.isInteger(taskIndex) || taskIndex < 0) return;

    const checked = input.checked;
    taskPending = true;
    setTaskControlsDisabled(true);

    try {
      await onTaskToggle(note, taskIndex, checked);
    } catch {
      input.checked = !checked;
    } finally {
      taskPending = false;
      await tick();
      setTaskControlsDisabled(false);
    }
  }
</script>

<article class="note-card" style={`--note-accent: ${note.colorIndicator}`} oncontextmenu={openNoteContextMenu}>
  <header>
    <div class="note-heading">
      <span class="note-accent" aria-hidden="true"></span>
      <div>
        <h2><button class="note-title-button" title="Edit note" onclick={() => onEdit(note)}>{note.title}</button></h2>
        <time datetime={note.updatedAt}>{dateLabel(note.updatedAt)}</time>
      </div>
    </div>
    <div class="note-actions">
      <button
        class:active={note.isFavorite}
        aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={note.isFavorite}
        title={note.isFavorite ? 'Remove favorite' : 'Favorite'}
        disabled={favoritePending || taskPending}
        aria-busy={favoritePending}
        onclick={() => void changeFavorite()}
      >
        <Star size={16} fill={note.isFavorite ? 'currentColor' : 'none'} />
      </button>
      <button
        aria-label="Note actions"
        aria-haspopup="menu"
        aria-expanded={menu?.kind === 'note'}
        aria-controls={menu?.kind === 'note' ? `note-menu-${note.id}` : undefined}
        title="Actions"
        onclick={toggleNoteMenu}
        onkeydown={openNoteMenuFromKeyboard}
      >
        <MoreHorizontal size={17} />
      </button>
    </div>
  </header>

  {#if note.renderedContent.trim()}
    <div
      bind:this={contentElement}
      class="markdown-body note-content"
      class:task-pending={taskPending}
      aria-busy={taskPending}
      onchange={(event) => void changeTask(event)}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html note.renderedContent}
    </div>
  {/if}

  <AttachmentGallery attachments={note.attachments} onDelete={(attachment) => onDeleteAttachment(note, attachment)} />

  {#if note.tags.length > 0}
    <footer class="note-tags">
      {#each note.tags as tag (tag.id)}
        <button
          style={`--tag-color: ${tag.color}`}
          onclick={() => onTag(tag.id)}
          oncontextmenu={(event) => openTagContextMenu(event, tag)}>#{tag.name}</button
        >
      {/each}
    </footer>
  {/if}
</article>

{#if menu}
  <ContextMenu
    id={menu.kind === 'note' ? `note-menu-${note.id}` : `note-tag-menu-${menu.tag.id}`}
    label={menu.kind === 'note' ? `Actions for ${note.title}` : `Actions for #${menu.tag.name}`}
    placement={menu.placement}
    returnFocus={menu.returnFocus}
    initialFocus={menu.initialFocus}
    onClose={() => (menu = null)}
  >
    {#if menu.kind === 'note'}
      <button role="menuitem" tabindex="-1" onclick={() => runNoteAction(onEdit)}>
        <Edit3 size={15} aria-hidden="true" />
        <span>Edit</span>
      </button>
      <button
        role="menuitem"
        tabindex="-1"
        disabled={favoritePending || taskPending}
        onclick={() => {
          menu = null;
          void changeFavorite();
        }}
      >
        <Star size={15} fill={note.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>{note.isFavorite ? 'Remove favorite' : 'Add to favorites'}</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={() => runNoteAction(onCopy)}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>Copy Markdown</span>
      </button>
      <div role="separator"></div>
      <button class="danger" role="menuitem" tabindex="-1" onclick={() => runNoteAction(onDelete)}>
        <Trash2 size={15} aria-hidden="true" />
        <span>Delete</span>
      </button>
    {:else}
      <button role="menuitem" tabindex="-1" onclick={filterMenuTag}>
        <Tags size={15} aria-hidden="true" />
        <span>Show notes</span>
      </button>
      <button role="menuitem" tabindex="-1" onclick={copyMenuTag}>
        <CopyIcon size={15} aria-hidden="true" />
        <span>Copy tag</span>
      </button>
    {/if}
  </ContextMenu>
{/if}
