import katex from "katex";
import type { Unit } from "mathjs";
import { describe, expect, it } from "vitest";
import { math } from "$lib/calc/math";
import { BUILTIN_FORMULAS, parseFormulaFile } from "./builtin";
import { dimensionError, solve } from "./solve";
import type { Formula } from "./types";

const solvable = BUILTIN_FORMULAS.filter((f) => f.expr);

/** A distinct, well-behaved test value for the k-th variable, in its declared unit. */
const testValue = (k: number) => 0.37 + 0.11 * k;
const asInput = (value: number, unit: string) => (unit ? `${value} ${unit}` : `${value}`);

/** Formulas whose physics needs realistic magnitudes (e.g. exp(−E/kT)) for the round trip. */
const TEST_VALUES: Record<string, Record<string, number>> = {
  "statistical-mechanics/boltzmann-factor-population-ratio": { ΔE: 0.05, T: 300 },
  "statistical-mechanics/fermi-dirac-distribution": { E: 0.55, μ: 0.5, T: 300 },
  "statistical-mechanics/bose-einstein-distribution": { E: 0.06, μ: 0.01, T: 300 },
  "statistical-mechanics/planck-s-law-spectral-radiance": { λ: 500e-9, T: 5800 },
  "special-relativity/relativistic-kinetic-energy": { v: 1.5e8 },
  "quantum-atomic-physics/particle-in-a-1d-box": { m: 9.109e-31, L: 1e-9 },
  "quantum-atomic-physics/tunnelling-probability-thick-barrier": { L: 1e-10, m: 9.109e-31, V_0: 5, E: 1 },
  "solid-state-semiconductors/shockley-diode-equation": { I_S: 1e-12, V_D: 0.6, n: 1, T: 300 },
  "solid-state-semiconductors/intrinsic-carrier-concentration": { N_c: 2.8e25, N_v: 1.04e25, E_g: 1.12, T: 300 },
  "solid-state-semiconductors/carrier-concentration-from-the-fermi-level": { n_i: 1e16, ΔE_F: 0.2, T: 300 },
  "solid-state-semiconductors/built-in-potential-of-a-pn-junction": { T: 300, N_A: 1e23, N_D: 1e22, n_i: 1e16 },
};

function testValueFor(f: Formula, symbol: string, k: number): number {
  return TEST_VALUES[f.id]?.[symbol] ?? testValue(k);
}

function inDeclaredUnit(formula: Formula, symbol: string, value: unknown): number {
  const unit = formula.variables.find((v) => v.symbol === symbol)!.unit;
  if (typeof value === "number") return value;
  const u = value as Unit;
  return u.equalBase(math.unit(1, "rad")) && !unit ? u.toNumber("rad") : u.toNumber(unit.replace(/Ω/g, "ohm"));
}

describe("built-in formula files", () => {
  it("parse with unique ids", () => {
    const ids = BUILTIN_FORMULAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all render with KaTeX", () => {
    for (const f of BUILTIN_FORMULAS) {
      expect(f.latex, f.id).not.toBe("");
      expect(() => katex.renderToString(f.latex, { throwOnError: true, strict: false }), f.id).not.toThrow();
    }
  });

  it("list every variable of a solvable formula, and only those", () => {
    for (const f of solvable) {
      const names = new Set(f.expr!.match(/[\p{L}_][\p{L}\p{Nd}_]*/gu));
      for (const v of f.variables) expect(names.has(v.symbol), `${f.id}: ${v.symbol} not in expr`).toBe(true);
      expect(f.variables.length, f.id).toBeGreaterThan(0);
    }
  });

  it("keep each denominator to one term or bracket (a / b c means a / (b c))", () => {
    const group = String.raw`\((?:[^()]|\([^()]*\))*\)`;
    const term = String.raw`(?:${group}|[\p{L}]+${group}|[\p{L}\d_.]+(?:\^(?:[\p{L}\d_.]+|${group}))?)`;
    const hiddenFactor = new RegExp(String.raw`\/\s*${term}\s+[\p{L}\d(]`, "u");
    for (const f of solvable) expect(f.expr!, f.id).not.toMatch(hiddenFactor);
  });

  it("have matching units on both sides", () => {
    for (const f of solvable) expect(dimensionError(f), f.id).toBeNull();
  });

  it("can be solved for every variable (round trip)", () => {
    for (const f of solvable) {
      const [first, ...rest] = f.variables;
      const inputs: Record<string, string> = { [first.symbol]: "" };
      rest.forEach((v, k) => (inputs[v.symbol] = asInput(testValueFor(f, v.symbol, k), v.unit)));
      const base = solve(f, inputs, "rad");
      if ("error" in base) throw new Error(`${f.id}: solving ${first.symbol}: ${base.error}`);
      const firstValue = inDeclaredUnit(f, first.symbol, base.quantity.value);
      inputs[first.symbol] = asInput(firstValue, first.unit);

      rest.forEach((v, k) => {
        const result = solve(f, { ...inputs, [v.symbol]: "" }, "rad");
        if ("error" in result) throw new Error(`${f.id}: solving ${v.symbol}: ${result.error}`);
        const got = inDeclaredUnit(f, v.symbol, result.quantity.value);
        if (Math.abs(got / testValueFor(f, v.symbol, k) - 1) < 1e-5) return;
        // A different root (e.g. of a quadratic) is fine if it independently reproduces the first variable.
        const check = solve(f, { ...inputs, [v.symbol]: asInput(got, v.unit), [first.symbol]: "" }, "rad");
        if ("error" in check) throw new Error(`${f.id}: alternative root for ${v.symbol}: ${check.error}`);
        expect(inDeclaredUnit(f, first.symbol, check.quantity.value) / firstValue, `${f.id}: ${v.symbol}`).toBeCloseTo(1, 5);
      });
    }
  });
});

describe("formula file parser", () => {
  it("reads categories, variables, tags and notes", () => {
    const [f] = parseFormulaFile(
      "@category Test\n\n= Ohm's law\nlatex: V = IR\nexpr: V = I R\nv: V | V | voltage\nv: I | A | current\nv: R | Ω | resistance\ntags: circuit, resistor\nnote: hi",
      "test.txt",
    );
    expect(f).toEqual({
      id: "test/ohm-s-law",
      name: "Ohm's law",
      category: "Test",
      latex: "V = IR",
      expr: "V = I R",
      variables: [
        { symbol: "V", unit: "V", description: "voltage" },
        { symbol: "I", unit: "A", description: "current" },
        { symbol: "R", unit: "Ω", description: "resistance" },
      ],
      tags: ["circuit", "resistor"],
      note: "hi",
    });
  });

  it("reports the file and line of mistakes", () => {
    expect(() => parseFormulaFile("@category X\n= A\nbogus: 1", "x.txt")).toThrow("x.txt:3");
  });
});

describe("solver", () => {
  const ohm = parseFormulaFile("@category T\n= Ohm\nlatex: V=IR\nexpr: V = I R\nv: V | V | voltage\nv: I | A | current\nv: R | Ω | resistance", "t")[0];

  it("solves for the blank field with sig figs from the inputs", async () => {
    const { formatQuantity } = await import("$lib/calc/format");
    const r = solve(ohm, { V: "", I: "25.0 mA", R: "220 Ω" }, "deg");
    if ("error" in r) throw new Error(r.error);
    expect(formatQuantity(r.quantity, "deg")).toBe("5.50 V");
    const r2 = solve(ohm, { V: "5.50 V", I: "", R: "220 Ω" }, "deg");
    if ("error" in r2) throw new Error(r2.error);
    expect(formatQuantity(r2.quantity, "deg")).toBe("25.0 mA");
  });

  it("explains what's wrong", () => {
    expect(solve(ohm, { V: "", I: "", R: "220 Ω" }, "deg")).toEqual({ error: "Leave exactly one field blank" });
    expect(solve(ohm, { V: "1 V", I: "1 A", R: "1 Ω" }, "deg")).toEqual({ error: "Clear one field to solve for it" });
    expect(solve(ohm, { V: "", I: "2 s", R: "220 Ω" }, "deg")).toEqual({ error: "Units don't match: check the units of your inputs" });
    expect(solve(ohm, { V: "", I: "oops +", R: "220 Ω" }, "deg")).toEqual({ error: "I: Incomplete expression" });
  });
});
