import type { Complex, Unit } from "mathjs";
import { math, isUnitName } from "./math";
import { exponent10, magnitudeSI, type AngleMode, type Quantity } from "./evaluate";
import { isVector, magnitude, siComponents, type Vector } from "./vector";

/** Exact values (no measured inputs) are shown with at most this many significant digits. */
const EXACT_DIGITS = 6;

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const superscript = (s: string) => [...s].map((c) => SUPERSCRIPT[c] ?? c).join("");

const digitsFor = (sf: number) => (isFinite(sf) ? sf : EXACT_DIGITS);

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Scientific notation is needed when plain digits would show non-significant trailing zeros. */
const needsScientific = (exp: number, digits: number) => exp >= digits || exp < -4;

export function formatReal(x: number, sf: number): string {
  if (!isFinite(x)) return isNaN(x) ? "NaN" : x > 0 ? "∞" : "-∞";
  if (x === 0) return "0";
  const isExact = !isFinite(sf);
  const digits = digitsFor(sf);
  const sign = x < 0 ? "-" : "";
  const [mantissa, expText] = Math.abs(x).toExponential(digits - 1).split("e");
  const exp = Number(expText);
  if (needsScientific(exp, digits)) {
    return `${sign}${isExact ? stripZeros(mantissa) : mantissa} × 10${superscript(String(exp))}`;
  }
  const fixed = Math.abs(x).toPrecision(digits);
  return sign + (isExact ? stripZeros(fixed) : fixed);
}

/** Formats one of several parts (complex parts, vector components) that share the precision of `mag`. */
function formatPart(x: number, mag: number, sf: number): string {
  const digits = digitsFor(sf);
  if (needsScientific(exponent10(mag), digits)) return formatReal(x, sf);
  const place = 10 ** (exponent10(mag) - digits + 1);
  let text = place < 1 ? x.toFixed(Math.round(-Math.log10(place))) : String(Math.round(x / place) * place);
  if (/^-0(\.0*)?$/.test(text)) text = text.slice(1);
  return isFinite(sf) ? text : stripZeros(text);
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

// Fields math.js sets on Unit objects but doesn't declare in its types.
type UnitInternals = Unit & {
  fixPrefix: boolean;
  skipAutomaticSimplification: boolean;
  units: { unit: { name: string; prefixes: Record<string, { value: number; scientific: boolean }> }; power: number }[];
};

/** If a measured value would need ambiguous trailing zeros (50 mm at 1 s.f.), try the next larger prefix (0.05 m). */
function stepUpPrefix(u: UnitInternals, value: number, units: string, sf: number): { value: number; units: string } | null {
  if (u.units.length !== 1 || u.units[0].power !== 1) return null;
  const { name, prefixes } = u.units[0].unit;
  if (!units.endsWith(name)) return null;
  const current = prefixes[units.slice(0, units.length - name.length)];
  if (!current) return null;
  const larger = Object.entries(prefixes)
    .filter(([, p]) => p.scientific && p.value > current.value)
    .sort((a, b) => a[1].value - b[1].value)[0];
  if (!larger) return null;
  const stepped = (value * current.value) / larger[1].value;
  return exponent10(stepped) < sf ? { value: stepped, units: larger[0] + name } : null;
}

/** Scale from SI to the displayed unit, plus that unit: simplified, with the best prefix. */
function displayUnit(u: Unit, sf: number): { scale: number; unit: string } {
  const si = magnitudeSI(u);
  const abs = math.abs(u as never) as unknown as UnitInternals;
  const simple = (abs.skipAutomaticSimplification ? abs : abs.simplify()) as UnitInternals;
  if (si === 0) return { scale: 1, unit: prettyUnit(simple.formatUnits()) };

  const text = simple.format({ precision: 15 });
  const space = text.indexOf(" ");
  let value = Number(text.slice(0, space));
  let units = text.slice(space + 1);
  if (isFinite(sf) && exponent10(value) >= sf && !simple.fixPrefix) {
    ({ value, units } = stepUpPrefix(simple, value, units, sf) ?? { value, units });
  }
  return { scale: value / si, unit: prettyUnit(units) };
}

function formatAngle(radians: number, sf: number, mode: AngleMode): string {
  return mode === "deg" ? formatReal((radians * 180) / Math.PI, sf) + "°" : formatReal(radians, sf) + " rad";
}

function formatComplex(z: Complex, sf: number, unit: string, mode: AngleMode): string {
  const mag = Math.hypot(z.re, z.im);
  const place = 10 ** (exponent10(mag) - digitsFor(sf) + 1);
  const negligible = (x: number) => Math.abs(x) < place / 2;
  if (negligible(z.im)) return withUnit(formatReal(z.re, sf), unit);

  const part = (x: number) => formatPart(x, mag, sf);
  const rect = negligible(z.re)
    ? `${part(z.im)}i`
    : `${part(z.re)} ${z.im < 0 ? "-" : "+"} ${part(Math.abs(z.im))}i`;
  const rectWithUnit = unit ? (negligible(z.re) ? `${rect} ${unit}` : `(${rect}) ${unit}`) : rect;
  const polar = `${formatReal(mag, sf)}∠${formatAngle(Math.atan2(z.im, z.re), sf, mode)}${unit ? " " + unit : ""}`;
  return `${rectWithUnit} · ${polar}`;
}

function formatVector(v: Vector, sf: number, mode: AngleMode): string {
  const size = magnitude(v);
  const { scale, unit } = math.isUnit(size) ? displayUnit(size as Unit, sf) : { scale: 1, unit: "" };
  const components = siComponents(v).map((c) => c * scale);
  const mag = magnitudeSI(v) * scale;
  const vectorText = withUnit(`[${components.map((c) => formatPart(c, mag, sf)).join(", ")}]`, unit);
  const magText = withUnit(formatReal(mag, sf), unit);
  const direction =
    v.length === 2 ? `${magText} @ ${formatAngle(Math.atan2(components[1], components[0]), sf, mode)}` : `|${magText}|`;
  return `${vectorText} · ${direction}`;
}

export function formatQuantity(q: Quantity, mode: AngleMode): string {
  const { value, sf } = q;
  if (isVector(value)) return formatVector(value, sf, mode);
  if (typeof value === "number") return formatReal(value, sf);
  if (math.isComplex(value)) return formatComplex(value, sf, "", mode);
  const u = value as Unit;
  const { scale, unit } = displayUnit(u, sf);
  const inner = u.value as number | Complex;
  if (typeof inner === "number") return withUnit(formatReal(inner * scale, sf), unit);
  return formatComplex(math.complex(inner.re * scale, inner.im * scale), sf, unit, mode);
}
