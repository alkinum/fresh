<script lang="ts">
  import {
    Download,
    ExternalLink,
    File,
    FileArchive,
    FileAudio,
    FileText,
    FileVideo,
    MoreHorizontal,
    Trash2,
  } from '@lucide/svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import {
    contextMenuAtElement,
    contextMenuAtPointer,
    contextMenuReturnFocus,
    type ContextMenuInitialFocus,
    type ContextMenuPlacement,
  } from '$lib/context-menu';
  import type { AttachmentDto } from '$lib/types';

  interface AttachmentMenuState {
    attachment: AttachmentDto;
    placement: ContextMenuPlacement;
    returnFocus: HTMLElement;
    initialFocus: ContextMenuInitialFocus;
  }

  let {
    attachments,
    onDelete,
  }: {
    attachments: AttachmentDto[];
    onDelete: (attachment: AttachmentDto) => void;
  } = $props();

  let menu = $state<AttachmentMenuState | null>(null);
  let openPdfIds = $state<string[]>([]);

  function sizeLabel(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(1)} MiB`;
  }

  function showAttachmentMenu(
    attachment: AttachmentDto,
    placement: ContextMenuPlacement,
    returnFocus: HTMLElement,
    initialFocus: ContextMenuInitialFocus = 'first',
  ): void {
    menu = { attachment, placement, returnFocus, initialFocus };
  }

  function toggleAttachmentMenu(event: MouseEvent, attachment: AttachmentDto): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    if (menu?.attachment.id === attachment.id) {
      menu = null;
      return;
    }
    showAttachmentMenu(attachment, contextMenuAtElement(button), button);
  }

  function openAttachmentMenuFromKeyboard(event: KeyboardEvent, attachment: AttachmentDto): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    showAttachmentMenu(attachment, contextMenuAtElement(button), button, event.key === 'ArrowUp' ? 'last' : 'first');
  }

  function openAttachmentContextMenu(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const surface = target.closest<HTMLElement>('[data-attachment-id]');
    if (!surface) return;

    event.stopPropagation();
    const selection = window.getSelection()?.toString();
    const keepsNativeMenu = target.closest('a, audio, video, iframe, input, textarea, select');
    if (selection || keepsNativeMenu) return;

    const attachment = attachments.find((item) => item.id === surface.dataset.attachmentId);
    if (!attachment) return;
    event.preventDefault();
    const menuButton = surface.querySelector<HTMLElement>('.attachment-menu-trigger') ?? surface;
    showAttachmentMenu(attachment, contextMenuAtPointer(event, surface), contextMenuReturnFocus(menuButton));
  }

  function deleteAttachment(attachment: AttachmentDto): void {
    menu = null;
    onDelete(attachment);
  }

  function deleteMenuAttachment(): void {
    if (!menu) return;
    deleteAttachment(menu.attachment);
  }

  function togglePdf(event: Event, id: string): void {
    const details = event.currentTarget;
    if (!(details instanceof HTMLDetailsElement)) return;
    if (details.open && !openPdfIds.includes(id)) openPdfIds = [...openPdfIds, id];
    else if (!details.open) openPdfIds = openPdfIds.filter((item) => item !== id);
  }
</script>

{#if attachments.length > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="attachment-gallery" oncontextmenu={openAttachmentContextMenu}>
    {#each attachments as attachment (attachment.id)}
      {#if attachment.kind === 'image'}
        <figure class="image-attachment" data-attachment-id={attachment.id}>
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
            <img src={attachment.url} alt={attachment.fileName} loading="lazy" />
          </a>
          <figcaption>
            <span title={attachment.fileName}>{attachment.fileName}</span>
            <button
              class="attachment-menu-trigger"
              aria-label={`Actions for ${attachment.fileName}`}
              aria-haspopup="menu"
              aria-expanded={menu?.attachment.id === attachment.id}
              aria-controls={menu?.attachment.id === attachment.id ? `attachment-menu-${attachment.id}` : undefined}
              title="Attachment actions"
              onclick={(event) => toggleAttachmentMenu(event, attachment)}
              onkeydown={(event) => openAttachmentMenuFromKeyboard(event, attachment)}
              ><MoreHorizontal size={16} /></button
            >
          </figcaption>
        </figure>
      {:else if attachment.kind === 'audio'}
        <div class="media-attachment" data-attachment-id={attachment.id}>
          <div class="attachment-label"><FileAudio size={16} /><span>{attachment.fileName}</span></div>
          <audio src={attachment.url} controls preload="metadata"></audio>
          <button
            class="attachment-menu-trigger"
            aria-label={`Actions for ${attachment.fileName}`}
            aria-haspopup="menu"
            aria-expanded={menu?.attachment.id === attachment.id}
            aria-controls={menu?.attachment.id === attachment.id ? `attachment-menu-${attachment.id}` : undefined}
            title="Attachment actions"
            onclick={(event) => toggleAttachmentMenu(event, attachment)}
            onkeydown={(event) => openAttachmentMenuFromKeyboard(event, attachment)}
            ><MoreHorizontal size={16} /></button
          >
        </div>
      {:else if attachment.kind === 'video'}
        <div class="video-attachment" data-attachment-id={attachment.id}>
          <!-- User-uploaded media does not include a separate captions track. -->
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={attachment.url} controls preload="metadata"></video>
          <div class="attachment-row">
            <FileVideo size={16} />
            <span>{attachment.fileName}</span>
            <button
              class="attachment-menu-trigger"
              aria-label={`Actions for ${attachment.fileName}`}
              aria-haspopup="menu"
              aria-expanded={menu?.attachment.id === attachment.id}
              aria-controls={menu?.attachment.id === attachment.id ? `attachment-menu-${attachment.id}` : undefined}
              title="Attachment actions"
              onclick={(event) => toggleAttachmentMenu(event, attachment)}
              onkeydown={(event) => openAttachmentMenuFromKeyboard(event, attachment)}
              ><MoreHorizontal size={16} /></button
            >
          </div>
        </div>
      {:else if attachment.kind === 'pdf'}
        <details class="pdf-attachment" data-attachment-id={attachment.id} ontoggle={(event) => togglePdf(event, attachment.id)}>
          <summary>
            <FileText size={16} />
            <span>{attachment.fileName}</span>
            <span class="file-size">{sizeLabel(attachment.size)}</span>
          </summary>
          <button
            class="attachment-menu-trigger pdf-menu-trigger"
            aria-label={`Actions for ${attachment.fileName}`}
            aria-haspopup="menu"
            aria-expanded={menu?.attachment.id === attachment.id}
            aria-controls={menu?.attachment.id === attachment.id ? `attachment-menu-${attachment.id}` : undefined}
            title="Attachment actions"
            onclick={(event) => toggleAttachmentMenu(event, attachment)}
            onkeydown={(event) => openAttachmentMenuFromKeyboard(event, attachment)}
            ><MoreHorizontal size={16} /></button
          >
          {#if openPdfIds.includes(attachment.id)}
            <iframe
              src={attachment.url}
              title={attachment.fileName}
              sandbox=""
              loading="lazy"
              referrerpolicy="no-referrer"
            ></iframe>
          {/if}
          <div class="attachment-actions">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={attachment.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open</a>
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={attachment.downloadUrl} download={attachment.fileName}><Download size={14} /> Download</a>
            <button onclick={() => onDelete(attachment)}><Trash2 size={14} /> Delete</button>
          </div>
        </details>
      {:else}
        <div class="file-attachment" data-attachment-id={attachment.id}>
          {#if attachment.kind === 'archive'}
            <FileArchive size={18} />
          {:else if attachment.kind === 'text' || attachment.kind === 'document'}
            <FileText size={18} />
          {:else}
            <File size={18} />
          {/if}
          <div>
            <strong title={attachment.fileName}>{attachment.fileName}</strong>
            <span>{sizeLabel(attachment.size)}</span>
          </div>
          <button
            class="attachment-menu-trigger"
            aria-label={`Actions for ${attachment.fileName}`}
            aria-haspopup="menu"
            aria-expanded={menu?.attachment.id === attachment.id}
            aria-controls={menu?.attachment.id === attachment.id ? `attachment-menu-${attachment.id}` : undefined}
            title="Attachment actions"
            onclick={(event) => toggleAttachmentMenu(event, attachment)}
            onkeydown={(event) => openAttachmentMenuFromKeyboard(event, attachment)}
            ><MoreHorizontal size={16} /></button
          >
        </div>
      {/if}
    {/each}
  </div>
{/if}

{#if menu}
  <ContextMenu
    id={`attachment-menu-${menu.attachment.id}`}
    label={`Actions for ${menu.attachment.fileName}`}
    placement={menu.placement}
    returnFocus={menu.returnFocus}
    initialFocus={menu.initialFocus}
    onClose={() => (menu = null)}
  >
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      role="menuitem"
      tabindex="-1"
      href={menu.attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => (menu = null)}
    >
      <ExternalLink size={15} aria-hidden="true" />
      <span>Open</span>
    </a>
    <a
      role="menuitem"
      tabindex="-1"
      href={menu.attachment.downloadUrl}
      download={menu.attachment.fileName}
      onclick={() => (menu = null)}
    >
      <Download size={15} aria-hidden="true" />
      <span>Download</span>
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
    <div role="separator"></div>
    <button class="danger" role="menuitem" tabindex="-1" onclick={deleteMenuAttachment}>
      <Trash2 size={15} aria-hidden="true" />
      <span>Delete</span>
    </button>
  </ContextMenu>
{/if}
