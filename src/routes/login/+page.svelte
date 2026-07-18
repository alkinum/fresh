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
      <path class="login-wave wave-one" d="M-180 270 C 20 160, 220 380, 420 270 S 820 160, 1020 270 S 1420 380, 1780 240 L1780 620 L-180 620 Z" />
      <path class="login-wave wave-two" d="M-180 350 C 60 220, 260 470, 500 340 S 940 220, 1180 350 S 1500 440, 1780 320 L1780 620 L-180 620 Z" />
      <path class="login-wave wave-three" d="M-180 430 C 80 320, 310 520, 570 420 S 1040 310, 1290 430 S 1530 500, 1780 390 L1780 620 L-180 620 Z" />
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
