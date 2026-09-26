export type Colour = { name: string; hex: string; digit?: number; multiplier?: number; tolerance?: number; tempco?: number };

export const COLOURS: Colour[] = [
  { name: "black", hex: "#1a1a1a", digit: 0, multiplier: 1 },
  { name: "brown", hex: "#7b4a2a", digit: 1, multiplier: 10, tolerance: 1, tempco: 100 },
  { name: "red", hex: "#d23c3c", digit: 2, multiplier: 100, tolerance: 2, tempco: 50 },
  { name: "orange", hex: "#e8862c", digit: 3, multiplier: 1e3, tempco: 15 },
  { name: "yellow", hex: "#e8d02c", digit: 4, multiplier: 1e4, tempco: 25 },
  { name: "green", hex: "#3c9c4a", digit: 5, multiplier: 1e5, tolerance: 0.5 },
  { name: "blue", hex: "#3c6ed2", digit: 6, multiplier: 1e6, tolerance: 0.25, tempco: 10 },
  { name: "violet", hex: "#8a4ad2", digit: 7, multiplier: 1e7, tolerance: 0.1, tempco: 5 },
  { name: "grey", hex: "#8a8a8a", digit: 8, multiplier: 1e8, tolerance: 0.05 },
  { name: "white", hex: "#f0f0f0", digit: 9, multiplier: 1e9 },
  { name: "gold", hex: "#c9a43a", multiplier: 0.1, tolerance: 5 },
  { name: "silver", hex: "#b8b8b8", multiplier: 0.01, tolerance: 10 },
];

export type BandCount = 4 | 5 | 6;
export type BandRole = "digit" | "multiplier" | "tolerance" | "tempco";

export function bandRoles(count: BandCount): BandRole[] {
  const digits: BandRole[] = count === 4 ? ["digit", "digit"] : ["digit", "digit", "digit"];
  return [...digits, "multiplier", "tolerance", ...(count === 6 ? (["tempco"] as BandRole[]) : [])];
}

export function coloursFor(role: BandRole): Colour[] {
  return COLOURS.filter((c) => c[role] !== undefined);
}

const byName = (name: string) => COLOURS.find((c) => c.name === name)!;

export function decode(bands: string[]): { ohms: number; tolerance: number; tempco?: number } {
  const roles = bandRoles(bands.length as BandCount);
  let digits = 0;
  let ohms = 0;
  let tolerance = 0;
  let tempco: number | undefined;
  roles.forEach((role, i) => {
    const c = byName(bands[i]);
    if (role === "digit") digits = digits * 10 + c.digit!;
    else if (role === "multiplier") ohms = digits * c.multiplier!;
    else if (role === "tolerance") tolerance = c.tolerance!;
    else tempco = c.tempco;
  });
  return { ohms: Number(ohms.toPrecision(12)), tolerance, tempco };
}

/** Digit and multiplier band colours for a resistance, or null if it can't be shown exactly. */
export function encode(ohms: number, digitCount: 2 | 3): string[] | null {
  if (!(ohms > 0)) return null;
  const exp = Math.floor(Math.log10(ohms)) - (digitCount - 1);
  const mantissa = Math.round(ohms / 10 ** exp);
  const [m, e] = mantissa >= 10 ** digitCount ? [mantissa / 10, exp + 1] : [mantissa, exp];
  if (Math.abs(m * 10 ** e - ohms) > ohms * 1e-9) return null;
  const multiplier = COLOURS.find((c) => c.multiplier !== undefined && Math.abs(Math.log10(c.multiplier) - e) < 1e-9);
  if (!multiplier) return null;
  const digits = String(m).padStart(digitCount, "0").split("").map((d) => COLOURS[Number(d)].name);
  return [...digits, multiplier.name];
}
