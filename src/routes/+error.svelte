<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { ArrowLeft, RotateCw } from '@lucide/svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} | Fresh</title></svelte:head>

<main class="error-page">
  <a class="login-brand" href={resolve('/')} aria-label="Fresh home">
    <span class="brand-mark" aria-hidden="true"><img src="/favicon-256x256.png" alt="" /></span>
    <strong>Fresh</strong>
  </a>
  <span class="workspace-eyebrow">{page.status}</span>
  <h1>{page.status === 404 ? 'This page wandered off.' : 'A little interruption.'}</h1>
  <p>
    {page.status === 404
      ? 'The link may have moved. Let’s get you back to a familiar place.'
      : 'Fresh could not load this page. Give it another try in a moment.'}
  </p>
  <div class="error-page-actions">
    <a class="secondary-button" href={resolve('/')}><ArrowLeft size={16} /> Back to Fresh</a>
    {#if page.status !== 404}
      <button class="primary-button" onclick={() => location.reload()}><RotateCw size={16} /> Try again</button>
    {/if}
  </div>
</main>

<style>
  .error-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 32px 24px;
    text-align: center;
  }
  .login-brand {
    margin-bottom: 36px;
  }
  h1 {
    margin: 10px 0 12px;
    font-size: clamp(26px, 5vw, 36px);
  }
  p {
    max-width: 380px;
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.8;
  }
  .error-page-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
  }
  a {
    text-decoration: none;
  }
</style>
