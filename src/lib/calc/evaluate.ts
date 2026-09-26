import type { Complex, Unit } from "mathjs";
import { absNumber, add, alignAngles, div,isUnitName, keepAsTyped, loose, math, mul, neg, normalizeUnitExpr, pow, sub, unitNamed, type Scalar } from "./math";
import { PHYSICAL_CONSTANTS } from "./constants";
import { CalcError, FUNCTION_NAMES, parseExpression, parseLine, type Node } from "./parse";
import {
  Vector, addVectors, angleBetween, convertVector, cross, dot, isVector, magnitude, negate, project, scale, unitVector, vectorFrom,
} from "./vector";

export type Value = Scalar | Vector;
/**
 * `sf` is the number of significant figures (for a vector: relative to its magnitude);
 * Infinity means the value is exact.
 */
export type Quantity = { value: Value; sf: number };
export type AngleMode = "deg" | "rad";

export type LineResult =
  | { kind: "empty" }
  | { kind: "comment" }
  | { kind: "value"; quantity: Quantity; name?: string }
  | { kind: "error"; message: string };

const CONSTANTS: Record<string, Scalar> = {
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
  if (isVector(v)) return Math.hypot(...v.components.map(magnitudeSI));
  if (typeof v === "number") return Math.abs(v);
  if (math.isComplex(v)) return absNumber(v);
  const inner = (v as Unit).value as number | Complex | null;
  if (inner === null) return 1;
  return typeof inner === "number" ? Math.abs(inner) : absNumber(inner);
}

function lastPlace(q: Quantity): number {
  if (!isFinite(q.sf)) return 0;
  return 10 ** (exponent10(magnitudeSI(q.value)) - q.sf + 1);
}

/** Significant figures of `value` when its least significant digit sits at `place`. */
function sfAtPlace(value: Value, place: number): number {
  const mag = magnitudeSI(value);
  return mag === 0 ? 1 : Math.max(1, exponent10(mag) - Math.round(Math.log10(place)) + 1);
}

function exact(value: Value): Quantity {
  return { value, sf: Infinity };
}

function scalarOf(q: Quantity, what: string): Scalar {
  if (isVector(q.value)) throw new CalcError(`${what} doesn't take a vector`);
  return q.value;
}

function resolvesToUnit(name: string, ctx: Context): boolean {
  return (
    !ctx.vars.has(name) && !(name in CONSTANTS) && !(name in PHYSICAL_CONSTANTS) && name !== "ans" && isUnitName(name)
  );
}

function resolveName(name: string, ctx: Context): Quantity {
  const variable = ctx.vars.get(name);
  if (variable) return variable;
  if (name === "ans") {
    if (!ctx.ans) throw new CalcError("No previous result for ans");
    return ctx.ans;
  }
  if (name in CONSTANTS) return exact(CONSTANTS[name]);
  if (name in PHYSICAL_CONSTANTS) return exact(PHYSICAL_CONSTANTS[name]);
  if (isUnitName(name)) return exact(unitNamed(name));
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

/** Keeps units the user spelled out (4.7 µF, 9.81 m/s², [3, 4] N) as typed instead of simplifying them. */
function asTyped(q: Quantity): Quantity {
  if (isVector(q.value)) q.value.components.forEach(keepAsTyped);
  else keepAsTyped(q.value);
  return q;
}

/** Digit count of a plain numeric literal (optionally negated), or undefined for anything else. */
function literal(node: Node): { value: number; digits: number } | undefined {
  if (node.type === "num") return node;
  if (node.type === "neg" && node.arg.type === "num") return { value: -node.arg.value, digits: node.arg.digits };
  return undefined;
}

function toRadians(v: Value, mode: AngleMode): number {
  if (math.isUnit(v)) return (v as Unit).toNumber("rad");
  if (typeof v !== "number") throw new CalcError("Angle must be a real number");
  return mode === "deg" ? (v * Math.PI) / 180 : v;
}

function trigInput(v: Scalar, mode: AngleMode): Scalar {
  if (math.isUnit(v) || mode === "rad") return v;
  return mul(v, Math.PI / 180);
}

function angleOutput(v: Scalar, mode: AngleMode): Scalar {
  if (typeof v === "number" && mode === "deg") return math.unit((v * 180) / Math.PI, "deg");
  return v;
}

function cleanTiny(v: Scalar): Scalar {
  return typeof v === "number" && Math.abs(v) < 1e-15 ? 0 : v;
}

function logSigFigs(inputSf: number, result: Scalar): number {
  if (!isFinite(inputSf)) return Infinity;
  return Math.max(1, exponent10(magnitudeSI(result)) + inputSf + 1);
}

type Fn = (arg: Scalar, sf: number, mode: AngleMode) => Quantity;
const same = (f: unknown): Fn => (v, sf) => ({ value: loose(f)(v), sf });
const logFn = (f: unknown): Fn => (v, sf) => {
  const value = loose(f)(v);
  return { value, sf: logSigFigs(sf, value) };
};
const trig = (f: unknown): Fn => (v, sf, mode) => ({ value: cleanTiny(loose(f)(trigInput(v, mode))), sf });
const inverseTrig = (f: unknown): Fn => (v, sf, mode) => ({ value: angleOutput(loose(f)(v), mode), sf });

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
  arg: inverseTrig((v: Scalar) => math.arg((math.isUnit(v) ? (v as Unit).value : v) as Complex)),
};

type VectorFn = (args: Vector[], sf: number, mode: AngleMode) => Quantity;
const VECTOR_FUNCTIONS: Record<string, { count: number; fn: VectorFn }> = {
  dot: { count: 2, fn: ([a, b], sf) => ({ value: dot(a, b), sf }) },
  cross: { count: 2, fn: ([a, b], sf) => ({ value: cross(a, b), sf }) },
  unit: { count: 1, fn: ([a], sf) => ({ value: unitVector(a), sf }) },
  angle: { count: 2, fn: ([a, b], sf, mode) => ({ value: angleOutput(angleBetween(a, b), mode), sf }) },
  proj: { count: 2, fn: ([a, b], sf) => ({ value: project(a, b), sf }) },
};

function callFunction(name: string, args: Quantity[], mode: AngleMode): Quantity {
  const sf = Math.min(...args.map((a) => a.sf));
  const vectorFn = VECTOR_FUNCTIONS[name];
  if (vectorFn) {
    if (args.length !== vectorFn.count || !args.every((a) => isVector(a.value))) {
      throw new CalcError(`${name}() takes ${vectorFn.count === 1 ? "a vector" : `${vectorFn.count} vectors`}`);
    }
    return vectorFn.fn(args.map((a) => a.value as Vector), sf, mode);
  }
  if (args.length !== 1) throw new CalcError(`${name}() takes one value`);
  const [arg] = args;
  if (name === "abs" && isVector(arg.value)) return { value: magnitude(arg.value), sf };
  return FUNCTIONS[name](scalarOf(arg, `${name}()`), sf, mode);
}

function addSub(a: Quantity, b: Quantity, op: "+" | "-"): Quantity {
  let value: Value;
  if (isVector(a.value) && isVector(b.value)) value = addVectors(a.value, b.value, op);
  else if (isVector(a.value) || isVector(b.value)) throw new CalcError(`Can't ${op === "+" ? "add" : "subtract"} a vector and a number`);
  else {
    const [x, y] = alignAngles(a.value, b.value);
    value = op === "+" ? add(x, y) : sub(x, y);
  }

  if (!isFinite(a.sf) && !isFinite(b.sf)) return exact(value);
  return { value, sf: sfAtPlace(value, Math.max(lastPlace(a), lastPlace(b))) };
}

function multiply(a: Quantity, b: Quantity, op: "*" | "/"): Quantity {
  const sf = Math.min(a.sf, b.sf);
  const [x, y] = [a.value, b.value];
  if (isVector(x) && isVector(y)) throw new CalcError("Use dot() or cross() to multiply vectors");
  if (isVector(y)) {
    if (op === "/") throw new CalcError("Can't divide by a vector");
    return { value: scale(y, x as Scalar), sf };
  }
  if (isVector(x)) return { value: scale(x, y as Scalar, op === "/"), sf };
  return { value: op === "*" ? mul(x, y) : div(x, y), sf };
}

/** A vector literal's precision is its least precise non-zero component (zeros are written as plain 0). */
function evalVector(node: Extract<Node, { type: "vector" }>, ctx: Context, measured: boolean): Quantity {
  const items = node.items.map((item) => {
    const lit = measured ? literal(item) : undefined;
    return lit ? { value: lit.value, sf: lit.digits } : evalNode(item, ctx);
  });
  const vector = vectorFrom(items.map((q) => scalarOf(q, "A vector component")));
  const places = items.filter((q) => isFinite(q.sf) && magnitudeSI(q.value) !== 0).map(lastPlace);
  return places.length ? { value: vector, sf: sfAtPlace(vector, Math.max(...places)) } : exact(vector);
}

function evalNode(node: Node, ctx: Context): Quantity {
  switch (node.type) {
    case "num":
      return exact(node.value);
    case "name":
      return resolveName(node.name, ctx);
    case "neg": {
      const q = evalNode(node.arg, ctx);
      return { value: isVector(q.value) ? negate(q.value) : neg(q.value), sf: q.sf };
    }
    case "bin": {
      const a = evalNode(node.left, ctx);
      const b = evalNode(node.right, ctx);
      if (node.op === "+" || node.op === "-") return addSub(a, b, node.op);
      const q = multiply(a, b, node.op);
      const spellsUnit = isUnitExpr(node.right, ctx) || (node.op === "*" && isUnitExpr(node.left, ctx));
      return spellsUnit ? asTyped(q) : q;
    }
    case "pow": {
      const base = evalNode(node.base, ctx);
      const exp = evalNode(node.exp, ctx);
      const value = pow(scalarOf(base, "^"), scalarOf(exp, "^"));
      return { value, sf: isFinite(exp.sf) ? Math.min(base.sf, exp.sf) : base.sf };
    }
    case "implicit": {
      let result: Quantity | undefined;
      node.factors.forEach((factor, i) => {
        const next = node.factors[i + 1];
        // A number (or vector of numbers) written directly before a unit is a measurement:
        // all its digits are significant.
        const measured = next !== undefined && isUnitExpr(next, ctx);
        const q =
          factor.type === "num" && measured
            ? { value: factor.value, sf: factor.digits }
            : factor.type === "vector"
              ? evalVector(factor, ctx, measured)
              : evalNode(factor, ctx);
        if (!result) result = q;
        else result = i > 0 && isUnitExpr(factor, ctx) ? asTyped(multiply(result, q, "*")) : multiply(result, q, "*");
      });
      return result!;
    }
    case "polar": {
      const mag = evalNode(node.mag, ctx);
      const angle = evalNode(node.angle, ctx);
      const unitPhasor = math.complex({ r: 1, phi: toRadians(scalarOf(angle, "∠"), ctx.mode) });
      return { value: mul(scalarOf(mag, "∠"), unitPhasor), sf: Math.min(mag.sf, angle.sf) };
    }
    case "vector":
      return evalVector(node, ctx, false);
    case "component": {
      const q = evalNode(node.base, ctx);
      if (!isVector(q.value)) throw new CalcError(`.${node.axis} only works on vectors`);
      const index = "xyz".indexOf(node.axis);
      if (index >= q.value.length) throw new CalcError(`This vector has no ${node.axis} component`);
      const value = q.value.components[index];
      return { value, sf: isFinite(q.sf) ? sfAtPlace(value, lastPlace(q)) : Infinity };
    }
    case "call":
      return callFunction(node.fn, node.args.map((arg) => evalNode(arg, ctx)), ctx.mode);
  }
}

function convert(q: Quantity, target: string, mode: AngleMode): Quantity {
  const unitExpr = normalizeUnitExpr(target);
  let value = q.value;
  if (isVector(value)) return { value: convertVector(value, unitExpr), sf: q.sf };
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

export function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/Units do not match/i.test(message)) return "Units don't match";
  return message.replace(/\.$/, "");
}

/** Evaluates a parsed expression with the given variables (used by the formula solver). */
export function evaluateNode(node: Node, vars: Map<string, Quantity>, mode: AngleMode): Quantity {
  return evalNode(node, { vars, mode });
}

/** Evaluates a single input such as "25.0 mA" or "q_e"; throws CalcError on bad input. */
export function evaluateInput(src: string, mode: AngleMode): Quantity {
  return evalNode(parseExpression(src), { vars: new Map(), mode });
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
