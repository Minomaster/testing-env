import { create, all, type Complex, type Unit } from "mathjs";

export const math = create(all);

// The default "auto" system remembers the last unit parsed for each dimension, globally, and
// simplifies later results into it (after typing "500 nm", speeds display as nm/s). The fixed
// SI system keeps display independent of what was typed before.
math.Unit.setUnitSystem("si");

export type Scalar = number | Complex | Unit;

/** Fields math.js sets on Unit objects but doesn't declare in its types. */
export type UnitFlags = Unit & { skipAutomaticSimplification: boolean; fixPrefix: boolean };

// math.js overloads can't express "number | Complex | Unit in, same out", so its functions are loosened once here.
type Loose = (...args: unknown[]) => Scalar;
export const loose = (f: unknown) => f as Loose;
export const add = loose(math.add);
export const sub = loose(math.subtract);
export const pow = loose(math.pow);
export const neg = loose(math.unaryMinus);
export const absNumber = (v: unknown) => loose(math.abs)(v) as number;

/** Marks a unit as written by the user, so it is displayed as typed (km/h) rather than simplified (m/s). */
export function keepAsTyped<T>(value: T): T {
  if (math.isUnit(value)) (value as UnitFlags).skipAutomaticSimplification = true;
  return value;
}

function copyForm(result: Scalar, unit: unknown): Scalar {
  if (math.isUnit(result)) {
    (result as UnitFlags).skipAutomaticSimplification = (unit as UnitFlags).skipAutomaticSimplification;
    (result as UnitFlags).fixPrefix = (unit as UnitFlags).fixPrefix;
  }
  return result;
}

const looseMul = loose(math.multiply);
const looseDiv = loose(math.divide);

/** Scaling a unit by a plain number (3.0 km/h * 2) keeps the unit exactly as it was. */
export function mul(a: unknown, b: unknown): Scalar {
  const result = looseMul(a, b);
  if (math.isUnit(a) !== math.isUnit(b)) return copyForm(result, math.isUnit(a) ? a : b);
  return result;
}

export function div(a: unknown, b: unknown): Scalar {
  const result = looseDiv(a, b);
  return math.isUnit(a) && !math.isUnit(b) ? copyForm(result, a) : result;
}

export const UNIT_ALIASES: Record<string, string> = { mph: "mi/h", kph: "km/h", kmh: "km/h" };

// Accepts the symbols people actually type (Ω, µ, °) and maps them to math.js unit names.
export function normalizeUnitName(name: string): string {
  return name
    .replace(/Ω/g, "ohm")
    .replace(/^[µμ]/, "u")
    .replace(/°C/g, "degC")
    .replace(/°F/g, "degF")
    .replace(/°/g, "deg");
}

export function normalizeUnitExpr(expr: string): string {
  return expr
    .replace(/\b(mph|kph|kmh)\b/g, (alias) => `(${UNIT_ALIASES[alias]})`)
    .replace(/Ω/g, "ohm")
    .replace(/[µμ](?=\p{L})/gu, "u")
    .replace(/°C/g, "degC")
    .replace(/°F/g, "degF")
    .replace(/°/g, "deg")
    .replace(/[·×]/g, " ")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");
}

export function isUnitName(name: string): boolean {
  if (name in UNIT_ALIASES) return true;
  try {
    return math.Unit.isValuelessUnit(normalizeUnitName(name));
  } catch {
    return false;
  }
}

/** A unit of value 1, e.g. for "Ω" or "mph". Never registered with createUnit: custom units hijack simplification. */
export function unitNamed(name: string): Unit {
  return math.unit(1, UNIT_ALIASES[name] ?? normalizeUnitName(name));
}
