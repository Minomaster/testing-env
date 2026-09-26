<script lang="ts">
  let { title, summary }: { title: string; summary: string } = $props();
</script>

<section class="px-10 py-10">
  <h1 class="text-lg font-medium">{title}</h1>
  <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted">{summary}</p>
  <p class="mt-8 font-mono text-xs text-muted/70">Not built yet.</p>
</section>
