<script lang="ts">
  import { ArchiveRestore, Download, LoaderCircle, Upload, X } from '@lucide/svelte';
  import { decryptBackup, encryptBackup } from '$lib/backup';
  import { modalFocus } from '$lib/modal-focus';
  import type { BackupManifest } from '$lib/types';

  let {
    open,
    hasUnsavedChanges = false,
    onClose,
    onComplete,
    onError
  }: {
    open: boolean;
    hasUnsavedChanges?: boolean;
    onClose: () => void;
    onComplete: () => Promise<void> | void;
    onError: (message: string) => void;
  } = $props();

  let tab = $state<'export' | 'import'>('export');
  let password = $state('');
  let confirmation = $state('');
  let backupFile = $state<File | null>(null);
  let importMode = $state<'merge' | 'replace'>('merge');
  let replaceConfirmed = $state(false);
  let busy = $state(false);
  let progress = $state('');
  let pendingFinalizeUrl = $state<string | null>(null);

  function dismiss(): void {
    if (busy) return;
    password = '';
    confirmation = '';
    backupFile = null;
    importMode = 'merge';
    replaceConfirmed = false;
    progress = '';
    onClose();
  }

  async function responseError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  async function exportBackup(): Promise<void> {
    if (busy) return;
    if (password.length < 8) return onError('Use a password with at least 8 characters');
    if (password !== confirmation) return onError('Passwords do not match');
    busy = true;

    try {
      progress = 'Preparing data';
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error(await responseError(response));
      const manifest = (await response.json()) as BackupManifest;
      let completed = 0;
      const blob = await encryptBackup(manifest, password, async (attachment) => {
        progress = `Downloading attachments ${completed + 1}/${manifest.attachments.length}`;
        const fileResponse = await fetch(attachment.url);
        if (!fileResponse.ok) throw new Error(`Could not export ${attachment.fileName}`);
        const data = new Uint8Array(await fileResponse.arrayBuffer());
        completed += 1;
        return data;
      });

      progress = 'Encrypting backup';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fresh-${new Date().toISOString().slice(0, 10)}.freshup`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      password = '';
      confirmation = '';
      progress = 'Backup exported';
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Backup export failed');
      progress = '';
    } finally {
      busy = false;
    }
  }

  function selectBackup(event: Event): void {
    backupFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
  }

  function fileSizeLabel(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function importBackup(): Promise<void> {
    if (busy) return;
    if (hasUnsavedChanges) return onError('Save your draft before restoring a backup.');
    busy = true;
    let preparedImport: { finalizeUrl: string } | null = null;

    try {
      if (pendingFinalizeUrl) {
        progress = 'Confirming previous restore';
        const retry = await fetch(pendingFinalizeUrl, { method: 'POST' });
        if (!retry.ok) {
          if (retry.status < 500) pendingFinalizeUrl = null;
          throw new Error(await responseError(retry));
        }
        pendingFinalizeUrl = null;
        progress = 'Backup restored';
        await onComplete();
        return;
      }

      if (!backupFile) throw new Error('Choose a Fresh backup');
      if (!password) throw new Error('Enter the backup password');
      if (importMode === 'replace' && !replaceConfirmed)
        throw new Error('Confirm that this restore will replace your current notebook.');
      progress = 'Decrypting backup';
      const decrypted = await decryptBackup(backupFile, password);
      progress = 'Restoring notes';
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: importMode, manifest: decrypted.manifest })
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as {
        importId: string;
        attachments: Array<{ sourceId: string; id: string; uploadUrl: string }>;
        finalizeUrl: string;
      };
      preparedImport = result;

      for (let index = 0; index < result.attachments.length; index += 1) {
        const attachment = result.attachments[index];
        const bytes = decrypted.attachmentFiles.get(attachment.sourceId);
        if (!bytes) throw new Error('Backup attachment is missing');
        progress = `Restoring attachments ${index + 1}/${result.attachments.length}`;
        const body = new Uint8Array(bytes.byteLength);
        body.set(bytes);
        const upload = await fetch(attachment.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream', 'x-file-size': String(body.byteLength) },
          body: new Blob([body.buffer])
        });
        if (!upload.ok) throw new Error(await responseError(upload));
      }

      progress = 'Finalizing restore';
      pendingFinalizeUrl = result.finalizeUrl;
      const finalize = await fetch(result.finalizeUrl, { method: 'POST' });
      if (!finalize.ok) {
        if (finalize.status < 500) pendingFinalizeUrl = null;
        throw new Error(await responseError(finalize));
      }
      pendingFinalizeUrl = null;

      password = '';
      backupFile = null;
      progress = 'Backup restored';
      await onComplete();
    } catch (error) {
      if (preparedImport && !pendingFinalizeUrl) {
        await fetch(preparedImport.finalizeUrl, { method: 'DELETE' }).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : 'Backup import failed';
      onError(pendingFinalizeUrl ? `${message}. Use Import backup again to confirm the existing restore.` : message);
      progress = '';
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter
        id="fresh-backup-file-lens"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        color-interpolation-filters="sRGB"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.08 0.12" numOctaves="1" seed="23" result="lensMap" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="lensMap"
          scale="1.8"
          xChannelSelector="R"
          yChannelSelector="G"
          result="refracted"
        />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="refracted" />
        </feMerge>
      </filter>
    </defs>
  </svg>
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Close backups" onclick={dismiss}></button>
    <div
      use:modalFocus={{ onDismiss: dismiss }}
      class="dialog backup-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <header>
        <div class="dialog-title">
          <ArchiveRestore size={19} />
          <h2 id="backup-title">Encrypted backup</h2>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" onclick={dismiss}><X size={18} /></button>
      </header>

      <div class="segmented-control backup-tabs" aria-label="Backup action">
        <button
          type="button"
          class:active={tab === 'export'}
          aria-pressed={tab === 'export'}
          disabled={busy}
          onclick={() => {
            tab = 'export';
            progress = '';
          }}><Download size={15} aria-hidden="true" /> Export</button
        >
        <button
          type="button"
          class:active={tab === 'import'}
          aria-pressed={tab === 'import'}
          disabled={busy}
          onclick={() => {
            tab = 'import';
            progress = '';
          }}><Upload size={15} aria-hidden="true" /> Import</button
        >
      </div>

      {#if tab === 'export'}
        <form
          class="dialog-form"
          onsubmit={(event) => {
            event.preventDefault();
            void exportBackup();
          }}
        >
          <p class="dialog-help">
            Save your notes, boards, and files in one encrypted backup. Keep the password somewhere safe; it cannot be
            recovered.
          </p>
          <label>
            <span>Password</span>
            <input
              data-dialog-initial-focus
              type="password"
              bind:value={password}
              autocomplete="new-password"
              minlength="8"
              required
              disabled={busy}
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              bind:value={confirmation}
              autocomplete="new-password"
              minlength="8"
              required
              disabled={busy}
            />
          </label>
          <button type="submit" class="primary-button wide" disabled={busy}>
            {#if busy}<LoaderCircle class="spin" size={16} aria-hidden="true" />{:else}<Download
                size={16}
                aria-hidden="true"
              />{/if}
            Export backup
          </button>
        </form>
      {:else}
        <form
          class="dialog-form"
          onsubmit={(event) => {
            event.preventDefault();
            void importBackup();
          }}
        >
          {#if hasUnsavedChanges}
            <p class="dialog-help" role="status">
              Save your draft before restoring a backup so your latest edits stay safe.
            </p>
          {/if}
          <label class:selected={Boolean(backupFile)} class="file-picker" for="backup-file-input">
            <input
              id="backup-file-input"
              type="file"
              accept=".freshup,application/x-fresh-backup"
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onchange={selectBackup}
            />
            <span class="file-picker-icon" aria-hidden="true"><Upload size={19} /></span>
            <span class="file-picker-copy">
              <strong>{backupFile?.name ?? 'Choose a backup file'}</strong>
              <span>{backupFile ? fileSizeLabel(backupFile.size) : 'Fresh encrypted backup (.freshup)'}</span>
            </span>
            <span class="file-picker-action">{backupFile ? 'Change file' : 'Browse files'}</span>
          </label>
          <label>
            <span>Password</span>
            <input
              data-dialog-initial-focus
              type="password"
              bind:value={password}
              autocomplete="current-password"
              disabled={busy || Boolean(pendingFinalizeUrl)}
            />
          </label>
          <div class="segmented-control import-mode" aria-label="Import mode">
            <button
              type="button"
              class:active={importMode === 'merge'}
              aria-pressed={importMode === 'merge'}
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onclick={() => {
                importMode = 'merge';
                replaceConfirmed = false;
              }}>Merge</button
            >
            <button
              type="button"
              class:active={importMode === 'replace'}
              aria-pressed={importMode === 'replace'}
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onclick={() => (importMode = 'replace')}>Replace</button
            >
          </div>
          {#if importMode === 'replace'}
            <label class="restore-warning">
              <input type="checkbox" bind:checked={replaceConfirmed} disabled={busy || Boolean(pendingFinalizeUrl)} />
              <span>Replace all my current notes, boards, and files with this backup. This cannot be undone.</span>
            </label>
          {:else}
            <p class="dialog-help">
              Add the backup to your notebook. Your existing notes, boards, and files stay in place.
            </p>
          {/if}
          <button
            type="submit"
            class="primary-button wide"
            disabled={busy ||
              hasUnsavedChanges ||
              (!backupFile && !pendingFinalizeUrl) ||
              (!pendingFinalizeUrl && importMode === 'replace' && !replaceConfirmed)}
          >
            {#if busy}<LoaderCircle class="spin" size={16} aria-hidden="true" />{:else}<Upload
                size={16}
                aria-hidden="true"
              />{/if}
            {pendingFinalizeUrl ? 'Retry restore' : 'Import backup'}
          </button>
        </form>
      {/if}

      <p class="sr-only" role="status">{progress}</p>
      {#if progress}<p class="dialog-status" aria-hidden="true">{progress}</p>{/if}
    </div>
  </div>
{/if}
