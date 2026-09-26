<script lang="ts">
  import type { Complex, Unit } from "mathjs";
  import { errorMessage, evaluateInput, type AngleMode } from "$lib/calc/evaluate";
  import { formatReal } from "$lib/calc/format";
  import { math } from "$lib/calc/math";
  import { analyse, type C } from "./smith";

  let { mode }: { mode: AngleMode } = $props();

  let zlText = $state("25 + 50i Ω");
  let z0Text = $state("50 Ω");

  /** Impedance input as a complex number of ohms (a bare number counts as ohms). */
  function ohms(text: string): C {
    // "25 + 50i Ω" means (25 + 50i) Ω, not 25 + (50i Ω).
    const trailing = text.match(/^(.*\S)\s+(Ω|ohm)\s*$/);
    const v = evaluateInput(trailing ? `(${trailing[1]}) ${trailing[2]}` : text, mode).value;
    const raw = math.isUnit(v)
      ? (() => {
          if (!(v as Unit).equalBase(math.unit(1, "ohm"))) throw new Error("Needs a unit of Ω");
          return (v as Unit).value as number | Complex;
        })()
      : v;
    if (typeof raw === "number") return { re: raw, im: 0 };
    if (math.isComplex(raw)) return { re: (raw as Complex).re, im: (raw as Complex).im };
    throw new Error("Needs an impedance");
  }

  const result = $derived.by(() => {
    try {
      const z0 = ohms(z0Text);
      if (z0.im !== 0 || z0.re <= 0) return { error: "Z₀ must be a positive real impedance" };
      return analyse(ohms(zlText), z0.re);
    } catch (e) {
      return { error: errorMessage(e) };
    }
  });

  const fmt = (x: number) => formatReal(x, 4);
  const angleText = (rad: number) => (mode === "deg" ? `${fmt((rad * 180) / Math.PI)}°` : `${fmt(rad)} rad`);

  const R = [0.2, 0.5, 1, 2, 5];
  const X = [0.2, 0.5, 1, 2, 5];
</script>

<section class="max-w-3xl px-10 py-8">
  <h1 class="text-lg font-medium">Smith chart</h1>

  <div class="mt-6 grid max-w-md grid-cols-[9rem_1fr] items-center gap-3">
    <span class="text-sm text-muted">Load Z_L</span>
    <input class="field font-mono" bind:value={zlText} placeholder="e.g. 25 + 50i Ω" aria-label="Load impedance" />
    <span class="text-sm text-muted">Line Z₀</span>
    <input class="field font-mono" bind:value={z0Text} placeholder="e.g. 50 Ω" aria-label="Characteristic impedance" />
  </div>

  <div class="mt-6 flex flex-wrap items-start gap-8">
    <svg viewBox="-1.12 -1.12 2.24 2.24" class="h-80 w-80 shrink-0" role="img" aria-label="Smith chart">
      <defs><clipPath id="smith-clip"><circle r="1" /></clipPath></defs>
      <g clip-path="url(#smith-clip)" fill="none" stroke-width="0.006" class="stroke-line">
        {#each R as r (r)}<circle cx={r / (1 + r)} cy="0" r={1 / (1 + r)} />{/each}
        {#each X as x (x)}
          <circle cx="1" cy={-1 / x} r={1 / x} />
          <circle cx="1" cy={1 / x} r={1 / x} />
        {/each}
        <line x1="-1" x2="1" y1="0" y2="0" />
      </g>
      <circle r="1" fill="none" stroke-width="0.008" class="stroke-muted" />
      {#each R as r (r)}
        <text x={(r - 1) / (r + 1) + 0.01} y="-0.02" class="fill-muted" font-size="0.05">{r}</text>
      {/each}
      {#if !("error" in result) && result.mag <= 1}
        <circle r={result.mag} fill="none" stroke-width="0.006" stroke-dasharray="0.03 0.03" class="stroke-accent/60" />
        <line x1="0" y1="0" x2={result.gamma.re} y2={-result.gamma.im} stroke-width="0.008" class="stroke-accent" />
        <circle cx={result.gamma.re} cy={-result.gamma.im} r="0.03" class="fill-accent" />
      {/if}
    </svg>

    {#if "error" in result}
      <p class="text-sm text-muted">{result.error}</p>
    {:else}
      <dl class="grid grid-cols-[7rem_1fr] gap-y-2 font-mono text-sm">
        <dt class="text-muted">Γ</dt>
        <dd>{fmt(result.mag)}∠{angleText(result.angle)}</dd>
        <dt class="text-muted">z = Z_L/Z₀</dt>
        <dd>{fmt(result.z.re)} {result.z.im < 0 ? "-" : "+"} {fmt(Math.abs(result.z.im))}i</dd>
        <dt class="text-muted">VSWR</dt>
        <dd>{isFinite(result.vswr) ? fmt(result.vswr) : "∞"}</dd>
        <dt class="text-muted">Return loss</dt>
        <dd>{isFinite(result.returnLoss) ? `${fmt(result.returnLoss)} dB` : "∞ (matched)"}</dd>
      </dl>
    {/if}
  </div>
  <p class="mt-4 text-xs text-muted">Dashed circle: constant VSWR. Circles along the axis: constant resistance; arcs: constant reactance.</p>
</section>
