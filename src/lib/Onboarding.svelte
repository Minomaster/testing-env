<script lang="ts">
  import FolderPicker from "$lib/FolderPicker.svelte";
</script>

<main class="flex h-screen items-center justify-center px-6">
  <div class="max-w-md">
    <p class="font-mono text-sm text-accent">MkStudy</p>
    <h1 class="mt-3 text-2xl font-medium tracking-tight">Choose a data folder</h1>
    <p class="mt-3 text-sm leading-relaxed text-muted">
      Your formulas and calculator history are saved there as plain files. Put it inside OneDrive,
      Dropbox or a git repo to keep it in sync between devices.
    </p>
    <div class="mt-8">
      <FolderPicker label="Choose folder…" primary />
    </div>
  </div>
</main>
