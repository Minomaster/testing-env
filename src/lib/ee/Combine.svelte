<script lang="ts">
  import { errorMessage, evaluateInput } from "$lib/calc/evaluate";
  import { formatQuantity } from "$lib/calc/format";
  import { combineExpr, type Component } from "./expressions";

  let kind = $state<Component>("resistor");
  let values = $state(["220 Ω", "330 Ω"]);

  const placeholder = $derived({ resistor: "e.g. 220 Ω", inductor: "e.g. 10 mH", capacitor: "e.g. 4.7 uF" }[kind]);
  const filled = $derived(values.filter((v) => v.trim()));

  function result(how: "series" | "parallel"): string {
    if (filled.length < 2) return "—";
    try {
      return formatQuantity(evaluateInput(combineExpr(kind, filled, how), "deg"), "deg");
    } catch (e) {
      return errorMessage(e);
    }
  }
</script>

<section class="max-w-3xl px-10 py-8">
  <h1 class="text-lg font-medium">Series & parallel</h1>

  <div role="group" aria-label="Component" class="mt-6 inline-flex rounded-md border border-line p-0.5 text-xs">
    {#each ["resistor", "inductor", "capacitor"] as k (k)}
      <button
        class={["rounded px-2.5 py-1 capitalize", kind === k ? "bg-raised text-fg" : "text-muted hover:text-fg"]}
        aria-pressed={kind === k}
        onclick={() => (kind = k as Component)}>{k}s</button
      >
    {/each}
  </div>

  <div class="mt-6 flex max-w-sm flex-col gap-2">
    {#each values as _, i (i)}
      <div class="flex gap-2">
        <input class="field flex-1 font-mono" bind:value={values[i]} {placeholder} aria-label="Value {i + 1}" />
        <button class="btn btn-sm" onclick={() => values.splice(i, 1)} aria-label="Remove value">×</button>
      </div>
    {/each}
    <button class="btn btn-sm self-start" onclick={() => values.push("")}>Add value</button>
  </div>

  <dl class="mt-8 grid max-w-sm grid-cols-[6rem_1fr] gap-y-2 font-mono text-sm">
    <dt class="label self-center">Series</dt>
    <dd class="text-right text-base">{result("series")}</dd>
    <dt class="label self-center">Parallel</dt>
    <dd class="text-right text-base">{result("parallel")}</dd>
  </dl>
</section>
