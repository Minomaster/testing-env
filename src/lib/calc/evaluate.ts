import type { Complex, Unit } from "mathjs";
import { math, isUnitName, normalizeUnitExpr, normalizeUnitName } from "./math";
import { CalcError, FUNCTION_NAMES, parseLine, type Node } from "./parse";

export type Value = number | Complex | Unit;
/** `sf` is the number of significant figures; Infinity means the value is exact. */
export type Quantity = { value: Value; sf: number };
export type AngleMode = "deg" | "rad";

export type LineResult =
  | { kind: "empty" }
  | { kind: "comment" }
  | { kind: "value"; quantity: Quantity; name?: string }
  | { kind: "error"; message: string };

// math.js overloads can't express "number | Complex | Unit in, same out", so its functions are loosened once here.
type Loose = (...args: unknown[]) => Value;
const loose = (f: unknown) => f as Loose;
const add = loose(math.add);
const sub = loose(math.subtract);
const mul = loose(math.multiply);
const div = loose(math.divide);
const pow = loose(math.pow);
const neg = loose(math.unaryMinus);
const absValue = (v: unknown) => loose(math.abs)(v) as number;

const CONSTANTS: Record<string, Value> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  i: math.complex(0, 1),
};

const RESERVED = new Set([...Object.keys(CONSTANTS), ...FUNCTION_NAMES, "ans", "to"]);

type Context = { vars: Map<string, Quantity>; ans?: Quantity; mode: AngleMode };

export function exponent10(x: number): number {
  return x === 0 ? 0 : Number(Math.abs(x).toExponential().split("e")[1]);
}

/** Magnitude in SI base units (math.js stores Unit values in SI internally). */
export function magnitudeSI(v: Value): number {
  if (typeof v === "number") return Math.abs(v);
  if (math.isComplex(v)) return absValue(v);
  const inner = (v as Unit).value as number | Complex | null;
  if (inner === null) return 1;
  return typeof inner === "number" ? Math.abs(inner) : absValue(inner);
}

function lastPlace(q: Quantity): number {
  if (!isFinite(q.sf)) return 0;
  return 10 ** (exponent10(magnitudeSI(q.value)) - q.sf + 1);
}

function exact(value: Value): Quantity {
  return { value, sf: Infinity };
}

function resolvesToUnit(name: string, ctx: Context): boolean {
  return !ctx.vars.has(name) && !(name in CONSTANTS) && name !== "ans" && isUnitName(name);
}

function resolveName(name: string, ctx: Context): Quantity {
  const variable = ctx.vars.get(name);
  if (variable) return variable;
  if (name === "ans") {
    if (!ctx.ans) throw new CalcError("No previous result for ans");
    return ctx.ans;
  }
  if (name in CONSTANTS) return exact(CONSTANTS[name]);
  if (isUnitName(name)) return exact(math.unit(1, normalizeUnitName(name)));
  throw new CalcError(`Unknown name "${name}"`);
}

function isUnitExpr(node: Node, ctx: Context): boolean {
  switch (node.type) {
    case "name":
      return resolvesToUnit(node.name, ctx);
    case "pow":
      return isUnitExpr(node.base, ctx);
    case "bin":
      return (node.op === "*" || node.op === "/") && isUnitExpr(node.left, ctx) && isUnitExpr(node.right, ctx);
    case "implicit":
      return node.factors.every((f) => isUnitExpr(f, ctx));
    default:
      return false;
  }
}

function toRadians(v: Value, mode: AngleMode): number {
  if (math.isUnit(v)) return (v as Unit).toNumber("rad");
  if (typeof v !== "number") throw new CalcError("Angle must be a real number");
  return mode === "deg" ? (v * Math.PI) / 180 : v;
}

function trigInput(v: Value, mode: AngleMode): Value {
  if (math.isUnit(v) || mode === "rad") return v;
  return mul(v, Math.PI / 180);
}

function angleOutput(v: Value, mode: AngleMode): Value {
  if (typeof v === "number" && mode === "deg") return math.unit((v * 180) / Math.PI, "deg");
  return v;
}

function cleanTiny(v: Value): Value {
  return typeof v === "number" && Math.abs(v) < 1e-15 ? 0 : v;
}

function logSigFigs(input: Quantity, result: Value): number {
  if (!isFinite(input.sf)) return Infinity;
  return Math.max(1, exponent10(magnitudeSI(result)) + input.sf + 1);
}

type Fn = (arg: Quantity, mode: AngleMode) => Quantity;
const same = (f: unknown): Fn => (q) => ({ value: loose(f)(q.value), sf: q.sf });
const logFn = (f: unknown): Fn => (q) => {
  const value = loose(f)(q.value);
  return { value, sf: logSigFigs(q, value) };
};
const trig = (f: unknown): Fn => (q, mode) => ({
  value: cleanTiny(loose(f)(trigInput(q.value, mode))),
  sf: q.sf,
});
const inverseTrig = (f: unknown): Fn => (q, mode) => ({
  value: angleOutput(loose(f)(q.value), mode),
  sf: q.sf,
});

const FUNCTIONS: Record<string, Fn> = {
  sqrt: same(math.sqrt),
  cbrt: same(math.cbrt),
  abs: same(math.abs),
  re: same(math.re),
  im: same(math.im),
  conj: same(math.conj),
  exp: same(math.exp),
  sinh: same(math.sinh),
  cosh: same(math.cosh),
  tanh: same(math.tanh),
  ln: logFn(math.log),
  log: logFn(math.log10),
  log2: logFn(math.log2),
  sin: trig(math.sin),
  cos: trig(math.cos),
  tan: trig(math.tan),
  asin: inverseTrig(math.asin),
  acos: inverseTrig(math.acos),
  atan: inverseTrig(math.atan),
  arg: inverseTrig((v: Value) => math.arg((math.isUnit(v) ? (v as Unit).value : v) as Complex)),
};

function addSub(a: Quantity, b: Quantity, op: "+" | "-"): Quantity {
  const value = op === "+" ? add(a.value, b.value) : sub(a.value, b.value);
  if (!isFinite(a.sf) && !isFinite(b.sf)) return exact(value);
  const place = Math.max(lastPlace(a), lastPlace(b));
  const mag = magnitudeSI(value);
  const sf = mag === 0 ? 1 : exponent10(mag) - Math.round(Math.log10(place)) + 1;
  return { value, sf: Math.max(1, sf) };
}

function evalNode(node: Node, ctx: Context): Quantity {
  switch (node.type) {
    case "num":
      return exact(node.value);
    case "name":
      return resolveName(node.name, ctx);
    case "neg": {
      const q = evalNode(node.arg, ctx);
      return { value: neg(q.value), sf: q.sf };
    }
    case "bin": {
      const a = evalNode(node.left, ctx);
      const b = evalNode(node.right, ctx);
      if (node.op === "+" || node.op === "-") return addSub(a, b, node.op);
      const value = node.op === "*" ? mul(a.value, b.value) : div(a.value, b.value);
      return { value, sf: Math.min(a.sf, b.sf) };
    }
    case "pow": {
      const base = evalNode(node.base, ctx);
      const exp = evalNode(node.exp, ctx);
      return { value: pow(base.value, exp.value), sf: isFinite(exp.sf) ? Math.min(base.sf, exp.sf) : base.sf };
    }
    case "implicit": {
      let result: Quantity | undefined;
      node.factors.forEach((factor, i) => {
        const next = node.factors[i + 1];
        // A number written directly before a unit is a measurement: all its digits are significant.
        const q =
          factor.type === "num" && next && isUnitExpr(next, ctx)
            ? { value: factor.value, sf: factor.digits }
            : evalNode(factor, ctx);
        result = result ? { value: mul(result.value, q.value), sf: Math.min(result.sf, q.sf) } : q;
      });
      return result!;
    }
    case "polar": {
      const mag = evalNode(node.mag, ctx);
      const angle = evalNode(node.angle, ctx);
      const unitPhasor = math.complex({ r: 1, phi: toRadians(angle.value, ctx.mode) });
      return { value: mul(mag.value, unitPhasor), sf: Math.min(mag.sf, angle.sf) };
    }
    case "call": {
      if (node.args.length !== 1) throw new CalcError(`${node.fn}() takes one value`);
      return FUNCTIONS[node.fn](evalNode(node.args[0], ctx), ctx.mode);
    }
  }
}

function convert(q: Quantity, target: string, mode: AngleMode): Quantity {
  const unitExpr = normalizeUnitExpr(target);
  let value = q.value;
  if (!math.isUnit(value)) {
    const isAngleTarget = math.unit(1, unitExpr).equalBase(math.unit(1, "rad"));
    if (typeof value !== "number" || !isAngleTarget) throw new CalcError("Nothing to convert: the value has no unit");
    value = math.unit(value, mode);
  }
  return { value: (value as Unit).to(unitExpr), sf: q.sf };
}

function evaluateLine(src: string, ctx: Context): LineResult {
  const line = parseLine(src);
  if (line.kind !== "expr") return line;
  if (line.assign && RESERVED.has(line.assign)) throw new CalcError(`"${line.assign}" is reserved`);

  let quantity = evalNode(line.expr, ctx);
  if (line.convertTo) quantity = convert(quantity, line.convertTo, ctx.mode);
  if (typeof quantity.value === "number" && isNaN(quantity.value)) throw new CalcError("Result is undefined");

  if (line.assign) ctx.vars.set(line.assign, quantity);
  ctx.ans = quantity;
  return { kind: "value", quantity, name: line.assign };
}

function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/Units do not match/i.test(message)) return "Units don't match";
  return message.replace(/\.$/, "");
}

export function evaluateSheet(text: string, mode: AngleMode): LineResult[] {
  const ctx: Context = { vars: new Map(), mode };
  return text.split("\n").map((src) => {
    try {
      return evaluateLine(src, ctx);
    } catch (e) {
      return { kind: "error", message: errorMessage(e) };
    }
  });
}
