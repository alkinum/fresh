<script lang="ts">
  import { useI18n } from '$lib/i18n.svelte';
  const i18n = useI18n();
  const t = i18n.t;

  import { ArchiveRestore, Download, LoaderCircle, Upload, X } from '@lucide/svelte';
  import { decryptBackup, encryptBackup } from '$lib/backup';
  import { modalFocus } from '$lib/modal-focus';
  import type { BackupManifest } from '$lib/types';

  let {
    open,
    embedded = false,
    onBusyChange,
    hasUnsavedChanges = false,
    onClose,
    onComplete,
    onError,
  }: {
    open: boolean;
    embedded?: boolean;
    onBusyChange?: (busy: boolean) => void;
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
  $effect(() => {
    onBusyChange?.(busy);
  });

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
    return body?.error ?? t('Request failed ({status})', { status: response.status });
  }

  async function exportBackup(): Promise<void> {
    if (busy) return;
    if (password.length < 8) return onError(t('Use a password with at least 8 characters'));
    if (password !== confirmation) return onError(t('Passwords do not match'));
    busy = true;

    try {
      progress = t('Preparing data');
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error(await responseError(response));
      const manifest = (await response.json()) as BackupManifest;
      let completed = 0;
      const blob = await encryptBackup(manifest, password, async (attachment) => {
        progress = t('Downloading attachments {current}/{total}', {
          current: completed + 1,
          total: manifest.attachments.length,
        });
        const fileResponse = await fetch(attachment.url);
        if (!fileResponse.ok) throw new Error(t('Could not export {name}', { name: attachment.fileName }));
        const data = new Uint8Array(await fileResponse.arrayBuffer());
        completed += 1;
        return data;
      });

      progress = t('Encrypting backup');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fresh-${new Date().toISOString().slice(0, 10)}.freshup`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      password = '';
      confirmation = '';
      progress = t('Backup exported');
    } catch (error) {
      onError(error instanceof Error ? error.message : t('Backup export failed'));
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
    if (hasUnsavedChanges) return onError(t('Save your draft before restoring a backup.'));
    busy = true;
    let preparedImport: { finalizeUrl: string } | null = null;

    try {
      if (pendingFinalizeUrl) {
        progress = t('Confirming previous restore');
        const retry = await fetch(pendingFinalizeUrl, { method: 'POST' });
        if (!retry.ok) {
          if (retry.status < 500) pendingFinalizeUrl = null;
          throw new Error(await responseError(retry));
        }
        pendingFinalizeUrl = null;
        progress = t('Backup restored');
        await onComplete();
        return;
      }

      if (!backupFile) throw new Error(t('Choose a Fresh backup'));
      if (!password) throw new Error(t('Enter the backup password'));
      if (importMode === 'replace' && !replaceConfirmed)
        throw new Error(t('Confirm that this restore will replace your current notebook.'));
      progress = t('Decrypting backup');
      const decrypted = await decryptBackup(backupFile, password);
      progress = t('Restoring notes');
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: importMode, manifest: decrypted.manifest }),
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
        if (!bytes) throw new Error(t('Backup attachment is missing'));
        progress = t('Restoring attachments {current}/{total}', {
          current: index + 1,
          total: result.attachments.length,
        });
        const body = new Uint8Array(bytes.byteLength);
        body.set(bytes);
        const upload = await fetch(attachment.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream', 'x-file-size': String(body.byteLength) },
          body: new Blob([body.buffer]),
        });
        if (!upload.ok) throw new Error(await responseError(upload));
      }

      progress = t('Finalizing restore');
      pendingFinalizeUrl = result.finalizeUrl;
      const finalize = await fetch(result.finalizeUrl, { method: 'POST' });
      if (!finalize.ok) {
        if (finalize.status < 500) pendingFinalizeUrl = null;
        throw new Error(await responseError(finalize));
      }
      pendingFinalizeUrl = null;

      password = '';
      backupFile = null;
      progress = t('Backup restored');
      await onComplete();
    } catch (error) {
      if (preparedImport && !pendingFinalizeUrl) {
        await fetch(preparedImport.finalizeUrl, { method: 'DELETE' }).catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : t('Backup import failed');
      onError(
        pendingFinalizeUrl
          ? t('{message}. Use Import backup again to confirm the existing restore.', { message: t(message) })
          : message,
      );
      progress = '';
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class={embedded ? 'settings-embedded' : 'dialog-layer'} role="presentation">
    {#if !embedded}<button class="dialog-scrim" aria-label={t('Close backups')} onclick={dismiss}></button>{/if}
    <div
      use:modalFocus={{ active: !embedded, onDismiss: dismiss }}
      class="dialog backup-dialog"
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <header>
        <div class="dialog-title">
          <ArchiveRestore size={19} />
          <h2 id="backup-title">{t('Encrypted backup')}</h2>
        </div>
        {#if !embedded}<button class="icon-button" aria-label={t('Close')} title={t('Close')} onclick={dismiss}
            ><X size={18} /></button
          >{/if}
      </header>

      <div class="segmented-control backup-tabs" aria-label={t('Backup action')}>
        <button
          type="button"
          class:active={tab === 'export'}
          class:liquid-glass-surface={tab === 'export'}
          aria-pressed={tab === 'export'}
          disabled={busy}
          onclick={() => {
            tab = 'export';
            progress = '';
          }}><Download size={15} aria-hidden="true" /> {t('Export')}</button
        >
        <button
          type="button"
          class:active={tab === 'import'}
          class:liquid-glass-surface={tab === 'import'}
          aria-pressed={tab === 'import'}
          disabled={busy}
          onclick={() => {
            tab = 'import';
            progress = '';
          }}><Upload size={15} aria-hidden="true" /> {t('Import')}</button
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
            {t(
              'Save your notes, boards, and files in one encrypted backup. Keep the password somewhere safe; it cannot be recovered.',
            )}
          </p>
          <label>
            <span>{t('Password')}</span>
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
            <span>{t('Confirm password')}</span>
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
            {t('Export backup')}
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
              {t('Save your draft before restoring a backup so your latest edits stay safe.')}
            </p>
          {/if}
          <label class:selected={Boolean(backupFile)} class="file-picker liquid-glass-surface" for="backup-file-input">
            <input
              id="backup-file-input"
              type="file"
              accept=".freshup,application/x-fresh-backup"
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onchange={selectBackup}
            />
            <span class="file-picker-icon" aria-hidden="true"><Upload size={19} /></span>
            <span class="file-picker-copy">
              <strong>{backupFile?.name ?? t('Choose a backup file')}</strong>
              <span>{backupFile ? fileSizeLabel(backupFile.size) : t('Fresh encrypted backup (.freshup)')}</span>
            </span>
            <span class="file-picker-action">{backupFile ? t('Change file') : t('Browse files')}</span>
          </label>
          <label>
            <span>{t('Password')}</span>
            <input
              data-dialog-initial-focus
              type="password"
              bind:value={password}
              autocomplete="current-password"
              disabled={busy || Boolean(pendingFinalizeUrl)}
            />
          </label>
          <div class="segmented-control import-mode" aria-label={t('Import mode')}>
            <button
              type="button"
              class:active={importMode === 'merge'}
              class:liquid-glass-surface={importMode === 'merge'}
              aria-pressed={importMode === 'merge'}
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onclick={() => {
                importMode = 'merge';
                replaceConfirmed = false;
              }}>{t('Merge')}</button
            >
            <button
              type="button"
              class:active={importMode === 'replace'}
              class:liquid-glass-surface={importMode === 'replace'}
              aria-pressed={importMode === 'replace'}
              disabled={busy || Boolean(pendingFinalizeUrl)}
              onclick={() => (importMode = 'replace')}>{t('Replace')}</button
            >
          </div>
          {#if importMode === 'replace'}
            <label class="restore-warning">
              <input type="checkbox" bind:checked={replaceConfirmed} disabled={busy || Boolean(pendingFinalizeUrl)} />
              <span
                >{t('Replace all my current notes, boards, and files with this backup. This cannot be undone.')}</span
              >
            </label>
          {:else}
            <p class="dialog-help">
              {t('Add the backup to your notebook. Your existing notes, boards, and files stay in place.')}
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
            {pendingFinalizeUrl ? t('Retry restore') : t('Import backup')}
          </button>
        </form>
      {/if}

      <p class="sr-only" role="status">{progress}</p>
      {#if progress}<p class="dialog-status" aria-hidden="true">{progress}</p>{/if}
    </div>
  </div>
{/if}
