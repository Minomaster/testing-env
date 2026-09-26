<script lang="ts">
  import { untrack } from "svelte";
  import { FUNCTION_NAMES } from "$lib/calc/parse";
  import { saveFormula } from "./library.svelte";
  import { renderLatex } from "./present";
  import { compile, dimensionError, unitOf } from "./solve";
  import { slug, type Formula, type Variable } from "./types";

  let {
    formula,
    categories,
    onDone,
  }: { formula: Formula; categories: string[]; onDone: (id: string | null) => void } = $props();

  // Editing a copy taken once (the page re-creates this component per formula); nothing is saved until "Save".
  let draft = $state(untrack(() => structuredClone($state.snapshot(formula)) as Formula));
  let tagsText = $state(untrack(() => formula.tags.join(", ")));
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  const RESERVED = new Set(["i", "e", "pi", "π", "ans", "to", ...FUNCTION_NAMES]);
  const SYMBOL = /^[\p{L}_][\p{L}\p{Nd}_]*$/u;

  function variableProblem(v: Variable, index: number): string | null {
    if (!SYMBOL.test(v.symbol)) return "Symbol must start with a letter (letters, digits, _)";
    if (RESERVED.has(v.symbol)) return `"${v.symbol}" is reserved`;
    if (draft.variables.findIndex((w) => w.symbol === v.symbol) !== index) return "Duplicate symbol";
    if (!v.description.trim()) return "Add a description";
    try {
      unitOf(v);
    } catch {
      return `Unknown unit "${v.unit}"`;
    }
    return null;
  }

  const problems = $derived.by(() => {
    const list: string[] = [];
    if (!draft.name.trim()) list.push("Give the formula a name");
    if (!draft.category.trim()) list.push("Choose a category");
    if (!draft.latex.trim()) list.push("Add the LaTeX form");
    draft.variables.forEach((v, i) => {
      const p = variableProblem(v, i);
      if (p) list.push(`${v.symbol || `Variable ${i + 1}`}: ${p}`);
    });
    const expr = draft.expr?.trim();
    if (expr && list.length === 0) {
      try {
        compile(expr);
        const names = new Set(expr.match(/[\p{L}_][\p{L}\p{Nd}_]*/gu));
        for (const v of draft.variables) if (!names.has(v.symbol)) list.push(`${v.symbol} isn't used in the expression`);
        const dim = dimensionError({ ...draft, expr });
        if (dim) list.push(`Units don't balance: ${dim}`);
      } catch (e) {
        list.push(`Expression: ${e instanceof Error ? e.message : e}`);
      }
    }
    return list;
  });

  function addVariable() {
    draft.variables.push({ symbol: "", unit: "", description: "" });
  }

  async function save() {
    saving = true;
    saveError = null;
    try {
      const id = draft.id || `user/${slug(draft.name) || "formula"}-${Date.now().toString(36)}`;
      const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
      await saveFormula({ ...$state.snapshot(draft), id, tags, name: draft.name.trim(), category: draft.category.trim() });
      onDone(id);
    } catch (e) {
      saveError = String(e);
    } finally {
      saving = false;
    }
  }
</script>

<form class="max-w-3xl px-10 py-8" onsubmit={(e) => (e.preventDefault(), save())}>
  <h1 class="text-lg font-medium">{formula.id ? "Edit formula" : "New formula"}</h1>
  {#if formula.id && !formula.id.startsWith("user/")}
    <p class="mt-1 text-xs text-muted">Your edits are saved on top of the built-in version; you can reset it later.</p>
  {/if}

  <div class="mt-8 grid grid-cols-2 gap-4">
    <label class="flex flex-col gap-1.5">
      <span class="label">Name</span>
      <input class="field" bind:value={draft.name} />
    </label>
    <label class="flex flex-col gap-1.5">
      <span class="label">Category</span>
      <input class="field" bind:value={draft.category} list="formula-categories" />
      <datalist id="formula-categories">
        {#each categories as c (c)}<option value={c}></option>{/each}
      </datalist>
    </label>
  </div>

  <label class="mt-6 flex flex-col gap-1.5">
    <span class="label">LaTeX</span>
    <input class="field font-mono" bind:value={draft.latex} spellcheck="false" placeholder={"\\vec F = m\\vec a"} />
  </label>
  <div class="mt-3 min-h-12 overflow-x-auto rounded-md border border-line/60 px-4 py-3 text-lg">
    {#if draft.latex.trim()}{@html renderLatex(draft.latex, true)}{:else}<span class="text-sm text-muted/60">Preview</span>{/if}
  </div>

  <label class="mt-6 flex flex-col gap-1.5">
    <span class="label">Expression for solving <span class="normal-case tracking-normal">(optional, calculator syntax)</span></span>
    <input class="field font-mono" bind:value={draft.expr} spellcheck="false" placeholder="F = m a" />
  </label>
  <p class="mt-1.5 text-xs text-muted">Leave empty for a reference-only formula. Constants like c, h_P, k_B, q_e can be used directly.</p>

  <div class="mt-6">
    <span class="label">Variables</span>
    <div class="mt-2 flex flex-col gap-2">
      {#each draft.variables as v, i (i)}
        <div class="grid grid-cols-[7rem_8rem_1fr_auto] gap-2">
          <input class="field font-mono" bind:value={v.symbol} placeholder="symbol" spellcheck="false" aria-label="Symbol" />
          <input class="field font-mono" bind:value={v.unit} placeholder="unit, e.g. m/s" spellcheck="false" aria-label="Unit" />
          <input class="field" bind:value={v.description} placeholder="description" aria-label="Description" />
          <button type="button" class="btn btn-sm" onclick={() => draft.variables.splice(i, 1)} aria-label="Remove variable">×</button>
        </div>
      {/each}
    </div>
    <button type="button" class="btn btn-sm mt-2" onclick={addVariable}>Add variable</button>
  </div>

  <div class="mt-6 grid grid-cols-2 gap-4">
    <label class="flex flex-col gap-1.5">
      <span class="label">Tags</span>
      <input class="field" bind:value={tagsText} placeholder="circuits, resistor" />
    </label>
    <label class="flex flex-col gap-1.5">
      <span class="label">Note</span>
      <input class="field" bind:value={draft.note} placeholder="optional" />
    </label>
  </div>

  {#if problems.length}
    <ul class="mt-6 flex flex-col gap-1 text-sm text-muted">
      {#each problems as p (p)}<li>· {p}</li>{/each}
    </ul>
  {/if}
  {#if saveError}<p class="mt-4 text-sm text-danger">{saveError}</p>{/if}

  <div class="mt-8 flex gap-2">
    <button type="submit" class="btn btn-primary" disabled={problems.length > 0 || saving}>Save</button>
    <button type="button" class="btn" onclick={() => onDone(null)}>Cancel</button>
  </div>
</form>
