<script lang="ts">
  import type { Unit } from "mathjs";
  import { goto } from "$app/navigation";
  import type { AngleMode, Quantity } from "$lib/calc/evaluate";
  import { formatQuantity } from "$lib/calc/format";
  import { math } from "$lib/calc/math";
  import { readDataFile, writeDataFile } from "$lib/dataFiles";
  import { removeFormula } from "./library.svelte";
  import { obsidianMarkdown, renderLatex, scratchpadLines, symbolLatex, unitText } from "./present";
  import { solve, unitOf } from "./solve";
  import type { LibraryFormula, Variable } from "./types";

  let { formula, mode, onEdit }: { formula: LibraryFormula; mode: AngleMode; onEdit?: () => void } = $props();

  let inputs = $state<Record<string, string>>({});
  let copied = $state(false);
  let confirmRemove = $state(false);
  let actionError = $state<string | null>(null);

  $effect.pre(() => {
    void formula.id;
    inputs = Object.fromEntries(formula.variables.map((v) => [v.symbol, ""]));
    confirmRemove = false;
    actionError = null;
  });

  const blanks = $derived(formula.variables.filter((v) => !inputs[v.symbol]?.trim()));
  const result = $derived(formula.expr && blanks.length === 1 ? solve(formula, inputs, mode) : null);
  const solved = $derived(result && !("error" in result) ? result : null);

  /** Full-precision text the calculator can read back, in the variable's declared unit. */
  function machineText(q: Quantity, v: Variable): string {
    const digits = isFinite(q.sf) ? q.sf : 10;
    const unit = unitOf(v);
    const number = unit ? (q.value as Unit).toNumber(v.unit.replace(/Ω/g, "ohm")) : (q.value as number);
    return v.unit ? `${number.toPrecision(digits)} ${v.unit}` : number.toPrecision(digits);
  }

  async function sendToCalculator() {
    try {
      const solvedVar = solved && formula.variables.find((v) => v.symbol === solved.symbol);
      const lines = scratchpadLines(
        formula,
        inputs,
        solved && solvedVar ? { symbol: solved.symbol, text: machineText(solved.quantity, solvedVar) } : undefined,
      );
      const existing = (await readDataFile("calculator/scratchpad.txt")) ?? "";
      const separator = existing.trim() ? "\n\n" : "";
      await writeDataFile("calculator/scratchpad.txt", existing.trimEnd() + separator + lines.join("\n") + "\n");
      await goto("/calculator");
    } catch (e) {
      actionError = String(e);
    }
  }

  async function copyForObsidian() {
    await navigator.clipboard.writeText(obsidianMarkdown(formula));
    copied = true;
    setTimeout(() => (copied = false), 900);
  }

  async function remove() {
    if (!confirmRemove) {
      confirmRemove = true;
      return;
    }
    try {
      await removeFormula(formula.id);
    } catch (e) {
      actionError = String(e);
    }
  }

  function isAngle(v: Variable): boolean {
    const u = unitOf(v);
    return !!u && u.equalBase(math.unit(1, "rad"));
  }
</script>

<article class="max-w-3xl px-10 py-8">
  <div class="flex items-start justify-between gap-6">
    <div>
      <p class="text-xs text-muted">
        {formula.category}
        {#if formula.source === "edited"}<span class="ml-2 text-accent">edited</span>{/if}
        {#if formula.source === "user"}<span class="ml-2 text-accent">yours</span>{/if}
      </p>
      <h1 class="mt-1 text-lg font-medium">{formula.name}</h1>
    </div>
    <div class="flex shrink-0 gap-2">
      <button class="btn btn-sm" onclick={copyForObsidian}>{copied ? "Copied" : "Copy for Obsidian"}</button>
      {#if onEdit}<button class="btn btn-sm" onclick={onEdit}>Edit</button>{/if}
      {#if formula.source !== "builtin"}
        <button class="btn btn-sm" onclick={remove} onblur={() => (confirmRemove = false)}>
          {confirmRemove ? "Click again to confirm" : formula.source === "edited" ? "Reset to built-in" : "Delete"}
        </button>
      {/if}
    </div>
  </div>

  <div class="mt-8 overflow-x-auto py-2 text-xl">{@html renderLatex(formula.latex, true)}</div>
  {#if formula.note}
    <p class="mt-4 text-sm leading-relaxed text-muted">{formula.note}</p>
  {/if}

  {#if formula.variables.length}
    <section class="mt-10">
      <div class="flex items-baseline justify-between">
        <h2 class="label">{formula.expr ? "Solve" : "Variables"}</h2>
        {#if formula.expr}
          <p class="text-xs text-muted">Fill in all but one field · angles: {mode.toUpperCase()}</p>
        {/if}
      </div>
      <div class="mt-3 divide-y divide-line rounded-md border border-line">
        {#each formula.variables as v (v.symbol)}
          {@const isResult = solved?.symbol === v.symbol}
          <div class="grid grid-cols-[4.5rem_1fr_14rem] items-center gap-4 px-4 py-2.5">
            <span class="text-base">{@html renderLatex(symbolLatex(v.symbol))}</span>
            <span class="min-w-0 text-sm text-muted">
              {v.description}
              <span class="ml-1 font-mono text-xs text-muted/70">{unitText(v.unit)}</span>
            </span>
            {#if formula.expr}
              <input
                class={["field font-mono", isResult && "border-accent/50 placeholder:text-accent"]}
                bind:value={inputs[v.symbol]}
                placeholder={isResult && solved
                  ? `= ${formatQuantity(solved.quantity, mode)}`
                  : isAngle(v)
                    ? "e.g. 30 deg"
                    : v.unit
                      ? `e.g. 1 ${v.unit}`
                      : "e.g. 1"}
                title={isResult && solved ? formatQuantity(solved.quantity, mode) : undefined}
                spellcheck="false"
                autocomplete="off"
                aria-label={v.description}
              />
            {:else}
              <span></span>
            {/if}
          </div>
        {/each}
      </div>
      {#if result && "error" in result}
        <p class="mt-3 text-sm text-muted">{result.error}</p>
      {/if}
      {#if formula.expr}
        <div class="mt-4 flex items-center gap-3">
          <button class="btn btn-sm" onclick={sendToCalculator}>Send to calculator</button>
          <span class="font-mono text-xs text-muted/70">{formula.expr}</span>
        </div>
      {/if}
    </section>
  {/if}

  {#if actionError}
    <p class="mt-4 text-sm text-danger">{actionError}</p>
  {/if}
</article>
