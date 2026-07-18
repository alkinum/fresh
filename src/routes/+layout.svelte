<script lang="ts">
  import 'katex/dist/katex.min.css';
  import '../styles/global.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>Fresh</title>
  <meta
    name="description"
    content="A focused notebook for rich Markdown, media, documents, and encrypted backups."
  />
</svelte:head>

{@render children()}
