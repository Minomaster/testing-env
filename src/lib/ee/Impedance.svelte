<script lang="ts">
  import { errorMessage, evaluateInput, type AngleMode } from "$lib/calc/evaluate";
  import { formatQuantity } from "$lib/calc/format";
  import { impedanceExpr } from "./expressions";

  let { mode }: { mode: AngleMode } = $props();

  let r = $state("100 Ω");
  let l = $state("");
  let c = $state("10.0 uF");
  let f = $state("1.00 kHz");

  const fields = [
    { label: "Resistance R", key: "r", placeholder: "e.g. 100 Ω" },
    { label: "Inductance L", key: "l", placeholder: "blank = none" },
    { label: "Capacitance C", key: "c", placeholder: "blank = none" },
    { label: "Frequency f", key: "f", placeholder: "e.g. 50 Hz" },
  ] as const;

  const result = $derived.by(() => {
    if (!r.trim() && !l.trim() && !c.trim()) return "—";
    if ((l.trim() || c.trim()) && !f.trim()) return "Enter a frequency";
    try {
      return formatQuantity(evaluateInput(impedanceExpr(r, l, c, f), mode), mode);
    } catch (e) {
      return errorMessage(e);
    }
  });
</script>

<section class="max-w-3xl px-10 py-8">
  <h1 class="text-lg font-medium">Series RLC impedance</h1>
  <p class="mt-2 text-sm text-muted">Z = R + jωL + 1/(jωC). Leave a component blank if it isn't there.</p>

  <div class="mt-6 grid max-w-md grid-cols-[9rem_1fr] items-center gap-3">
    {#each fields as field (field.key)}
      <span class="text-sm text-muted">{field.label}</span>
      {#if field.key === "r"}<input class="field font-mono" bind:value={r} placeholder={field.placeholder} />
      {:else if field.key === "l"}<input class="field font-mono" bind:value={l} placeholder={field.placeholder} />
      {:else if field.key === "c"}<input class="field font-mono" bind:value={c} placeholder={field.placeholder} />
      {:else}<input class="field font-mono" bind:value={f} placeholder={field.placeholder} />{/if}
    {/each}
  </div>

  <p class="mt-8 font-mono text-base"><span class="label mr-3">Z</span>{result}</p>
</section>
