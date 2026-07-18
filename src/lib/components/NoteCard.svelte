<script lang="ts">
  import { tick } from 'svelte';
  import { Edit3, MoreHorizontal, Star, Trash2 } from '@lucide/svelte';
  import AttachmentGallery from '$lib/components/AttachmentGallery.svelte';
  import type { AttachmentDto, NoteDto } from '$lib/types';

  let {
    note,
    onFavorite,
    onEdit,
    onDelete,
    onDeleteAttachment,
    onTag,
    onTaskToggle
  }: {
    note: NoteDto;
    onFavorite: (note: NoteDto) => void;
    onEdit: (note: NoteDto) => void;
    onDelete: (note: NoteDto) => void;
    onDeleteAttachment: (note: NoteDto, attachment: AttachmentDto) => void;
    onTag: (id: string) => void;
    onTaskToggle: (note: NoteDto, taskIndex: number, checked: boolean) => Promise<void>;
  } = $props();

  let menuOpen = $state(false);
  let taskPending = $state(false);
  let contentElement = $state<HTMLDivElement>();

  function dateLabel(value: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  function setTaskControlsDisabled(disabled: boolean): void {
    contentElement?.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox').forEach((input) => {
      input.disabled = disabled;
    });
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

<article class="note-card" style={`--note-accent: ${note.colorIndicator}`}>
  <header>
    <div class="note-heading">
      <span class="note-accent" aria-hidden="true"></span>
      <div>
        <h2>{note.title}</h2>
        <time datetime={note.updatedAt}>{dateLabel(note.updatedAt)}</time>
      </div>
    </div>
    <div class="note-actions">
      <button
        class:active={note.isFavorite}
        aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        title={note.isFavorite ? 'Remove favorite' : 'Favorite'}
        onclick={() => onFavorite(note)}
      >
        <Star size={16} fill={note.isFavorite ? 'currentColor' : 'none'} />
      </button>
      <div class="menu-wrap">
        <button aria-label="Note actions" title="Actions" onclick={() => menuOpen = !menuOpen}>
          <MoreHorizontal size={17} />
        </button>
        {#if menuOpen}
          <div class="action-menu">
            <button onclick={() => { menuOpen = false; onEdit(note); }}><Edit3 size={15} /> Edit</button>
            <button class="danger" onclick={() => { menuOpen = false; onDelete(note); }}><Trash2 size={15} /> Delete</button>
          </div>
        {/if}
      </div>
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

  <AttachmentGallery
    attachments={note.attachments}
    onDelete={(attachment) => onDeleteAttachment(note, attachment)}
  />

  {#if note.tags.length > 0}
    <footer class="note-tags">
      {#each note.tags as tag (tag.id)}
        <button style={`--tag-color: ${tag.color}`} onclick={() => onTag(tag.id)}>#{tag.name}</button>
      {/each}
    </footer>
  {/if}
</article>
