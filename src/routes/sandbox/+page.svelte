<script lang="ts">
  import { onMount } from "svelte";
  import {
    circularVelocity, collide, heaviest, makeBody, orbitOf, predict, preset, recordTrails, step, totals,
    type Body, type Preset,
  } from "$lib/sandbox/orbits";

  const DT = 0.05;
  const SUBSTEPS = 8;
  const VELOCITY_PER_PX = 0.03;
  const MASS = { small: 1, medium: 5, large: 20, star: 1500 } as const;
  type Size = keyof typeof MASS;

  let canvas = $state<HTMLCanvasElement>();
  let running = $state(true);
  let speed = $state(1);
  let size = $state<Size>("medium");
  let circular = $state(false);
  let zoom = $state(1);
  let hud = $state({ count: 0, energy: 0, angular: 0, orbit: "" });

  // Simulation state lives outside Svelte's reactivity: it changes every frame.
  let bodies: Body[] = preset("solar");
  let tracked: Body | null = bodies[4];
  let drag: { x: number; y: number; mx: number; my: number } | null = null;
  let preview: number[] = [];
  let stars: [number, number, number][] = [];
  let [w, h] = [0, 0];

  const toScreen = (x: number, y: number): [number, number] => [w / 2 + x * zoom, h / 2 + y * zoom];
  const toWorld = (sx: number, sy: number): [number, number] => [(sx - w / 2) / zoom, (sy - h / 2) / zoom];

  function load(name: Preset) {
    bodies = preset(name);
    tracked = name === "solar" ? bodies[4] : name === "binary" ? bodies[2] : null;
    zoom = 1;
  }

  function launchVelocity(x: number, y: number, mx: number, my: number): [number, number] {
    const host = heaviest(bodies);
    if (circular && host) return circularVelocity(x, y, host);
    return [(mx - x) * VELOCITY_PER_PX, (my - y) * VELOCITY_PER_PX];
  }

  function pointer(e: PointerEvent): [number, number] {
    const rect = canvas!.getBoundingClientRect();
    return toWorld(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onDown(e: PointerEvent) {
    const [x, y] = pointer(e);
    const hit = bodies.find((b) => Math.hypot(b.x - x, b.y - y) < b.r + 6 / zoom);
    if (hit) {
      tracked = hit;
      return;
    }
    drag = { x, y, mx: x, my: y };
    canvas!.setPointerCapture(e.pointerId);
    updatePreview();
  }

  function onMove(e: PointerEvent) {
    if (!drag) return;
    [drag.mx, drag.my] = pointer(e);
    updatePreview();
  }

  function onUp() {
    if (!drag) return;
    const [vx, vy] = launchVelocity(drag.x, drag.y, drag.mx, drag.my);
    const body = makeBody(drag.x, drag.y, vx, vy, MASS[size], size === "star");
    bodies.push(body);
    tracked = body;
    drag = null;
    preview = [];
  }

  function updatePreview() {
    if (!drag) return;
    const [vx, vy] = launchVelocity(drag.x, drag.y, drag.mx, drag.my);
    preview = predict(bodies, makeBody(drag.x, drag.y, vx, vy, MASS[size], size === "star"), 900, DT * 2);
  }

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#0e1014";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    for (const [x, y, a] of stars) {
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    for (const b of bodies) {
      if (b.trail.length < 4) continue;
      ctx.strokeStyle = `hsla(${b.hue}, 70%, 65%, 0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < b.trail.length; i += 2) {
        const [sx, sy] = toScreen(b.trail[i], b.trail[i + 1]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    if (preview.length > 2) {
      ctx.strokeStyle = "rgba(122, 162, 247, 0.7)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (let i = 0; i < preview.length; i += 2) {
        const [sx, sy] = toScreen(preview[i], preview[i + 1]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const b of bodies) {
      const [sx, sy] = toScreen(b.x, b.y);
      const r = Math.max(1.5, b.r * zoom);
      if (b.star) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
        glow.addColorStop(0, `hsla(${b.hue}, 100%, 85%, 0.9)`);
        glow.addColorStop(0.3, `hsla(${b.hue}, 95%, 60%, 0.35)`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = `hsl(${b.hue}, 100%, 92%)`;
      } else {
        ctx.fillStyle = `hsl(${b.hue}, 65%, 62%)`;
      }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 2 * Math.PI);
      ctx.fill();
      if (b === tracked) {
        ctx.strokeStyle = "rgba(227, 230, 237, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 5, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    if (drag && !circular) {
      const [ax, ay] = toScreen(drag.x, drag.y);
      const [bx, by] = toScreen(drag.mx, drag.my);
      ctx.strokeStyle = "#7aa2f7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  function updateHud() {
    const t = totals(bodies);
    const host = heaviest(bodies.filter((b) => b !== tracked));
    let orbit = "";
    if (tracked && host && bodies.includes(tracked)) {
      const o = orbitOf(tracked, host);
      orbit = o.bound
        ? `a = ${o.a.toFixed(0)} · e = ${o.e.toFixed(3)} · T = ${o.period!.toFixed(0)} t`
        : `escaping · e = ${o.e.toFixed(2)}`;
    }
    hud = { count: bodies.length, energy: t.energy, angular: t.angularMomentum, orbit };
  }

  onMount(() => {
    const ctx = canvas!.getContext("2d")!;
    const resize = () => {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      [w, h] = [rect.width, rect.height];
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 2500) }, () => [Math.random() * w, Math.random() * h, 0.1 + Math.random() * 0.35]);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas!.parentElement!);
    resize();

    let frame = 0;
    let raf = requestAnimationFrame(function tick() {
      if (running) {
        const n = Math.max(1, Math.round(SUBSTEPS * speed));
        for (let i = 0; i < n; i++) {
          step(bodies, DT);
          if (collide(bodies) && tracked && !bodies.includes(tracked)) tracked = null;
        }
        recordTrails(bodies);
      }
      draw(ctx);
      if (frame++ % 10 === 0) updateHud();
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  });
</script>

<div class="flex h-full flex-col">
  <header class="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3 text-sm">
    <h1 class="mr-2 font-medium">Orbit sandbox</h1>
    <button class="btn btn-sm w-16" onclick={() => (running = !running)}>{running ? "Pause" : "Play"}</button>
    <select class="field py-1" bind:value={speed} aria-label="Speed">
      {#each [0.25, 0.5, 1, 2, 4] as s (s)}<option value={s}>{s}×</option>{/each}
    </select>
    <span class="text-muted">launch</span>
    <select class="field py-1" bind:value={size} aria-label="Size of the next body">
      {#each Object.keys(MASS) as s (s)}<option value={s}>{s}</option>{/each}
    </select>
    <label class="flex items-center gap-1.5 text-muted"><input type="checkbox" bind:checked={circular} class="accent-accent" /> circular orbit</label>
    <span class="ml-auto flex gap-2">
      <button class="btn btn-sm" onclick={() => load("solar")}>Solar system</button>
      <button class="btn btn-sm" onclick={() => load("binary")}>Binary stars</button>
      <button class="btn btn-sm" onclick={() => load("figure8")}>Figure-eight</button>
      <button class="btn btn-sm" onclick={() => ((bodies = []), (tracked = null))}>Clear</button>
    </span>
  </header>

  <div class="relative min-h-0 flex-1 overflow-hidden">
    <canvas
      bind:this={canvas}
      class="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onwheel={(e) => {
        e.preventDefault();
        zoom = Math.min(5, Math.max(0.1, zoom * (e.deltaY > 0 ? 1 / 1.15 : 1.15)));
      }}
    ></canvas>
    <p class="pointer-events-none absolute top-3 left-4 text-xs text-muted">
      Drag to launch (direction and length = velocity) · click a body to follow its orbit · scroll to zoom
    </p>
    <div class="pointer-events-none absolute bottom-3 left-4 font-mono text-xs text-muted">
      {hud.count} bodies · energy {hud.energy.toPrecision(5)} · angular momentum {hud.angular.toPrecision(5)}
    </div>
    {#if hud.orbit}
      <div class="pointer-events-none absolute right-4 bottom-3 font-mono text-xs text-fg">{hud.orbit}</div>
    {/if}
  </div>
</div>
