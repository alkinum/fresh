<script lang="ts">
  import { resolve } from '$app/paths';
  import { AlertCircle, Fingerprint, LoaderCircle } from '@lucide/svelte';
  import { authClient } from '$lib/auth-client';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let authenticating = $state<'github' | 'passkey' | null>(null);
  let errorMessage = $state('');
  let passkeySupported = $derived(
    typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window
  );

  async function signIn(): Promise<void> {
    if (!data.githubAuthConfigured || authenticating) return;
    authenticating = 'github';
    errorMessage = '';

    try {
      const result = await authClient.signIn.social({ provider: 'github', callbackURL: '/app' });
      if (result.error) throw new Error(result.error.message ?? 'GitHub sign-in failed');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'GitHub sign-in failed';
      authenticating = null;
    }
  }

  async function signInWithPasskey(): Promise<void> {
    if (!passkeySupported || authenticating) return;
    authenticating = 'passkey';
    errorMessage = '';

    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        errorMessage =
          'code' in result.error && result.error.code === 'AUTH_CANCELLED'
            ? 'Passkey sign-in was cancelled.'
            : (result.error.message ?? 'Passkey sign-in failed');
        return;
      }
      location.assign('/app');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Passkey sign-in failed';
    } finally {
      authenticating = null;
    }
  }
</script>

<svelte:head>
  <title>Sign in | Fresh</title>
</svelte:head>

<div class="login-page">
  <div class="login-backdrop" aria-hidden="true">
    <svg class="login-waves" viewBox="0 0 1600 560" preserveAspectRatio="none">
      <path
        class="login-wave wave-one"
        d="M-240 250 C 40 55, 340 470, 650 255 S 1120 45, 1450 300 S 1740 435, 1840 260 L1840 640 L-240 640 Z"
      />
      <path
        class="login-wave wave-two"
        d="M-220 365 C -15 505, 190 145, 430 330 S 805 525, 1045 285 S 1435 120, 1810 365 L1810 640 L-220 640 Z"
      />
      <path
        class="login-wave wave-three"
        d="M-220 455 C 125 340, 390 535, 720 438 S 1190 345, 1505 458 S 1730 510, 1840 420 L1840 640 L-220 640 Z"
      />
    </svg>
  </div>

  <main class="login-stage">
    <section class="login-panel" aria-labelledby="login-title">
      <a class="login-brand" href={resolve('/')} aria-label="Fresh home">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </a>

      <div class="login-copy">
        <h1 id="login-title">Welcome back</h1>
        <p>Your notes, lists, and little plans are right here.</p>
      </div>

      <div class="login-actions">
        <button
          class="login-passkey-button"
          disabled={!passkeySupported || Boolean(authenticating)}
          aria-busy={authenticating === 'passkey'}
          onclick={() => void signInWithPasskey()}
        >
          {#if authenticating === 'passkey'}
            <LoaderCircle class="spin" size={19} />
          {:else}
            <Fingerprint size={19} />
          {/if}
          <span>{authenticating === 'passkey' ? 'Checking...' : 'Continue with a passkey'}</span>
        </button>

        <div class="login-divider"><span>or</span></div>

        <button
          class="login-github-button"
          disabled={!data.githubAuthConfigured || Boolean(authenticating)}
          aria-busy={authenticating === 'github'}
          onclick={() => void signIn()}
        >
          {#if authenticating === 'github'}
            <LoaderCircle class="spin" size={19} />
          {:else}
            <GitHubIcon size={19} />
          {/if}
          <span>{authenticating === 'github' ? 'Connecting...' : 'Continue with GitHub'}</span>
        </button>
      </div>

      <p class="login-help">New to Fresh? Start with GitHub, then add a passkey from your notebook.</p>

      {#if !passkeySupported || !data.githubAuthConfigured || errorMessage}
        <div class="login-message" role={errorMessage ? 'alert' : 'status'}>
          <AlertCircle size={16} />
          <span
            >{errorMessage ||
              (!passkeySupported
                ? 'Passkeys require a supported browser and a secure connection.'
                : 'GitHub sign-in is not configured on this environment.')}</span
          >
        </div>
      {/if}
    </section>
  </main>
</div>
