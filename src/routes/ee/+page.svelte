<script lang="ts">
  import "katex/dist/katex.min.css";
  import { onMount } from "svelte";
  import type { AngleMode } from "$lib/calc/evaluate";
  import { readSettings } from "$lib/dataFiles";
  import ColourCode from "$lib/ee/ColourCode.svelte";
  import Combine from "$lib/ee/Combine.svelte";
  import Impedance from "$lib/ee/Impedance.svelte";
  import Fourier from "$lib/ee/Fourier.svelte";
  import Smith from "$lib/ee/Smith.svelte";
  import FormulaDetail from "$lib/formulas/FormulaDetail.svelte";
  import { library, loadLibrary } from "$lib/formulas/library.svelte";

  // Tools backed by built-in formulas reuse the formula solve panel.
  const TOOLS = [
    { id: "colour", name: "Resistor colour code" },
    { id: "combine", name: "Series & parallel (R, L, C)" },
    { id: "impedance", name: "Series RLC impedance" },
    { id: "smith", name: "Smith chart" },
    { id: "fourier", name: "Fourier series" },
    { id: "dc-circuits/ohm-s-law", name: "Ohm's law" },
    { id: "dc-circuits/electrical-power", name: "Power" },
    { id: "dc-circuits/voltage-divider", name: "Voltage divider" },
    { id: "dc-circuits/current-divider", name: "Current divider" },
    { id: "dc-circuits/rc-time-constant", name: "RC time constant" },
    { id: "dc-circuits/rl-time-constant", name: "RL time constant" },
    { id: "ac-circuits/rc-low-pass-high-pass-cutoff", name: "RC cutoff frequency" },
    { id: "ac-circuits/rl-cutoff-frequency", name: "RL cutoff frequency" },
    { id: "ac-circuits/resonant-frequency", name: "LC resonant frequency" },
    { id: "ac-circuits/capacitive-reactance", name: "Capacitive reactance" },
    { id: "ac-circuits/inductive-reactance", name: "Inductive reactance" },
    { id: "signals-systems/power-ratio-in-decibels", name: "dB (power ratio)" },
    { id: "signals-systems/voltage-ratio-in-decibels", name: "dB (voltage ratio)" },
    { id: "signals-systems/power-in-dbm", name: "dBm" },
    { id: "electronics/led-series-resistor", name: "LED series resistor" },
  ];

  let selected = $state(TOOLS[0].id);
  let mode = $state<AngleMode>("deg");
  let loaded = $state(false);

  const formula = $derived(library.formulas.find((f) => f.id === selected));

  onMount(async () => {
    const [, settings] = await Promise.all([loadLibrary(), readSettings()]);
    mode = settings.calculator?.angleMode ?? "deg";
    loaded = true;
  });
</script>

{#if loaded}
  <div class="flex h-full">
    <ul class="w-64 shrink-0 overflow-y-auto border-r border-line py-2">
      {#each TOOLS as tool (tool.id)}
        <li>
          <button
            class={[
              "w-full px-4 py-2 text-left text-sm transition-colors duration-100",
              selected === tool.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
            ]}
            onclick={() => (selected = tool.id)}>{tool.name}</button
          >
        </li>
      {/each}
    </ul>
    <div class="min-w-0 flex-1 overflow-y-auto">
      {#if selected === "colour"}<ColourCode />
      {:else if selected === "combine"}<Combine />
      {:else if selected === "impedance"}<Impedance {mode} />
      {:else if selected === "smith"}<Smith {mode} />
      {:else if selected === "fourier"}<Fourier />
      {:else if formula}<FormulaDetail {formula} {mode} />{/if}
    </div>
  </div>
{/if}
