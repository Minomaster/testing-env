import type { Unit } from "mathjs";
import { evaluateInput, evaluateNode, errorMessage, type AngleMode, type Quantity } from "$lib/calc/evaluate";
import { math, mul, normalizeUnitExpr, sameDimensionIgnoringAngle, type Scalar } from "$lib/calc/math";
import { CalcError, parseExpression, type Node } from "$lib/calc/parse";
import { isVector } from "$lib/calc/vector";
import type { Formula, Variable } from "./types";

class UnitMismatch extends CalcError {}
const isUnitMismatch = (e: unknown) => e instanceof UnitMismatch || errorMessage(e) === "Units don't match";

type Sides = { lhs: Node; rhs: Node };
const compiled = new Map<string, Sides>();

export function compile(expr: string): Sides {
  let sides = compiled.get(expr);
  if (!sides) {
    const parts = expr.split("=");
    if (parts.length !== 2) throw new CalcError("A formula needs exactly one =");
    sides = { lhs: parseExpression(parts[0]), rhs: parseExpression(parts[1]) };
    compiled.set(expr, sides);
  }
  return sides;
}

export function unitOf(variable: Variable): Unit | null {
  return variable.unit ? math.unit(1, normalizeUnitExpr(variable.unit)) : null;
}

/** Signed SI value; angles count as dimensionless (radians). */
function siValue(q: Quantity): { value: number; unit: Unit | null } {
  const v = q.value;
  if (isVector(v)) throw new CalcError("Vectors can't be used in the solver");
  if (typeof v === "number") return { value: v, unit: null };
  if (math.isComplex(v)) throw new CalcError("The solver works with real numbers only");
  const u = v as Unit;
  if (u.equalBase(math.unit(1, "rad"))) return { value: u.toNumber("rad"), unit: null };
  if (typeof u.value !== "number") throw new CalcError("The solver works with real numbers only");
  return { value: u.value, unit: u };
}

const sameDimension = (a: Unit | null, b: Unit | null) => sameDimensionIgnoringAngle(a, b);

/**
 * Sample points spanning ±10^-40 … 10^40; positive ones first, since most quantities are positive.
 * Offset slightly so samples never land exactly on special values like 1 (ln 1 = 0).
 */
const SCAN = (() => {
  const positive = Array.from({ length: 161 }, (_, k) => 10 ** ((k - 80) / 2 + 0.0137));
  return [positive, positive.map((x) => -x)];
})();

function findRoot(g: (x: number) => { diff: number; scale: number }): number | null {
  const residualOk = (x: number) => {
    const { diff, scale } = g(x);
    return Math.abs(diff) <= 1e-9 * Math.max(scale, Number.MIN_VALUE);
  };
  const usable = (d: number | null): d is number => d !== null && isFinite(d);
  if (tryDiff(g, 0) === 0) return 0;
  for (const xs of SCAN) {
    const ds = xs.map((x) => tryDiff(g, x));

    // 1. A sign change between neighbouring samples brackets a root.
    for (let i = 0; i < xs.length; i++) {
      const d = ds[i];
      if (d === 0) return xs[i];
      const prev = ds[i - 1];
      if (i > 0 && usable(d) && usable(prev) && Math.sign(d) !== Math.sign(prev)) {
        const root = bisect(g, xs[i - 1], xs[i], prev);
        if (root !== null && residualOk(root)) return root;
      }
    }

    // 2. A root can sit just inside a domain edge (e.g. before a square root goes negative):
    //    find the edge between a valid and an invalid sample and look for a sign change there.
    for (let i = 1; i < xs.length; i++) {
      const [prev, d] = [ds[i - 1], ds[i]];
      if (usable(prev) === usable(d)) continue;
      const [inside, outside, dInside] = usable(prev) ? [xs[i - 1], xs[i], prev] : [xs[i], xs[i - 1], d as number];
      const edge = domainEdge(g, inside, outside);
      const dEdge = tryDiff(g, edge);
      if (usable(dEdge) && Math.sign(dEdge) !== Math.sign(dInside)) {
        const root = bisect(g, inside, edge, dInside);
        if (root !== null && residualOk(root)) return root;
      }
    }

    // 3. Two close roots can hide between samples: zoom in where |g| has a local minimum.
    const dips = xs
      .map((_, i) => i)
      .filter((i) => {
        const [a, b, c] = [ds[i - 1], ds[i], ds[i + 1]];
        return usable(a) && usable(b) && usable(c) && Math.abs(b) <= Math.abs(a) && Math.abs(b) <= Math.abs(c);
      })
      .sort((i, j) => Math.abs(ds[i]!) - Math.abs(ds[j]!));
    for (const i of dips) {
      const flip = findSignFlip(g, xs[i - 1], xs[i + 1], Math.sign(ds[i]!));
      if (flip === null) continue;
      const root = bisect(g, xs[i], flip, ds[i]!);
      if (root !== null && residualOk(root)) return root;
    }
  }
  return null;
}

/** The last point on the `inside` side where g can still be evaluated. */
function domainEdge(g: (x: number) => { diff: number }, inside: number, outside: number): number {
  for (let k = 0; k < 100; k++) {
    const m = (inside + outside) / 2;
    if (m === inside || m === outside) break;
    const d = tryDiff(g, m);
    if (d !== null && isFinite(d)) inside = m;
    else outside = m;
  }
  return inside;
}

/** Golden-section search for a point in [a, b] where g has the opposite sign to `sign`. */
function findSignFlip(g: (x: number) => { diff: number }, a: number, b: number, sign: number): number | null {
  const ratio = (Math.sqrt(5) - 1) / 2;
  const h = (x: number) => {
    const d = tryDiff(g, x);
    return d === null || !isFinite(d) ? Infinity : sign * d;
  };
  let c = b - ratio * (b - a);
  let d = a + ratio * (b - a);
  let hc = h(c);
  let hd = h(d);
  for (let k = 0; k < 80; k++) {
    if (hc < 0) return c;
    if (hd < 0) return d;
    if (hc < hd) {
      b = d;
      d = c;
      hd = hc;
      c = b - ratio * (b - a);
      hc = h(c);
    } else {
      a = c;
      c = d;
      hc = hd;
      d = a + ratio * (b - a);
      hd = h(d);
    }
  }
  return null;
}

function tryDiff(g: (x: number) => { diff: number }, x: number): number | null {
  try {
    return g(x).diff;
  } catch (e) {
    if (isUnitMismatch(e)) throw e;
    return null;
  }
}

function bisect(g: (x: number) => { diff: number }, a: number, b: number, da: number): number | null {
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    if (m === a || m === b) return m;
    const dm = tryDiff(g, m);
    if (dm === null || !isFinite(dm)) return null;
    if (dm === 0) return m;
    if (Math.sign(dm) === Math.sign(da)) {
      a = m;
      da = dm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

/** Null if both sides of the formula have the same dimensions when every variable is 1 of its unit. */
export function dimensionError(formula: Formula): string | null {
  if (!formula.expr) return null;
  try {
    const { lhs, rhs } = compile(formula.expr);
    const vars = new Map<string, Quantity>(
      formula.variables.map((v) => [v.symbol, { value: unitOf(v) ?? 1, sf: Infinity }]),
    );
    const l = siValue(evaluateNode(lhs, vars, "rad"));
    const r = siValue(evaluateNode(rhs, vars, "rad"));
    if (sameDimension(l.unit, r.unit)) return null;
    const describe = (u: Unit | null) => (u ? u.toSI().formatUnits() : "dimensionless");
    return `left side is ${describe(l.unit)}, right side is ${describe(r.unit)}`;
  } catch (e) {
    return errorMessage(e);
  }
}

function presentAngle(value: Scalar, mode: AngleMode): Scalar {
  if (!math.isUnit(value) || !(value as Unit).equalBase(math.unit(1, "rad"))) return value;
  return (value as Unit).to(mode === "deg" ? "deg" : "rad");
}

export type SolveResult ={ symbol: string; quantity: Quantity } | { error: string };

/** Solves for the single variable whose input is blank. */
export function solve(formula: Formula, inputs: Record<string, string>, mode: AngleMode): SolveResult {
  if (!formula.expr) return { error: "This formula is reference-only" };
  const blanks = formula.variables.filter((v) => !inputs[v.symbol]?.trim());
  if (blanks.length !== 1) {
    return { error: blanks.length === 0 ? "Clear one field to solve for it" : "Leave exactly one field blank" };
  }
  const unknown = blanks[0];

  const known = new Map<string, Quantity>();
  for (const v of formula.variables) {
    if (v === unknown) continue;
    try {
      known.set(v.symbol, evaluateInput(inputs[v.symbol], mode));
    } catch (e) {
      return { error: `${v.symbol}: ${errorMessage(e)}` };
    }
  }

  try {
    const { lhs, rhs } = compile(formula.expr);
    const base = unitOf(unknown);
    const make = (x: number): Scalar => (base ? mul(x, base) : x);
    const vars = new Map(known);
    let checked = false;

    const g = (x: number) => {
      vars.set(unknown.symbol, { value: make(x), sf: Infinity });
      const l = siValue(evaluateNode(lhs, vars, mode));
      const r = siValue(evaluateNode(rhs, vars, mode));
      if (!checked) {
        if (!sameDimension(l.unit, r.unit)) throw new UnitMismatch("Units don't match: check the units of your inputs");
        checked = true;
      }
      return { diff: l.value - r.value, scale: Math.abs(l.value) + Math.abs(r.value) };
    };

    const root = findRoot(g);
    if (root === null || !isFinite(root)) return { error: "No real solution found for these values" };
    const sf = Math.min(...[...known.values()].map((q) => q.sf));
    return { symbol: unknown.symbol, quantity: { value: presentAngle(make(root), mode), sf } };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
