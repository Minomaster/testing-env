<script lang="ts">
  import { chooseDataRoot } from "$lib/dataRoot.svelte";

  let { label, primary = false }: { label: string; primary?: boolean } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function pick() {
    busy = true;
    error = null;
    try {
      await chooseDataRoot();
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
</script>

<button class={["btn", primary && "btn-primary"]} onclick={pick} disabled={busy}>{label}</button>
{#if error}
  <p class="mt-3 text-sm text-danger">{error}</p>
{/if}
