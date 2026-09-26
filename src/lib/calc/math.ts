import { create, all } from "mathjs";

export const math = create(all);

// Expanded while parsing rather than registered with createUnit: custom units join math.js's
// preferred-unit table and hijack simplification (seconds start displaying as hours).
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
  try {
    return math.Unit.isValuelessUnit(normalizeUnitName(name));
  } catch {
    return false;
  }
}
