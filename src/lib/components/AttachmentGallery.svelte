<script lang="ts">
  import {
    Download,
    ExternalLink,
    File,
    FileArchive,
    FileAudio,
    FileText,
    FileVideo,
    Trash2
  } from '@lucide/svelte';
  import type { AttachmentDto } from '$lib/types';

  let {
    attachments,
    onDelete
  }: {
    attachments: AttachmentDto[];
    onDelete: (attachment: AttachmentDto) => void;
  } = $props();

  function sizeLabel(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(1)} MiB`;
  }
</script>

{#if attachments.length > 0}
  <div class="attachment-gallery">
    {#each attachments as attachment (attachment.id)}
      {#if attachment.kind === 'image'}
        <figure class="image-attachment">
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={attachment.url} target="_blank" rel="noreferrer">
            <img src={attachment.url} alt={attachment.fileName} loading="lazy" />
          </a>
          <figcaption>
            <span title={attachment.fileName}>{attachment.fileName}</span>
            <button aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" onclick={() => onDelete(attachment)}>
              <Trash2 size={14} />
            </button>
          </figcaption>
        </figure>
      {:else if attachment.kind === 'audio'}
        <div class="media-attachment">
          <div class="attachment-label"><FileAudio size={16} /><span>{attachment.fileName}</span></div>
          <audio src={attachment.url} controls preload="metadata"></audio>
          <button aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" onclick={() => onDelete(attachment)}>
            <Trash2 size={14} />
          </button>
        </div>
      {:else if attachment.kind === 'video'}
        <div class="video-attachment">
          <!-- User-uploaded media does not include a separate captions track. -->
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={attachment.url} controls preload="metadata"></video>
          <div class="attachment-row">
            <FileVideo size={16} />
            <span>{attachment.fileName}</span>
            <button aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" onclick={() => onDelete(attachment)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      {:else if attachment.kind === 'pdf'}
        <details class="pdf-attachment">
          <summary>
            <FileText size={16} />
            <span>{attachment.fileName}</span>
            <span class="file-size">{sizeLabel(attachment.size)}</span>
          </summary>
          <iframe src={attachment.url} title={attachment.fileName}></iframe>
          <div class="attachment-actions">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={attachment.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={attachment.url} download={attachment.fileName}><Download size={14} /> Download</a>
            <button onclick={() => onDelete(attachment)}><Trash2 size={14} /> Delete</button>
          </div>
        </details>
      {:else}
        <div class="file-attachment">
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
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={attachment.url} download={attachment.fileName} aria-label={`Download ${attachment.fileName}`} title="Download">
            <Download size={15} />
          </a>
          <button aria-label={`Delete ${attachment.fileName}`} title="Delete attachment" onclick={() => onDelete(attachment)}>
            <Trash2 size={15} />
          </button>
        </div>
      {/if}
    {/each}
  </div>
{/if}
