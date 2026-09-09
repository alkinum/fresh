<script lang="ts">
  import type { Passkey } from '@better-auth/passkey';
  import { Fingerprint, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2, X } from '@lucide/svelte';
  import { authClient } from '$lib/auth-client';
  import { modalFocus } from '$lib/modal-focus';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  let confirmation = $state<ConfirmDialog>();

  let {
    open,
    onClose,
    onError
  }: {
    open: boolean;
    onClose: () => void;
    onError: (message: string) => void;
  } = $props();

  let passkeys = $state<Passkey[]>([]);
  let name = $state('');
  let loading = $state(false);
  let registering = $state(false);
  let deletingId = $state<string | null>(null);
  let supported = $state(true);
  let loadGeneration = 0;
  let openCycleActive = false;

  $effect(() => {
    if (!open) {
      if (openCycleActive) loadGeneration += 1;
      openCycleActive = false;
      name = '';
      loading = false;
      return;
    }
    if (openCycleActive) return;

    openCycleActive = true;
    const generation = ++loadGeneration;
    supported = window.isSecureContext && 'PublicKeyCredential' in window;
    void loadPasskeys(generation);
  });

  function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return fallback;
  }

  function dateLabel(value: Date | string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  async function loadPasskeys(generation = loadGeneration): Promise<void> {
    loading = true;
    try {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) throw result.error;
      if (generation !== loadGeneration || !open) return;
      passkeys = result.data ?? [];
    } catch (error) {
      if (generation === loadGeneration && open) onError(errorMessage(error, 'Could not load passkeys'));
    } finally {
      if (generation === loadGeneration) loading = false;
    }
  }

  async function addPasskey(): Promise<void> {
    if (!supported || registering) return;
    registering = true;
    try {
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || 'Fresh passkey',
        authenticatorAttachment: 'platform'
      });
      if (result.error) throw result.error;
      name = '';
      await loadPasskeys();
    } catch (error) {
      onError(errorMessage(error, 'Could not add passkey'));
    } finally {
      registering = false;
    }
  }

  async function deletePasskey(passkey: Passkey): Promise<void> {
    if (
      !(await confirmation?.ask(
        'Delete this passkey?',
        `“${passkey.name || 'Passkey'}” will no longer sign you in. You can still use GitHub or another registered passkey.`
      ))
    )
      return;
    deletingId = passkey.id;
    try {
      const result = await authClient.passkey.deletePasskey({ id: passkey.id });
      if (result.error) throw result.error;
      passkeys = passkeys.filter((item) => item.id !== passkey.id);
    } catch (error) {
      onError(errorMessage(error, 'Could not delete passkey'));
    } finally {
      deletingId = null;
    }
  }

  function dismiss(): void {
    if (registering || deletingId) return;
    onClose();
  }
</script>

{#if open}
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Close passkeys" onclick={dismiss}></button>
    <div
      use:modalFocus={{ onDismiss: dismiss }}
      class="dialog passkey-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passkey-title"
      aria-busy={loading || registering || deletingId !== null}
    >
      <ConfirmDialog bind:this={confirmation} />
      <header>
        <div class="dialog-title">
          <Fingerprint size={19} />
          <h2 id="passkey-title">Passkeys</h2>
        </div>
        <button class="icon-button" aria-label="Close" title="Close" onclick={dismiss}><X size={18} /></button>
      </header>

      <div class="passkey-intro">
        <span class="passkey-intro-icon" aria-hidden="true"><ShieldCheck size={19} /></span>
        <div>
          <strong>Sign in without a password</strong>
          <p>Passkeys stay protected by your device and work with Face ID, Touch ID, or a security key.</p>
        </div>
      </div>

      <form
        class="passkey-add"
        onsubmit={(event) => {
          event.preventDefault();
          void addPasskey();
        }}
      >
        <label for="passkey-name">Passkey name</label>
        <div>
          <input
            id="passkey-name"
            data-dialog-initial-focus
            bind:value={name}
            maxlength="80"
            placeholder="This device"
            autocomplete="off"
            disabled={!supported || registering}
          />
          <button class="primary-button" type="submit" disabled={!supported || registering}>
            {#if registering}<LoaderCircle class="spin" size={15} />{:else}<Plus size={15} />{/if}
            <span>{registering ? 'Adding...' : 'Add passkey'}</span>
          </button>
        </div>
      </form>

      {#if !supported}
        <p class="passkey-unavailable">Passkeys require a supported browser and a secure connection.</p>
      {:else if loading}
        <div class="passkey-loading" role="status"><LoaderCircle class="spin" size={17} /> Loading passkeys...</div>
      {:else if passkeys.length > 0}
        <ul class="passkey-list" aria-label="Registered passkeys">
          {#each passkeys as passkey (passkey.id)}
            <li class="passkey-row">
              <span class="passkey-row-icon" aria-hidden="true"><KeyRound size={17} /></span>
              <div>
                <strong>{passkey.name || 'Passkey'}</strong>
                <span
                  >{passkey.backedUp ? 'Synced passkey' : 'Device passkey'} - Added {dateLabel(passkey.createdAt)}</span
                >
              </div>
              <button
                class="icon-button danger"
                aria-label={`Delete ${passkey.name || 'passkey'}`}
                title="Delete passkey"
                disabled={deletingId === passkey.id}
                onclick={() => void deletePasskey(passkey)}
              >
                {#if deletingId === passkey.id}<LoaderCircle class="spin" size={15} />{:else}<Trash2 size={15} />{/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="passkey-empty">
          <Fingerprint size={20} />
          <span>No passkeys registered yet</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
