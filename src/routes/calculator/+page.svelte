<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { evaluateSheet, type AngleMode } from "$lib/calc/evaluate";
  import { formatQuantity } from "$lib/calc/format";
  import { readDataFile, readSettings, updateSettings, writeDataFile } from "$lib/dataFiles";

  const SHEET_FILE = "calculator/scratchpad.txt";
  const SAVE_DELAY_MS = 300;
  const MIN_ROWS = 14;
  const MODES: AngleMode[] = ["deg", "rad"];
  const PLACEHOLDER = [
    "# Each line is calculated as you type",
    "R = 220 Ω",
    "C = 4.70 µF",
    "tau = R C",
    "f_c = 1 / (2 pi tau)",
    "120 mph to m/s",
    "5.00 V ∠ 30",
  ].join("\n");

  let text = $state("");
  let mode = $state<AngleMode>("deg");
  let loaded = $state(false);
  let loadError = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  let copiedLine = $state<number | null>(null);

  const results = $derived(
    evaluateSheet(text, mode).map((r) => {
      if (r.kind === "value") return { value: formatQuantity(r.quantity, mode) };
      if (r.kind === "error") return { error: r.message };
      return {};
    }),
  );
  const rows = $derived(Math.max(results.length, MIN_ROWS));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let unsaved = false;

  onMount(async () => {
    try {
      const [sheet, settings] = await Promise.all([readDataFile(SHEET_FILE), readSettings()]);
      text = sheet ?? "";
      mode = settings.calculator?.angleMode ?? "deg";
      loaded = true;
    } catch (e) {
      loadError = String(e);
    }
  });

  function save() {
    clearTimeout(saveTimer);
    if (!unsaved) return;
    unsaved = false;
    writeDataFile(SHEET_FILE, text).then(
      () => (saveError = null),
      (e) => (saveError = String(e)),
    );
  }

  function scheduleSave() {
    unsaved = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  }

  onDestroy(save);

  async function setMode(next: AngleMode) {
    mode = next;
    try {
      await updateSettings((s) => {
        s.calculator = { ...s.calculator, angleMode: next };
      });
    } catch (e) {
      saveError = String(e);
    }
  }

  async function copy(line: number, value: string) {
    await navigator.clipboard.writeText(value);
    copiedLine = line;
    setTimeout(() => {
      if (copiedLine === line) copiedLine = null;
    }, 900);
  }
</script>

<div class="flex h-full flex-col">
  <header class="flex items-center justify-between gap-4 border-b border-line px-10 py-3">
    <h1 class="text-sm font-medium">Calculator</h1>
    <div class="flex items-center gap-4">
      {#if saveError}
        <p class="truncate text-xs text-danger" title={saveError}>Not saved: {saveError}</p>
      {/if}
      <div role="group" aria-label="Angle unit" class="flex rounded-md border border-line p-0.5 font-mono text-xs">
        {#each MODES as m (m)}
          <button
            class={[
              "rounded px-2.5 py-1 transition-colors duration-100",
              mode === m ? "bg-raised text-fg" : "text-muted hover:text-fg",
            ]}
            aria-pressed={mode === m}
            onclick={() => setMode(m)}>{m.toUpperCase()}</button
          >
        {/each}
      </div>
    </div>
  </header>

  {#if loadError}
    <p class="px-10 py-8 text-sm text-danger">Could not open the scratchpad: {loadError}</p>
  {:else if loaded}
    <div class="min-h-0 flex-1 overflow-auto">
      <div class="flex px-10 py-6 font-mono text-sm leading-7">
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          bind:value={text}
          oninput={scheduleSave}
          onblur={save}
          {rows}
          wrap="off"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          autofocus
          aria-label="Calculator scratchpad"
          placeholder={PLACEHOLDER}
          class="min-w-0 flex-1 resize-none overflow-x-auto overflow-y-hidden bg-transparent pr-6 pb-3 caret-accent outline-none select-text placeholder:text-muted/40"
        ></textarea>
        <div class="w-2/5 max-w-md min-w-56 shrink-0 border-l border-line pl-6 text-right" aria-label="Results">
          {#each results as r, i (i)}
            <div class="h-7 truncate">
              {#if r.value}
                <button
                  class="max-w-full truncate transition-colors duration-100 hover:text-accent"
                  title="Copy {r.value}"
                  onclick={() => copy(i, r.value)}>{copiedLine === i ? "Copied" : r.value}</button
                >
              {:else if r.error}
                <span class="text-xs text-muted/60" title={r.error}>{r.error}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
