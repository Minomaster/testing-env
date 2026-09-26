import type { Complex, Unit } from "mathjs";
import { math, isUnitName } from "./math";
import { exponent10, magnitudeSI, type AngleMode, type Quantity } from "./evaluate";

/** Exact values (no measured inputs) are shown with at most this many significant digits. */
const EXACT_DIGITS = 6;

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const superscript = (s: string) => [...s].map((c) => SUPERSCRIPT[c] ?? c).join("");

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function formatReal(x: number, sf: number): string {
  if (!isFinite(x)) return isNaN(x) ? "NaN" : x > 0 ? "∞" : "-∞";
  if (x === 0) return "0";
  const isExact = !isFinite(sf);
  const digits = isExact ? EXACT_DIGITS : sf;
  const sign = x < 0 ? "-" : "";
  const [mantissa, expText] = Math.abs(x).toExponential(digits - 1).split("e");
  const exp = Number(expText);
  // Scientific notation whenever plain digits would need non-significant trailing zeros.
  if (exp >= digits || exp < -4) {
    return `${sign}${isExact ? stripZeros(mantissa) : mantissa} × 10${superscript(String(exp))}`;
  }
  const fixed = Math.abs(x).toPrecision(digits);
  return sign + (isExact ? stripZeros(fixed) : fixed);
}

function prettyUnitWord(word: string): string {
  if (word === "deg") return "°";
  if (word === "degC") return "°C";
  if (word === "degF") return "°F";
  const ohm = word.match(/^(\w*?)ohm$/);
  if (ohm) return (ohm[1] === "u" ? "µ" : ohm[1]) + "Ω";
  if (word.length > 1 && word[0] === "u" && isUnitName(word) && isUnitName(word.slice(1))) return "µ" + word.slice(1);
  return word;
}

export function prettyUnit(units: string): string {
  return units
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bmi\/h\b/g, "mph")
    .replace(/[A-Za-z]+/g, prettyUnitWord)
    .replace(/\^(-?\d+)/g, (_, d: string) => superscript(d))
    .replace(/ /g, "·");
}

function withUnit(number: string, unit: string): string {
  if (!unit) return number;
  return unit === "°" ? number + unit : `${number} ${unit}`;
}

/** Scale from SI to the displayed unit, plus that unit, as chosen by math.js (simplified, best prefix). */
function displayUnit(u: Unit): { scale: number; unit: string } {
  const si = magnitudeSI(u);
  const magnitude = math.abs(u as never) as unknown as Unit;
  if (si === 0) return { scale: 1, unit: prettyUnit(magnitude.formatUnits()) };
  const text = magnitude.format({ precision: 15 });
  const space = text.indexOf(" ");
  return { scale: Number(text.slice(0, space)) / si, unit: prettyUnit(text.slice(space + 1)) };
}

function formatAngle(radians: number, sf: number, mode: AngleMode): string {
  return mode === "deg" ? formatReal((radians * 180) / Math.PI, sf) + "°" : formatReal(radians, sf) + " rad";
}

function formatComplex(z: Complex, sf: number, unit: string, mode: AngleMode): string {
  const mag = Math.hypot(z.re, z.im);
  const digits = isFinite(sf) ? sf : EXACT_DIGITS;
  const place = 10 ** (exponent10(mag) - digits + 1);
  const negligible = (x: number) => Math.abs(x) < place / 2;
  if (negligible(z.im)) return withUnit(formatReal(z.re, sf), unit);

  const part = (x: number) => {
    if (exponent10(mag) >= digits || exponent10(mag) < -4) return formatReal(x, sf);
    const text = place < 1 ? x.toFixed(Math.round(-Math.log10(place))) : String(Math.round(x / place) * place);
    return isFinite(sf) ? text : stripZeros(text);
  };
  const rect = negligible(z.re)
    ? `${part(z.im)}i`
    : `${part(z.re)} ${z.im < 0 ? "-" : "+"} ${part(Math.abs(z.im))}i`;
  const rectWithUnit = unit ? (negligible(z.re) ? `${rect} ${unit}` : `(${rect}) ${unit}`) : rect;
  const polar = `${formatReal(mag, sf)}∠${formatAngle(Math.atan2(z.im, z.re), sf, mode)}${unit ? " " + unit : ""}`;
  return `${rectWithUnit} · ${polar}`;
}

export function formatQuantity(q: Quantity, mode: AngleMode): string {
  const { value, sf } = q;
  if (typeof value === "number") return formatReal(value, sf);
  if (math.isComplex(value)) return formatComplex(value, sf, "", mode);
  const u = value as Unit;
  const { scale, unit } = displayUnit(u);
  const inner = u.value as number | Complex;
  if (typeof inner === "number") return withUnit(formatReal(inner * scale, sf), unit);
  return formatComplex(math.complex(inner.re * scale, inner.im * scale), sf, unit, mode);
}
