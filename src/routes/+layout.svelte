<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { dataRoot, loadDataRoot } from "$lib/dataRoot.svelte";
  import Onboarding from "$lib/Onboarding.svelte";

  let { children } = $props();

  const modules = [
    { href: "/calculator", label: "Calculator", glyph: "=" },
    { href: "/formulas", label: "Formulas", glyph: "∑" },
    { href: "/ee", label: "EE Toolbox", glyph: "Ω" },
    { href: "/sandbox", label: "Orbit sandbox", glyph: "◐" },
  ];

  onMount(loadDataRoot);
</script>

{#snippet navLink(href: string, label: string, glyph: string)}
  {@const active = page.url.pathname.startsWith(href)}
  <a
    {href}
    aria-current={active ? "page" : undefined}
    class={[
      "mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-100",
      active ? "bg-raised text-fg" : "text-muted hover:text-fg",
    ]}
  >
    <span class={["w-4 text-center font-mono", active && "text-accent"]}>{glyph}</span>
    {label}
  </a>
{/snippet}

{#if dataRoot.loaded && !dataRoot.path}
  <Onboarding />
{:else if dataRoot.loaded}
  <div class="flex h-screen">
    <nav class="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line bg-surface py-4">
      <p class="px-5 pb-5 font-mono text-sm text-fg">MkStudy</p>
      {#each modules as m (m.href)}
        {@render navLink(m.href, m.label, m.glyph)}
      {/each}
      <div class="mt-auto">
        {@render navLink("/settings", "Settings", "⚙︎")}
      </div>
    </nav>
    <main class="min-w-0 flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
