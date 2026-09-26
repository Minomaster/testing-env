/** Periodic waves with period 1 (t in periods). Square/triangle/sawtooth swing ±1; the pulse is 0/1, centred on t = 0. */
export type Wave = "square" | "triangle" | "sawtooth" | "pulse";

const frac = (t: number) => t - Math.floor(t);

export function target(wave: Wave, t: number, duty: number): number {
  switch (wave) {
    case "square":
      return frac(t) < 0.5 ? 1 : -1;
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * t));
    case "sawtooth":
      return 2 * (t - Math.floor(t + 0.5));
    case "pulse":
      return frac(t + duty / 2) < duty ? 1 : 0;
  }
}

/** Term k of the series (k = 0 is the DC term) evaluated at t. */
function term(wave: Wave, k: number, t: number, duty: number): number {
  const w = 2 * Math.PI * k * t;
  switch (wave) {
    case "square":
      return k % 2 ? (4 / (Math.PI * k)) * Math.sin(w) : 0;
    case "triangle":
      return k % 2 ? ((8 / (Math.PI * Math.PI * k * k)) * (((k - 1) / 2) % 2 ? -1 : 1)) * Math.sin(w) : 0;
    case "sawtooth":
      return k ? ((2 / (Math.PI * k)) * (k % 2 ? 1 : -1)) * Math.sin(w) : 0;
    case "pulse":
      return k ? (2 / (Math.PI * k)) * Math.sin(Math.PI * k * duty) * Math.cos(w) : duty;
  }
}

/** Sum of harmonics 0…n (the DC term included for the pulse). */
export function partialSum(wave: Wave, t: number, n: number, duty: number): number {
  let sum = 0;
  for (let k = 0; k <= n; k++) sum += term(wave, k, t, duty);
  return sum;
}

/** Amplitude of harmonics 1…n. */
export function amplitudes(wave: Wave, n: number, duty: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    // Peak of term k over one period equals its amplitude.
    return Math.abs(wave === "pulse" ? term(wave, k, 0, duty) : term(wave, k, 1 / (4 * k), duty));
  });
}
