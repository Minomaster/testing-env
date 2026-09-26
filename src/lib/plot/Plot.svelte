<script lang="ts" module>
  export type Series = { label?: string; points: [number, number][]; dashed?: boolean };
</script>

<script lang="ts">
  import { formatReal } from "$lib/calc/format";

  let {
    series,
    xLabel = "",
    yLabel = "",
    height = 260,
  }: { series: Series[]; xLabel?: string; yLabel?: string; height?: number } = $props();

  const COLOURS = ["#7aa2f7", "#e0af68", "#9ece6a", "#f7768e", "#bb9af7", "#7dcfff"];
  const M = { left: 56, right: 12, top: 10, bottom: 34 };

  let width = $state(600);
  let view = $state<{ x0: number; x1: number; y0: number; y1: number } | null>(null);
  let cursor = $state<{ x: number; y: number } | null>(null);
  let drag: { px: number; py: number; v: NonNullable<typeof view> } | null = null;

  const auto = $derived.by(() => {
    const pts = series.flatMap((s) => s.points).filter(([x, y]) => isFinite(x) && isFinite(y));
    if (!pts.length) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of pts) [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
    if (y0 === y1) [y0, y1] = [y0 - Math.abs(y0 || 1) * 0.5, y1 + Math.abs(y1 || 1) * 0.5];
    const pad = (y1 - y0) * 0.06;
    return { x0, x1, y0: y0 - pad, y1: y1 + pad };
  });
  const v = $derived(view ?? auto);
  const plotW = $derived(Math.max(10, width - M.left - M.right));
  const plotH = $derived(height - M.top - M.bottom);
  const sx = (x: number) => M.left + ((x - v.x0) / (v.x1 - v.x0)) * plotW;
  const sy = (y: number) => M.top + (1 - (y - v.y0) / (v.y1 - v.y0)) * plotH;

  function ticks(a: number, b: number, target: number): number[] {
    const step0 = (b - a) / target;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
    const out: number[] = [];
    for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-9; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
    return out;
  }
  const xTicks = $derived(ticks(v.x0, v.x1, Math.max(2, Math.round(plotW / 90))));
  const yTicks = $derived(ticks(v.y0, v.y1, Math.max(2, Math.round(plotH / 50))));
  const label = (t: number) => formatReal(Number(t.toPrecision(10)), Infinity);

  function path(points: [number, number][]): string {
    let d = "";
    let pen = false;
    for (const [x, y] of points) {
      if (!isFinite(x) || !isFinite(y) || Math.abs(sy(y)) > 1e6) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
      pen = true;
    }
    return d;
  }

  const toData = (px: number, py: number) => ({
    x: v.x0 + ((px - M.left) / plotW) * (v.x1 - v.x0),
    y: v.y0 + (1 - (py - M.top) / plotH) * (v.y1 - v.y0),
  });

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const c = toData(e.clientX - rect.left, e.clientY - rect.top);
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    view = { x0: c.x + (v.x0 - c.x) * k, x1: c.x + (v.x1 - c.x) * k, y0: c.y + (v.y0 - c.y) * k, y1: c.y + (v.y1 - c.y) * k };
  }

  function onMove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const [px, py] = [e.clientX - rect.left, e.clientY - rect.top];
    cursor = toData(px, py);
    if (drag) {
      const dx = ((px - drag.px) / plotW) * (drag.v.x1 - drag.v.x0);
      const dy = ((py - drag.py) / plotH) * (drag.v.y1 - drag.v.y0);
      view = { x0: drag.v.x0 - dx, x1: drag.v.x1 - dx, y0: drag.v.y0 + dy, y1: drag.v.y1 + dy };
    }
  }
</script>

<div class="relative select-none" bind:clientWidth={width}>
  <svg
    {width}
    {height}
    class="block cursor-crosshair touch-none"
    role="img"
    aria-label={yLabel ? `Plot of ${yLabel} against ${xLabel}` : "Plot"}
    onwheel={onWheel}
    onpointerdown={(e) => {
      const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
      drag = { px: e.clientX - rect.left, py: e.clientY - rect.top, v: { ...v } };
      (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    }}
    onpointerup={() => (drag = null)}
    onpointermove={onMove}
    onpointerleave={() => (cursor = null)}
    ondblclick={() => (view = null)}
  >
    <defs>
      <clipPath id="plot-area-{M.left}"><rect x={M.left} y={M.top} width={plotW} height={plotH} /></clipPath>
    </defs>
    {#each xTicks as t (t)}
      <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + plotH} class="stroke-line" />
      <text x={sx(t)} y={height - M.bottom + 16} text-anchor="middle" class="fill-muted font-mono text-[10px]">{label(t)}</text>
    {/each}
    {#each yTicks as t (t)}
      <line x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} class="stroke-line" />
      <text x={M.left - 6} y={sy(t) + 3} text-anchor="end" class="fill-muted font-mono text-[10px]">{label(t)}</text>
    {/each}
    {#if v.y0 < 0 && v.y1 > 0}<line x1={M.left} x2={M.left + plotW} y1={sy(0)} y2={sy(0)} class="stroke-muted/50" />{/if}
    <g clip-path="url(#plot-area-{M.left})">
      {#each series as s, i (i)}
        <path d={path(s.points)} fill="none" stroke={COLOURS[i % COLOURS.length]} stroke-width="1.6" stroke-dasharray={s.dashed ? "4 4" : undefined} />
      {/each}
    </g>
    <text x={M.left + plotW / 2} y={height - 4} text-anchor="middle" class="fill-muted text-[11px]">{xLabel}</text>
    <text x="12" y={M.top + plotH / 2} text-anchor="middle" transform="rotate(-90 12 {M.top + plotH / 2})" class="fill-muted text-[11px]">{yLabel}</text>
  </svg>
  <div class="pointer-events-none absolute top-2 right-3 flex flex-col items-end gap-0.5 text-xs">
    {#each series as s, i (i)}
      {#if s.label}<span style="color:{COLOURS[i % COLOURS.length]}">{s.label}</span>{/if}
    {/each}
    {#if cursor}<span class="font-mono text-muted">{label(cursor.x)}, {label(cursor.y)}</span>{/if}
  </div>
</div>
