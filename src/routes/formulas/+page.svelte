<script lang="ts">
  import "katex/dist/katex.min.css";
  import { onMount, tick } from "svelte";
  import type { AngleMode } from "$lib/calc/evaluate";
  import { readSettings } from "$lib/dataFiles";
  import FormulaDetail from "$lib/formulas/FormulaDetail.svelte";
  import FormulaEditor from "$lib/formulas/FormulaEditor.svelte";
  import { library, loadLibrary, searchFormulas } from "$lib/formulas/library.svelte";
  import type { Formula } from "$lib/formulas/types";

  let query = $state("");
  let selectedId = $state<string | null>(null);
  let editing = $state<Formula | null>(null);
  let loaded = $state(false);
  let loadError = $state<string | null>(null);
  let mode = $state<AngleMode>("deg");
  let list = $state<HTMLElement>();

  const results = $derived(searchFormulas(library.formulas, query));
  const selected = $derived(results.find((f) => f.id === selectedId) ?? results[0] ?? null);

  onMount(async () => {
    try {
      const [, settings] = await Promise.all([loadLibrary(), readSettings()]);
      mode = settings.calculator?.angleMode ?? "deg";
      loaded = true;
    } catch (e) {
      loadError = String(e);
    }
  });

  async function select(id: string) {
    selectedId = id;
    editing = null;
    await tick();
    list?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const index = results.findIndex((f) => f.id === selected?.id);
    const next = results[Math.min(results.length - 1, Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) select(next.id);
  }

  function startNew() {
    editing = { id: "", name: "", category: selected?.category ?? "", latex: "", expr: "", variables: [], tags: [] };
  }

  function doneEditing(id: string | null) {
    editing = null;
    if (id) {
      query = "";
      select(id);
    }
  }
</script>

{#if loadError}
  <p class="px-10 py-8 text-sm text-danger">Could not load formulas: {loadError}</p>
{:else if loaded}
  <div class="flex h-full">
    <aside class="flex w-80 shrink-0 flex-col border-r border-line">
      <div class="flex gap-2 border-b border-line p-3">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="field min-w-0 flex-1"
          type="search"
          bind:value={query}
          onkeydown={onSearchKey}
          placeholder="Search {library.formulas.length} formulas"
          aria-label="Search formulas"
          autofocus
        />
        <button class="btn btn-sm" onclick={startNew} title="New formula" aria-label="New formula">+</button>
      </div>
      <ul class="min-h-0 flex-1 overflow-y-auto py-1" bind:this={list}>
        {#each results as f (f.id)}
          <li>
            <button
              data-id={f.id}
              class={[
                "flex w-full flex-col px-4 py-2 text-left transition-colors duration-100",
                f.id === selected?.id && !editing ? "bg-raised" : "hover:bg-raised/50",
              ]}
              onclick={() => select(f.id)}
            >
              <span class="truncate text-sm">{f.name}</span>
              <span class="truncate text-xs text-muted">
                {f.category}{#if f.source !== "builtin"}<span class="text-accent">{` · ${f.source === "user" ? "yours" : "edited"}`}</span>{/if}
              </span>
            </button>
          </li>
        {:else}
          <li class="px-4 py-6 text-sm text-muted">No formulas match "{query}".</li>
        {/each}
      </ul>
    </aside>

    <div class="min-w-0 flex-1 overflow-y-auto">
      {#if editing}
        {#key editing}
          <FormulaEditor formula={editing} categories={library.categories} onDone={doneEditing} />
        {/key}
      {:else if selected}
        <FormulaDetail formula={selected} {mode} onEdit={() => (editing = structuredClone($state.snapshot(selected)))} />
      {/if}
    </div>
  </div>
{/if}
