<script lang="ts">
  import type { Unit } from "mathjs";
  import { errorMessage, evaluateInput } from "$lib/calc/evaluate";
  import { formatQuantity } from "$lib/calc/format";
  import { math } from "$lib/calc/math";
  import { COLOURS, bandRoles, coloursFor, decode, encode, type BandCount } from "./colourCode";

  let count = $state<BandCount>(4);
  let bands = $state(["yellow", "violet", "red", "gold"]);
  let valueText = $state("");
  let encodeError = $state<string | null>(null);

  const roles = $derived(bandRoles(count));
  const decoded = $derived(decode(bands));
  const hex = (name: string) => COLOURS.find((c) => c.name === name)!.hex;

  function setCount(n: BandCount) {
    const defaults = { 4: ["yellow", "violet", "red", "gold"], 5: ["yellow", "violet", "black", "brown", "brown"], 6: ["yellow", "violet", "black", "brown", "brown", "brown"] };
    count = n;
    bands = defaults[n];
  }

  function applyValue() {
    encodeError = null;
    if (!valueText.trim()) return;
    try {
      const q = evaluateInput(valueText, "deg").value;
      const ohms = math.isUnit(q) ? (q as Unit).toNumber("ohm") : (q as number);
      const coded = encode(ohms, count === 4 ? 2 : 3);
      if (!coded) {
        encodeError = `Can't be shown exactly with ${count} bands`;
        return;
      }
      bands = [...coded, ...bands.slice(coded.length)];
    } catch (e) {
      encodeError = errorMessage(e);
    }
  }

  const ohmsText = $derived(formatQuantity({ value: math.unit(decoded.ohms, "ohm"), sf: Infinity }, "deg"));
</script>

<section class="max-w-3xl px-10 py-8">
  <h1 class="text-lg font-medium">Resistor colour code</h1>

  <div class="mt-6 flex items-center gap-3">
    <div role="group" aria-label="Number of bands" class="flex rounded-md border border-line p-0.5 font-mono text-xs">
      {#each [4, 5, 6] as n (n)}
        <button
          class={["rounded px-2.5 py-1", count === n ? "bg-raised text-fg" : "text-muted hover:text-fg"]}
          aria-pressed={count === n}
          onclick={() => setCount(n as BandCount)}>{n} bands</button
        >
      {/each}
    </div>
  </div>

  <div class="mt-8 flex items-center justify-center">
    <div class="h-1 w-12 bg-muted/60"></div>
    <div class="flex h-14 items-stretch gap-3 rounded-full bg-[#c8b48a] px-6">
      {#each bands as b, i (i)}
        <div class={["w-3", i === roles.length - (count === 6 ? 2 : 1) && "ml-4"]} style="background:{hex(b)}"></div>
      {/each}
    </div>
    <div class="h-1 w-12 bg-muted/60"></div>
  </div>

  <p class="mt-6 text-center font-mono text-xl">
    {ohmsText} <span class="text-muted">±{decoded.tolerance}%</span>
    {#if decoded.tempco !== undefined}<span class="text-sm text-muted"> · {decoded.tempco} ppm/K</span>{/if}
  </p>

  <div class="mt-8 grid gap-3" style="grid-template-columns: repeat({count}, minmax(0, 1fr))">
    {#each roles as role, i (i)}
      <label class="flex flex-col gap-1.5">
        <span class="label">{role === "digit" ? `Digit ${i + 1}` : role}</span>
        <select class="field" bind:value={bands[i]}>
          {#each coloursFor(role) as c (c.name)}<option value={c.name}>{c.name}</option>{/each}
        </select>
      </label>
    {/each}
  </div>

  <form class="mt-8 flex items-center gap-3" onsubmit={(e) => (e.preventDefault(), applyValue())}>
    <input class="field w-56 font-mono" bind:value={valueText} placeholder="value, e.g. 4.7 kΩ" aria-label="Resistance to encode" />
    <button class="btn btn-sm" type="submit">Show bands</button>
    {#if encodeError}<span class="text-sm text-muted">{encodeError}</span>{/if}
  </form>
</section>
