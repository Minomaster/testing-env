<script lang="ts">
  import type { PlotData } from "$lib/calc/evaluate";
  import { axisUnit } from "$lib/calc/format";
  import Plot from "./Plot.svelte";

  let { plot }: { plot: PlotData } = $props();

  const x = $derived(axisUnit(plot.xUnit));
  const y = $derived(axisUnit(plot.yUnit));
  const series = $derived(
    plot.curves.map((c) => ({
      label: plot.curves.length > 1 ? c.label : undefined,
      points: plot.xs.map((xv, i) => [xv * x.scale, c.ys[i] * y.scale] as [number, number]),
    })),
  );
  const withUnit = (name: string, unit: string) => (unit ? `${name} (${unit})` : name);
</script>

<Plot {series} xLabel={withUnit(plot.variable, x.unit)} yLabel={withUnit(plot.curves.length === 1 ? plot.curves[0].label : "", y.unit)} />
