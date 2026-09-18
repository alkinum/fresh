<script lang="ts">
  import {
    ArchiveRestore,
    Check,
    Fingerprint,
    LoaderCircle,
    LogOut,
    Palette,
    Upload,
    UserRound,
    X,
  } from '@lucide/svelte';
  import { modalFocus } from '$lib/modal-focus';
  import { useI18n } from '$lib/i18n.svelte';
  import type { Preferences } from '$lib/preferences';
  import BackupDialog from './BackupDialog.svelte';
  import PasskeyDialog from './PasskeyDialog.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';

  interface Profile {
    name: string;
    email: string;
    image?: string | null;
  }
  let {
    open,
    user,
    hasUnsavedChanges,
    onClose,
    onProfileChange,
    onLogout,
    onBackupComplete,
  }: {
    open: boolean;
    user: Profile;
    hasUnsavedChanges: boolean;
    onClose: () => void;
    onProfileChange: (profile: Partial<Profile>) => void;
    onLogout: () => void;
    onBackupComplete: () => Promise<void>;
  } = $props();
  const i18n = useI18n();
  const t = i18n.t;
  const sections = [
    { id: 'profile', label: 'Profile', icon: UserRound },
    { id: 'appearance', label: 'Appearance & language', icon: Palette },
    { id: 'passkeys', label: 'Passkeys', icon: Fingerprint },
    { id: 'backups', label: 'Backups', icon: ArchiveRestore },
  ] as const;
  const accents = [
    { value: 'blue', name: 'Blue', color: '#5288e8' },
    { value: 'green', name: 'Green', color: '#238567' },
    { value: 'violet', name: 'Violet', color: '#8264d6' },
    { value: 'rose', name: 'Rose', color: '#c35278' },
    { value: 'orange', name: 'Orange', color: '#bd6a29' },
  ] as const;
  let section = $state<(typeof sections)[number]['id']>('profile');
  let name = $state('');
  let busy = $state(false);
  let passkeyBusy = $state(false);
  let backupBusy = $state(false);
  let error = $state('');
  let status = $state('');
  let avatarInput = $state<HTMLInputElement>();
  let confirmation = $state<ConfirmDialog>();
  let openCycle = false;
  const locked = $derived(busy || passkeyBusy || backupBusy);

  $effect(() => {
    if (open && !openCycle) {
      name = user.name;
      section = 'profile';
      error = '';
      status = '';
    }
    openCycle = open;
  });

  async function dismiss(): Promise<boolean> {
    if (locked) return false;
    if (
      name.trim() !== user.name &&
      !(await confirmation?.ask(
        t('Discard profile changes?'),
        t('Your nickname has not been saved.'),
        t('Discard changes'),
      ))
    )
      return false;
    onClose();
    return true;
  }

  async function responseData<T>(response: Response): Promise<T> {
    const result = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Could not save settings');
    return result;
  }

  async function saveProfile(): Promise<void> {
    if (locked || !name.trim()) return;
    busy = true;
    error = '';
    status = '';
    try {
      const result = await responseData<{ name: string }>(
        await fetch('/api/account', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        }),
      );
      name = result.name;
      onProfileChange({ name: result.name });
      status = 'Profile saved';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not save settings';
    } finally {
      busy = false;
    }
  }

  async function updatePreferences(update: Partial<Preferences>): Promise<void> {
    if (locked) return;
    const previous = { ...i18n.preferences };
    const next = { ...previous, ...update };
    i18n.preferences = next;
    busy = true;
    error = '';
    status = '';
    try {
      await responseData(
        await fetch('/api/account', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preferences: next }),
        }),
      );
      status = 'Preferences saved';
    } catch (cause) {
      i18n.preferences = previous;
      error = cause instanceof Error ? cause.message : 'Could not save settings';
    } finally {
      busy = false;
    }
  }

  async function changeAvatar(file: File | null): Promise<void> {
    if (locked) return;
    busy = true;
    error = '';
    status = '';
    try {
      let body: Blob | undefined;
      if (file) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
          throw new Error('Choose a PNG, JPEG, or WebP image.');
        if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
        const bitmap = await createImageBitmap(file);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 256;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not prepare image');
          const side = Math.min(bitmap.width, bitmap.height);
          context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
          body = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare image'))),
              'image/webp',
              0.9,
            ),
          );
        } finally {
          bitmap.close();
        }
      }
      const result = await responseData<{ image: string | null }>(
        await fetch('/api/account/avatar', { method: file ? 'PUT' : 'DELETE', body }),
      );
      onProfileChange({ image: result.image });
      status = 'Avatar updated';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not update avatar';
    } finally {
      busy = false;
      if (avatarInput) avatarInput.value = '';
    }
  }
</script>

{#if open}
  <div class="dialog-layer" role="presentation">
    <button class="dialog-scrim" aria-label={t('Close settings')} onclick={() => void dismiss()}></button>
    <div
      class="dialog settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      use:modalFocus={{ onDismiss: () => void dismiss(), initialFocus: '[data-settings-tab="profile"]' }}
    >
      <ConfirmDialog bind:this={confirmation} />
      <header>
        <div class="dialog-title">
          <UserRound size={19} />
          <h2 id="settings-title">{t('Settings')}</h2>
        </div>
        <button class="icon-button" aria-label={t('Close settings')} disabled={locked} onclick={() => void dismiss()}
          ><X size={18} /></button
        >
      </header>
      <div class="settings-layout">
        <nav class="settings-nav" aria-label={t('Settings sections')}>
          {#each sections as item (item.id)}
            <button
              data-settings-tab={item.id}
              class:active={section === item.id}
              class:liquid-glass-surface={section === item.id}
              aria-pressed={section === item.id}
              disabled={locked}
              onclick={() => {
                section = item.id;
                error = '';
                status = '';
              }}
            >
              <item.icon size={16} /><span>{t(item.label)}</span>
            </button>
          {/each}
          <button
            class="settings-signout"
            disabled={locked}
            onclick={async () => {
              if (await dismiss()) onLogout();
            }}
          >
            <LogOut size={16} /><span>{t('Sign out')}</span>
          </button>
        </nav>
        <div class="settings-content" aria-busy={locked}>
          {#if section === 'profile'}
            <h3>{t('Profile')}</h3>
            <p class="settings-description">{t('Make this little space your own.')}</p>
            <div class="settings-avatar-row">
              <div class="settings-avatar">
                {#if user.image}<img src={user.image} alt={t('Your avatar')} />{:else}<span
                    >{user.name.slice(0, 1).toUpperCase()}</span
                  >{/if}
              </div>
              <div>
                <input
                  class="sr-only"
                  type="file"
                  tabindex="-1"
                  accept="image/png,image/jpeg,image/webp"
                  bind:this={avatarInput}
                  aria-label={t('Upload avatar')}
                  disabled={locked}
                  onchange={(event) => void changeAvatar(event.currentTarget.files?.[0] ?? null)}
                />
                <button class="secondary-button" disabled={locked} onclick={() => avatarInput?.click()}
                  ><Upload size={14} />{t('Upload avatar')}</button
                >
                {#if user.image}<button
                    class="settings-text-button"
                    disabled={locked}
                    onclick={() => void changeAvatar(null)}>{t('Remove avatar')}</button
                  >{/if}
                <p class="settings-field-hint">{t('PNG, JPEG or WebP. Cropped to a square.')}</p>
              </div>
            </div>
            <form
              class="settings-form"
              onsubmit={(event) => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              <label
                ><span>{t('Nickname')}</span><input
                  bind:value={name}
                  maxlength="80"
                  required
                  autocomplete="nickname"
                  disabled={locked}
                /></label
              >
              <div class="settings-email">
                <span>{t('Email')}</span><strong>{user.email}</strong>
                <p>{t('Managed by your sign-in provider.')}</p>
              </div>
              <button
                class="primary-button"
                type="submit"
                disabled={locked || !name.trim() || name.trim() === user.name}
              >
                {#if busy}<LoaderCircle class="spin" size={15} />{:else}<Check size={15} />{/if}{t('Save profile')}
              </button>
            </form>
          {:else if section === 'appearance'}
            <h3>{t('Appearance & language')}</h3>
            <p class="settings-description">{t('Saved to your account, wherever you open Fresh.')}</p>
            <div class="settings-form">
              <label
                ><span>{t('Interface language')}</span>
                <select
                  aria-label={t('Interface language')}
                  value={i18n.preferences.language}
                  disabled={locked}
                  onchange={(event) =>
                    void updatePreferences({ language: event.currentTarget.value as Preferences['language'] })}
                >
                  <option value="auto">{t('Follow browser')}</option><option value="zh-CN">简体中文</option><option
                    value="en">English</option
                  ><option value="ko">한국어</option><option value="ja">日本語</option>
                </select>
              </label>
              <fieldset>
                <legend>{t('Appearance')}</legend>
                <div class="segmented-control settings-theme">
                  {#each [{ value: 'auto', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] as theme (theme.value)}
                    <button
                      class:active={i18n.preferences.theme === theme.value}
                      aria-pressed={i18n.preferences.theme === theme.value}
                      disabled={locked}
                      onclick={() => void updatePreferences({ theme: theme.value as Preferences['theme'] })}
                      >{t(theme.label)}</button
                    >
                  {/each}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t('Theme color')}</legend>
                <div class="settings-colors">
                  {#each accents as accent (accent.value)}
                    <button
                      class:active={i18n.preferences.accent === accent.value}
                      aria-pressed={i18n.preferences.accent === accent.value}
                      aria-label={t(accent.name)}
                      title={t(accent.name)}
                      style={`--swatch: ${accent.color}`}
                      disabled={locked}
                      onclick={() => void updatePreferences({ accent: accent.value })}
                    >
                      {#if i18n.preferences.accent === accent.value}<Check size={18} />{/if}
                    </button>
                  {/each}
                </div>
              </fieldset>
            </div>
          {/if}
          <PasskeyDialog
            open={section === 'passkeys'}
            embedded
            onClose={() => void dismiss()}
            onError={(message) => (error = message)}
            onBusyChange={(value) => (passkeyBusy = value)}
          />
          <BackupDialog
            open={section === 'backups'}
            embedded
            {hasUnsavedChanges}
            onClose={() => void dismiss()}
            onComplete={onBackupComplete}
            onError={(message) => (error = message)}
            onBusyChange={(value) => (backupBusy = value)}
          />
          {#if error}<p class="settings-feedback error" role="alert">{t(error)}</p>{/if}
          {#if status}<p class="settings-feedback" role="status"><Check size={14} />{t(status)}</p>{/if}
        </div>
      </div>
    </div>
  </div>
{/if}
