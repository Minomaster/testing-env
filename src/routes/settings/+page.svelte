<script lang="ts">
  import { dataRoot } from "$lib/dataRoot.svelte";
  import FolderPicker from "$lib/FolderPicker.svelte";
</script>

<section class="max-w-2xl px-10 py-10">
  <h1 class="text-lg font-medium">Settings</h1>

  <div class="mt-10">
    <h2 class="text-xs font-medium tracking-wider text-muted uppercase">Data folder</h2>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Formulas and calculator history are stored here as plain files. Changing it does not move
      existing files.
    </p>
    <div class="mt-4 flex items-center gap-3">
      <code
        class="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm select-text"
        title={dataRoot.path}>{dataRoot.path}</code
      >
      <FolderPicker label="Change…" />
    </div>
  </div>
</section>
