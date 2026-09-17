<script lang="ts">
  import { createWindowVirtualizer, defaultRangeExtractor, type Range } from '@tanstack/svelte-virtual';
  import { SvelteSet } from 'svelte/reactivity';
  import { tick, untrack, type Snippet } from 'svelte';
  import type { NoteDto } from '$lib/types';

  let {
    ids,
    notes,
    active,
    onVisible,
    children,
    error,
    onRetry,
  }: {
    ids: string[];
    notes: ReadonlyMap<string, NoteDto>;
    active: boolean;
    onVisible: (ids: string[]) => void;
    children: Snippet<[NoteDto, (retain: boolean) => void]>;
    error: string;
    onRetry: () => void;
  } = $props();

  let width = $state(0);
  let mobile = $state(false);
  let margin = $state(0);
  let columns = $derived(mobile ? 1 : Math.max(1, Math.floor((width + 14) / 374)));
  const retained = new SvelteSet<string>();
  const focused = new SvelteSet<number>();
  let positions = $derived(new Map(ids.map((id, index) => [id, index])));
  let rangeExtractor = $derived.by(() => {
    const showVisible = active;
    const extra = [
      ...focused,
      ...[...retained].flatMap((id) => {
        const index = positions.get(id);
        return index === undefined ? [] : [Math.floor(index / columns)];
      }),
    ];
    return (range: Range) =>
      [...new Set([...(showVisible ? defaultRangeExtractor(range) : []), ...extra])]
        .filter((index) => index >= 0 && index < range.count)
        .sort((a, b) => a - b);
  });
  const virtualizer = createWindowVirtualizer<HTMLDivElement>({
    count: 0,
    estimateSize: () => 280,
    overscan: 3,
    gap: 14,
  });
  let rows = $derived($virtualizer.getVirtualItems());

  $effect(() => {
    const count = Math.ceil(ids.length / columns);
    const currentIds = ids;
    const currentColumns = columns;
    const options = {
      count,
      scrollMargin: margin,
      rangeExtractor,
      getItemKey: (index: number) => `${currentColumns}:${currentIds[index * currentColumns]}`,
    };
    untrack(() => $virtualizer.setOptions(options));
  });

  $effect(() => {
    void width;
    void columns;
    untrack(() => $virtualizer.measure());
  });

  $effect(() => {
    const visibleIds = rows.flatMap((row) => ids.slice(row.index * columns, (row.index + 1) * columns));
    untrack(() => onVisible(visibleIds));
  });

  function layout(node: HTMLDivElement) {
    const media = window.matchMedia('(max-width: 780px)');
    function measure() {
      mobile = media.matches;
      if (node.offsetWidth === 0) return;
      width = node.clientWidth;
      margin = node.getBoundingClientRect().top + window.scrollY;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    const composer = document.querySelector('.composer');
    if (composer) observer.observe(composer);
    window.addEventListener('resize', measure);
    media.addEventListener('change', measure);
    measure();
    return {
      destroy() {
        observer.disconnect();
        window.removeEventListener('resize', measure);
        media.removeEventListener('change', measure);
      },
    };
  }

  function measureRow(node: HTMLDivElement) {
    const instance = $virtualizer;
    instance.measureElement(node);
    function focusIn() {
      focused.add(Number(node.dataset.index));
    }
    async function focusOut() {
      await tick();
      if (!node.contains(document.activeElement)) focused.delete(Number(node.dataset.index));
    }
    node.addEventListener('focusin', focusIn);
    node.addEventListener('focusout', focusOut);
    return {
      destroy() {
        node.removeEventListener('focusin', focusIn);
        node.removeEventListener('focusout', focusOut);
        focused.delete(Number(node.dataset.index));
        // Actions are destroyed before their nodes detach. Clean the observer's
        // element cache after Svelte removes the row, including the final scroll.
        void tick().then(() => instance.measureElement(null));
      },
    };
  }
</script>

<div class="virtual-notes" use:layout style:height={`${$virtualizer.getTotalSize()}px`}>
  {#each rows as row (row.key)}
    <div
      class="virtual-note-row"
      data-index={row.index}
      use:measureRow
      style:grid-template-columns={`repeat(${columns}, minmax(0, 1fr))`}
      style:transform={`translateY(${row.start - margin}px)`}
    >
      {#each ids.slice(row.index * columns, (row.index + 1) * columns) as id (id)}
        {@const note = notes.get(id)}
        {#if note}
          {@render children(note, (retain) => {
            if (retain) retained.add(id);
            else retained.delete(id);
          })}
        {:else}
          <div class="note-card note-placeholder" style:min-height={`${row.size}px`} aria-busy={!error}>
            {#if error}
              <p>{error}</p>
              <button class="secondary-button" onclick={onRetry}>Try again</button>
            {:else}<span>Loading note…</span>{/if}
          </div>
        {/if}
      {/each}
    </div>
  {/each}
</div>
