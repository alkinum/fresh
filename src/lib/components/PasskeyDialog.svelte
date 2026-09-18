<script lang="ts">
  import { useI18n } from '$lib/i18n.svelte';
  const i18n = useI18n();
  const t = i18n.t;

  import type { Passkey } from '@better-auth/passkey';
  import { Fingerprint, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2, X } from '@lucide/svelte';
  import { authClient } from '$lib/auth-client';
  import { modalFocus } from '$lib/modal-focus';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  let confirmation = $state<ConfirmDialog>();

  let {
    open,
    embedded = false,
    onBusyChange,
    onClose,
    onError,
  }: {
    open: boolean;
    embedded?: boolean;
    onBusyChange?: (busy: boolean) => void;
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
    onBusyChange?.(registering || deletingId !== null);
  });

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
    return new Intl.DateTimeFormat(i18n.locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
      if (generation === loadGeneration && open) onError(errorMessage(error, t('Could not load passkeys')));
    } finally {
      if (generation === loadGeneration) loading = false;
    }
  }

  async function addPasskey(): Promise<void> {
    if (!supported || registering) return;
    registering = true;
    try {
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || t('Fresh passkey'),
        authenticatorAttachment: 'platform',
      });
      if (result.error) throw result.error;
      name = '';
      await loadPasskeys();
    } catch (error) {
      onError(errorMessage(error, t('Could not add passkey')));
    } finally {
      registering = false;
    }
  }

  async function deletePasskey(passkey: Passkey): Promise<void> {
    if (
      !(await confirmation?.ask(
        t('Delete this passkey?'),
        t('“{name}” will no longer sign you in. You can still use GitHub or another registered passkey.', {
          name: passkey.name || t('Passkey'),
        }),
      ))
    )
      return;
    deletingId = passkey.id;
    try {
      const result = await authClient.passkey.deletePasskey({ id: passkey.id });
      if (result.error) throw result.error;
      passkeys = passkeys.filter((item) => item.id !== passkey.id);
    } catch (error) {
      onError(errorMessage(error, t('Could not delete passkey')));
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
  <div class={embedded ? 'settings-embedded' : 'dialog-layer'} role="presentation">
    {#if !embedded}<button class="dialog-scrim" aria-label={t('Close passkeys')} onclick={dismiss}></button>{/if}
    <div
      use:modalFocus={{ active: !embedded, onDismiss: dismiss }}
      class="dialog passkey-dialog"
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-labelledby="passkey-title"
      aria-busy={loading || registering || deletingId !== null}
    >
      <ConfirmDialog bind:this={confirmation} />
      <header>
        <div class="dialog-title">
          <Fingerprint size={19} />
          <h2 id="passkey-title">{t('Passkeys')}</h2>
        </div>
        {#if !embedded}<button class="icon-button" aria-label={t('Close')} title={t('Close')} onclick={dismiss}
            ><X size={18} /></button
          >{/if}
      </header>

      <div class="passkey-intro">
        <span class="passkey-intro-icon" aria-hidden="true"><ShieldCheck size={19} /></span>
        <div>
          <strong>{t('Sign in without a password')}</strong>
          <p>{t('Passkeys stay protected by your device and work with Face ID, Touch ID, or a security key.')}</p>
        </div>
      </div>

      <form
        class="passkey-add"
        onsubmit={(event) => {
          event.preventDefault();
          void addPasskey();
        }}
      >
        <label for="passkey-name">{t('Passkey name')}</label>
        <div>
          <input
            id="passkey-name"
            data-dialog-initial-focus
            bind:value={name}
            maxlength="80"
            placeholder={t('This device')}
            autocomplete="off"
            disabled={!supported || registering}
          />
          <button class="primary-button" type="submit" disabled={!supported || registering}>
            {#if registering}<LoaderCircle class="spin" size={15} />{:else}<Plus size={15} />{/if}
            <span>{registering ? t('Adding...') : t('Add passkey')}</span>
          </button>
        </div>
      </form>

      {#if !supported}
        <p class="passkey-unavailable">{t('Passkeys require a supported browser and a secure connection.')}</p>
      {:else if loading}
        <div class="passkey-loading" role="status">
          <LoaderCircle class="spin" size={17} />
          {t('Loading passkeys...')}
        </div>
      {:else if passkeys.length > 0}
        <ul class="passkey-list" aria-label={t('Registered passkeys')}>
          {#each passkeys as passkey (passkey.id)}
            <li class="passkey-row">
              <span class="passkey-row-icon" aria-hidden="true"><KeyRound size={17} /></span>
              <div>
                <strong>{passkey.name || t('Passkey')}</strong>
                <span
                  >{passkey.backedUp ? t('Synced passkey') : t('Device passkey')} · {t('Added {date}', {
                    date: dateLabel(passkey.createdAt),
                  })}</span
                >
              </div>
              <button
                class="icon-button danger"
                aria-label={t('Delete {name}', { name: passkey.name || t('Passkey') })}
                title={t('Delete passkey')}
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
          <span>{t('No passkeys registered yet')}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
