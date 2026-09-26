export type C = { re: number; im: number };

const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

/** Reflection coefficient, normalised impedance, VSWR and return loss for a load on a line. */
export function analyse(zl: C, z0: number) {
  const gamma = div({ re: zl.re - z0, im: zl.im }, { re: zl.re + z0, im: zl.im });
  const mag = Math.hypot(gamma.re, gamma.im);
  return {
    gamma,
    mag,
    angle: Math.atan2(gamma.im, gamma.re),
    z: { re: zl.re / z0, im: zl.im / z0 },
    vswr: mag < 1 ? (1 + mag) / (1 - mag) : Infinity,
    returnLoss: -20 * Math.log10(mag),
  };
}
