<script lang="ts">
  import { AlertCircle, GitFork, LoaderCircle } from '@lucide/svelte';
  import { authClient } from '$lib/auth-client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let loading = $state(false);
  let errorMessage = $state('');

  async function signIn(): Promise<void> {
    if (!data.githubAuthConfigured || loading) return;
    loading = true;
    errorMessage = '';

    try {
      const result = await authClient.signIn.social({ provider: 'github', callbackURL: '/' });
      if (result.error) throw new Error(result.error.message ?? 'GitHub sign-in failed');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'GitHub sign-in failed';
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in | Fresh</title>
</svelte:head>

<div class="login-page">
  <div class="login-backdrop" aria-hidden="true">
    <svg class="login-waves" viewBox="0 0 1600 560" preserveAspectRatio="none">
      <path class="login-wave wave-one" d="M-240 250 C 40 55, 340 470, 650 255 S 1120 45, 1450 300 S 1740 435, 1840 260 L1840 640 L-240 640 Z" />
      <path class="login-wave wave-two" d="M-220 365 C -15 505, 190 145, 430 330 S 805 525, 1045 285 S 1435 120, 1810 365 L1810 640 L-220 640 Z" />
      <path class="login-wave wave-three" d="M-220 455 C 125 340, 390 535, 720 438 S 1190 345, 1505 458 S 1730 510, 1840 420 L1840 640 L-220 640 Z" />
    </svg>
  </div>

  <main class="login-stage">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-brand" aria-label="Fresh">
        <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
        <strong>Fresh</strong>
      </div>

      <div class="login-copy">
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to continue to your notes.</p>
      </div>

      <button
        class="login-github-button"
        disabled={!data.githubAuthConfigured || loading}
        aria-busy={loading}
        onclick={() => void signIn()}
      >
        {#if loading}
          <LoaderCircle class="spin" size={19} />
        {:else}
          <GitFork size={19} />
        {/if}
        <span>{loading ? 'Connecting...' : 'Continue with GitHub'}</span>
      </button>

      {#if !data.githubAuthConfigured || errorMessage}
        <div class="login-message" role="status">
          <AlertCircle size={16} />
          <span>{errorMessage || 'GitHub sign-in is not configured.'}</span>
        </div>
      {/if}
    </section>
  </main>
</div>
