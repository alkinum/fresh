<script lang="ts">
  import { ArchiveRestore, Download, LoaderCircle, Upload, X } from '@lucide/svelte';
  import { decryptBackup, encryptBackup } from '$lib/backup';
  import type { BackupManifest } from '$lib/types';

  let {
    open,
    onClose,
    onComplete,
    onError
  }: {
    open: boolean;
    onClose: () => void;
    onComplete: () => Promise<void> | void;
    onError: (message: string) => void;
  } = $props();

  let tab = $state<'export' | 'import'>('export');
  let password = $state('');
  let confirmation = $state('');
  let backupFile = $state<File | null>(null);
  let importMode = $state<'merge' | 'replace'>('replace');
  let busy = $state(false);
  let progress = $state('');

  function dismiss(): void {
    if (busy) return;
    password = '';
    confirmation = '';
    backupFile = null;
    progress = '';
    onClose();
  }

  async function responseError(response: Response): Promise<string> {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  async function exportBackup(): Promise<void> {
    if (password.length < 8) return onError('Use a password with at least 8 characters');
    if (password !== confirmation) return onError('Passwords do not match');
    busy = true;

    try {
      progress = 'Preparing data';
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error(await responseError(response));
      const manifest = await response.json() as BackupManifest;
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
    if (!backupFile) return onError('Choose a Fresh backup');
    if (!password) return onError('Enter the backup password');
    busy = true;

    try {
      progress = 'Decrypting backup';
      const decrypted = await decryptBackup(backupFile, password);
      progress = 'Restoring notes';
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: importMode, manifest: decrypted.manifest })
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as {
        attachments: Array<{ sourceId: string; id: string; uploadUrl: string }>;
      };

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

      password = '';
      backupFile = null;
      progress = 'Backup restored';
      await onComplete();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Backup import failed');
      progress = '';
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter id="fresh-backup-file-lens" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.08 0.12" numOctaves="1" seed="23" result="lensMap" />
        <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="refracted" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="refracted" />
        </feMerge>
      </filter>
    </defs>
  </svg>
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Close backups" onclick={dismiss}></button>
    <div class="dialog backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <header>
        <div class="dialog-title"><ArchiveRestore size={19} /><h2 id="backup-title">Encrypted backup</h2></div>
        <button class="icon-button" aria-label="Close" title="Close" onclick={dismiss}><X size={18} /></button>
      </header>

      <div class="segmented-control backup-tabs" aria-label="Backup action">
        <button class:active={tab === 'export'} onclick={() => { tab = 'export'; progress = ''; }}><Download size={15} /> Export</button>
        <button class:active={tab === 'import'} onclick={() => { tab = 'import'; progress = ''; }}><Upload size={15} /> Import</button>
      </div>

      {#if tab === 'export'}
        <form class="dialog-form" onsubmit={(event) => { event.preventDefault(); void exportBackup(); }}>
          <label>
            <span>Password</span>
            <input type="password" bind:value={password} autocomplete="new-password" minlength="8" />
          </label>
          <label>
            <span>Confirm password</span>
            <input type="password" bind:value={confirmation} autocomplete="new-password" minlength="8" />
          </label>
          <button type="submit" class="primary-button wide" disabled={busy}>
            {#if busy}<LoaderCircle class="spin" size={16} />{:else}<Download size={16} />{/if}
            Export backup
          </button>
        </form>
      {:else}
        <form class="dialog-form" onsubmit={(event) => { event.preventDefault(); void importBackup(); }}>
          <label class:selected={Boolean(backupFile)} class="file-picker" for="backup-file-input">
            <input id="backup-file-input" type="file" accept=".freshup,application/x-fresh-backup" onchange={selectBackup} />
            <span class="file-picker-icon" aria-hidden="true"><Upload size={19} /></span>
            <span class="file-picker-copy">
              <strong>{backupFile?.name ?? 'Choose a backup file'}</strong>
              <span>{backupFile ? fileSizeLabel(backupFile.size) : 'Fresh encrypted backup (.freshup)'}</span>
            </span>
            <span class="file-picker-action">{backupFile ? 'Change file' : 'Browse files'}</span>
          </label>
          <label>
            <span>Password</span>
            <input type="password" bind:value={password} autocomplete="current-password" />
          </label>
          <div class="segmented-control import-mode" aria-label="Import mode">
            <button class:active={importMode === 'replace'} onclick={() => importMode = 'replace'}>Replace</button>
            <button class:active={importMode === 'merge'} onclick={() => importMode = 'merge'}>Merge</button>
          </div>
          <button type="submit" class="primary-button wide" disabled={busy || !backupFile}>
            {#if busy}<LoaderCircle class="spin" size={16} />{:else}<Upload size={16} />{/if}
            Import backup
          </button>
        </form>
      {/if}

      {#if progress}<p class="dialog-status">{progress}</p>{/if}
    </div>
  </div>
{/if}
