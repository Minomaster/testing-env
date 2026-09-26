<script lang="ts">
  const SECTIONS: { title: string; rows: [string, string][] }[] = [
    {
      title: "Basics",
      rows: [
        ["R = 220 Ω", "assign a variable"],
        ["tau = R C", "use it later; a space multiplies"],
        ["1 / 2 pi f", "= 1/(2πf): a space binds tighter than /"],
        ["ans * 2", "previous result"],
        ["# note", "comment / heading"],
      ],
    },
    {
      title: "Units",
      rows: [
        ["4.70 uF", "µ can be typed as u"],
        ["220 ohm", "or Ω"],
        ["9.81 m/s^2", "powers with ^ (or ²)"],
        ["120 mph to m/s", "convert (also ->)"],
        ["25 °C to K", "temperatures, degrees"],
      ],
    },
    {
      title: "Significant figures",
      rows: [
        ["2 * 3", "no unit = exact"],
        ["4.70 uF", "with a unit, every digit counts (3 s.f.)"],
      ],
    },
    {
      title: "Complex & phasors",
      rows: [
        ["3 + 4i", "i is the imaginary unit"],
        ["5.00 V ∠ 30", "polar; type < for ∠"],
        ["abs(z), arg(z)", "magnitude, angle"],
        ["re(z), im(z), conj(z)", "parts"],
      ],
    },
    {
      title: "Vectors",
      rows: [
        ["F = [3, 4, 0] N", "brackets"],
        ["dot(a, b), cross(a, b)", "products"],
        ["unit(a), angle(a, b), proj(a, b)", "direction, angle, projection"],
        ["F.x", "a component"],
      ],
    },
    {
      title: "Functions & constants",
      rows: [
        ["sqrt cbrt exp ln log log2", "log is base 10"],
        ["sin cos tan asin acos atan", "follow DEG/RAD"],
        ["sinh cosh tanh abs", ""],
        ["pi, e, c, h_P, hbar, q_e", "constants (h is hours)"],
        ["k_B, N_A, ε_0, µ_0, m_e, g_n", "more constants"],
      ],
    },
    {
      title: "Plots",
      rows: [
        ["plot sin(x) from 0 to 2 pi", "x is the default variable"],
        ["plot sin(x), cos(x) from 0 to 360", "several curves"],
        ["plot V_0 exp(-t / tau) for t from 0 s to 5 ms", "your own variable, with units"],
        ["", "scroll to zoom, drag to pan, double-click to reset"],
      ],
    },
  ];
</script>

<div class="px-5 py-5">
  {#each SECTIONS as s (s.title)}
    <h2 class="label mt-5 first:mt-0">{s.title}</h2>
    <dl class="mt-2 flex flex-col gap-1.5">
      {#each s.rows as [code, text], i (i)}
        <div>
          {#if code}<dt class="font-mono text-xs text-fg select-text">{code}</dt>{/if}
          {#if text}<dd class="text-xs text-muted">{text}</dd>{/if}
        </div>
      {/each}
    </dl>
  {/each}
</div>
