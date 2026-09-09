<script lang="ts">
  import { onDestroy } from 'svelte';
  import { AlertTriangle } from '@lucide/svelte';
  import { modalFocus } from '$lib/modal-focus';

  let request = $state<{ title: string; description: string; action: string } | null>(null);
  let settle: ((confirmed: boolean) => void) | undefined;
  const id = $props.id();

  export function ask(title: string, description: string, action = 'Delete'): Promise<boolean> {
    if (request) return Promise.resolve(false);
    request = { title, description, action };
    return new Promise((resolve) => {
      settle = resolve;
    });
  }

  function close(confirmed = false): void {
    request = null;
    settle?.(confirmed);
    settle = undefined;
  }

  onDestroy(() => settle?.(false));
</script>

{#if request}
  <div class="dialog-layer confirmation-layer" role="presentation">
    <button class="dialog-scrim" aria-label="Cancel" onclick={() => close()}></button>
    <div
      class="dialog confirmation-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      use:modalFocus={{ onDismiss: () => close() }}
    >
      <div class="confirmation-copy">
        <span class="confirmation-icon"><AlertTriangle size={22} /></span>
        <h2 id={`${id}-title`}>{request.title}</h2>
        <p id={`${id}-description`}>{request.description}</p>
      </div>
      <div class="confirmation-actions">
        <button class="secondary-button" data-dialog-initial-focus onclick={() => close()}>Cancel</button>
        <button class="danger-button" onclick={() => close(true)}>{request.action}</button>
      </div>
    </div>
  </div>
{/if}
