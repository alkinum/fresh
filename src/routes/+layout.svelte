<script lang="ts">
  import 'katex/dist/katex.min.css';
  import '../styles/global.css';
  import '../styles/preferences.css';
  import '../styles/settings.css';
  import { untrack } from 'svelte';
  import { provideI18n } from '$lib/i18n.svelte';

  let { children, data } = $props();
  const i18n = provideI18n(
    untrack(() => data.preferences),
    untrack(() => data.acceptedLanguages),
  );
  $effect(() => {
    i18n.preferences = data.preferences;
    i18n.acceptedLanguages = data.acceptedLanguages;
  });
  $effect(() => {
    document.documentElement.lang = i18n.locale;
    document.documentElement.dataset.theme = i18n.preferences.theme;
    document.documentElement.dataset.accent = i18n.preferences.accent;
  });
</script>

<svelte:head>
  <title>Fresh</title>
  {#if i18n.preferences.theme === 'auto'}
    <meta name="theme-color" content="#edf5f8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0e1724" media="(prefers-color-scheme: dark)" />
  {:else}
    <meta name="theme-color" content={i18n.preferences.theme === 'dark' ? '#0e1724' : '#edf5f8'} />
  {/if}
  <meta name="description" content="A focused notebook for rich Markdown, media, documents, and encrypted backups." />
</svelte:head>

{@render children()}
