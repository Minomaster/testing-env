/** Calculator expressions for the combine and impedance tools; each input is wrapped in brackets. */
const wrap = (v: string) => `(${v})`;

export type Component = "resistor" | "inductor" | "capacitor";

function sum(values: string[]): string {
  return values.map(wrap).join(" + ");
}

function reciprocalSum(values: string[]): string {
  return `1 / (${values.map((v) => `1 / ${wrap(v)}`).join(" + ")})`;
}

/** Capacitors combine the opposite way round to resistors and inductors. */
export function combineExpr(kind: Component, values: string[], how: "series" | "parallel"): string {
  const additive = (how === "series") !== (kind === "capacitor");
  return additive ? sum(values) : reciprocalSum(values);
}

/** Z = R + jωL + 1/(jωC); blank parts are left out (no capacitor, not a short). */
export function impedanceExpr(r: string, l: string, c: string, f: string): string {
  const parts: string[] = [];
  if (r.trim()) parts.push(wrap(r));
  if (l.trim()) parts.push(`2 pi ${wrap(f)} ${wrap(l)} i`);
  if (c.trim()) parts.push(`1 / (2 pi ${wrap(f)} ${wrap(c)} i)`);
  return parts.join(" + ");
}
