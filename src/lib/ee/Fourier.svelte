<script lang="ts">
  import Plot from "$lib/plot/Plot.svelte";
  import { amplitudes, partialSum, target, type Wave } from "./fourier";

  let wave = $state<Wave>("square");
  let n = $state(7);
  let duty = $state(0.25);

  const T = Array.from({ length: 801 }, (_, i) => -1 + (2 * i) / 800);
  const series = $derived([
    { label: "target", dashed: true, points: T.map((t) => [t, target(wave, t, duty)] as [number, number]) },
    { label: `sum to n = ${n}`, points: T.map((t) => [t, partialSum(wave, t, n, duty)] as [number, number]) },
  ]);
  const amps = $derived(amplitudes(wave, n, duty));
  const maxAmp = $derived(Math.max(...amps, 1e-9));
</script>

<section class="max-w-3xl px-10 py-8">
  <h1 class="text-lg font-medium">Fourier series</h1>

  <div class="mt-6 flex flex-wrap items-center gap-4">
    <div role="group" aria-label="Waveform" class="flex rounded-md border border-line p-0.5 text-xs">
      {#each ["square", "triangle", "sawtooth", "pulse"] as w (w)}
        <button
          class={["rounded px-2.5 py-1 capitalize", wave === w ? "bg-raised text-fg" : "text-muted hover:text-fg"]}
          aria-pressed={wave === w}
          onclick={() => (wave = w as Wave)}>{w}</button
        >
      {/each}
    </div>
    <label class="flex items-center gap-2 text-sm text-muted">
      harmonics up to
      <input type="range" min="1" max="60" bind:value={n} class="accent-accent" />
      <span class="w-6 font-mono text-fg">{n}</span>
    </label>
    {#if wave === "pulse"}
      <label class="flex items-center gap-2 text-sm text-muted">
        duty
        <input type="range" min="0.05" max="0.95" step="0.05" bind:value={duty} class="accent-accent" />
        <span class="w-10 font-mono text-fg">{Math.round(duty * 100)}%</span>
      </label>
    {/if}
  </div>

  <div class="mt-6"><Plot {series} xLabel="t (periods)" yLabel="amplitude" /></div>

  <h2 class="label mt-6">Harmonic amplitudes</h2>
  <svg class="mt-2 block w-full" viewBox="0 0 600 90" preserveAspectRatio="none" role="img" aria-label="Harmonic amplitudes">
    {#each amps as a, i (i)}
      {@const w = 600 / amps.length}
      <rect x={i * w + w * 0.15} y={86 - (a / maxAmp) * 80} width={w * 0.7} height={(a / maxAmp) * 80} class="fill-accent" />
    {/each}
    <line x1="0" x2="600" y1="86" y2="86" class="stroke-line" />
  </svg>
  <p class="mt-1 font-mono text-xs text-muted">k = 1 … {n}</p>
</section>
