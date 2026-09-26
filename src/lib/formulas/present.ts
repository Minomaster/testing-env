import katex from "katex";
import { prettyUnit } from "$lib/calc/format";
import type { Formula } from "./types";

export function renderLatex(latex: string, displayMode = false): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false, strict: false });
}

/** Calculator names to LaTeX: v_max → v_{max}, ω stays ω. */
export function symbolLatex(symbol: string): string {
  const [base, ...sub] = symbol.split("_");
  return sub.length ? `${base}_{${sub.join("\\_")}}` : base;
}

export function unitText(unit: string): string {
  return unit ? prettyUnit(unit) : "—";
}

export function obsidianMarkdown(f: Formula): string {
  const lines = [`**${f.name}**`, "", `$$${f.latex}$$`];
  if (f.variables.length) {
    lines.push("");
    for (const v of f.variables) lines.push(`- $${symbolLatex(v.symbol)}$: ${v.description}${v.unit ? ` (${unitText(v.unit)})` : ""}`);
  }
  if (f.note) lines.push("", f.note);
  return lines.join("\n") + "\n";
}

/** Scratchpad lines for a formula: known values as assignments, then the equation. */
export function scratchpadLines(f: Formula, inputs: Record<string, string>, solved?: { symbol: string; text: string }): string[] {
  const lines = [`# ${f.name}`];
  const [lhs] = (f.expr ?? "").split("=").map((s) => s.trim());
  const explicit = f.variables.find((v) => v.symbol === lhs);
  for (const v of f.variables) {
    if (v === explicit) continue;
    const value = solved?.symbol === v.symbol ? solved.text : (inputs[v.symbol]?.trim() ?? "");
    lines.push(`${v.symbol} = ${value}`);
  }
  if (explicit) lines.push(f.expr!);
  else if (f.expr) lines.push(`# ${f.expr}`);
  return lines;
}
