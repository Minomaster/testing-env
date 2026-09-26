<script lang="ts">
  import { errorMessage, evaluateInput, realSI, type AngleMode, type Quantity } from "$lib/calc/evaluate";
  import { axisUnit } from "$lib/calc/format";
  import { math } from "$lib/calc/math";
  import Plot from "$lib/plot/Plot.svelte";
  import type { Unit } from "mathjs";
  import { inUnitOf, sweep, unitOf } from "./solve";
  import type { Formula, Variable } from "./types";

  let { formula, inputs, mode }: { formula: Formula; inputs: Record<string, string>; mode: AngleMode } = $props();

  const vars = $derived(formula.variables);
  let ySymbol = $state("");
  let xSymbol = $state("");
  let from = $state("");
  let to = $state("");

  $effect.pre(() => {
    void formula.id;
    ySymbol = vars[0].symbol;
    xSymbol = vars[1]?.symbol ?? "";
    from = to = "";
  });

  const isAngle = (v: Variable) => !!unitOf(v)?.equalBase(math.unit(1, "rad"));

  /** SI value of a range input; bare numbers for angles follow DEG/RAD. */
  function rangeValue(text: string, v: Variable): number {
    const q = evaluateInput(text, mode);
    if (typeof q.value === "number" && isAngle(v) && mode === "deg") return (q.value * Math.PI) / 180;
    return realSI(q).value;
  }

  function axis(v: Variable, sample: Unit | null) {
    if (isAngle(v)) return mode === "deg" ? { scale: 180 / Math.PI, unit: "°" } : { scale: 1, unit: "rad" };
    return axisUnit(sample);
  }

  const result = $derived.by(() => {
    const x = vars.find((v) => v.symbol === xSymbol);
    const y = vars.find((v) => v.symbol === ySymbol);
    if (!x || !y || x === y) return { error: "Pick two different variables" };
    if (!from.trim() || !to.trim()) return { error: `Enter a range for ${x.symbol}` };
    const known = new Map<string, Quantity>();
    for (const v of vars) {
      if (v === x || v === y) continue;
      if (!inputs[v.symbol]?.trim()) return { error: `Fill in ${v.symbol} above` };
      try {
        known.set(v.symbol, evaluateInput(inputs[v.symbol], mode));
      } catch (e) {
        return { error: `${v.symbol}: ${errorMessage(e)}` };
      }
    }
    try {
      const [a, b] = [rangeValue(from, x), rangeValue(to, x)];
      const data = sweep(formula, known, x, y, a, b, mode);
      const xSample = inUnitOf(x, Math.max(Math.abs(a), Math.abs(b)) || 1);
      const ax = axis(x, math.isUnit(xSample) ? (xSample as Unit) : null);
      const ay = axis(y, data.yUnit);
      return {
        series: [{ points: data.xs.map((xv, i) => [xv * ax.scale, data.ys[i] * ay.scale] as [number, number]) }],
        xLabel: ax.unit ? `${x.symbol} (${ax.unit})` : x.symbol,
        yLabel: ay.unit ? `${y.symbol} (${ay.unit})` : y.symbol,
      };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  });
</script>

<section class="mt-10">
  <h2 class="label">Explore</h2>
  <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
    <select class="field" bind:value={ySymbol} aria-label="Plot this variable">
      {#each vars as v (v.symbol)}<option value={v.symbol}>{v.symbol}</option>{/each}
    </select>
    <span class="text-muted">against</span>
    <select class="field" bind:value={xSymbol} aria-label="Against this variable">
      {#each vars as v (v.symbol)}<option value={v.symbol}>{v.symbol}</option>{/each}
    </select>
    <span class="text-muted">from</span>
    <input class="field w-32 font-mono" bind:value={from} placeholder="start" aria-label="Range start" />
    <span class="text-muted">to</span>
    <input class="field w-32 font-mono" bind:value={to} placeholder="end" aria-label="Range end" />
  </div>
  <p class="mt-2 text-xs text-muted">Uses the values above for the other variables.</p>
  <div class="mt-4">
    {#if "error" in result}
      <p class="text-sm text-muted">{result.error}</p>
    {:else}
      <Plot series={result.series} xLabel={result.xLabel} yLabel={result.yLabel} />
    {/if}
  </div>
</section>
