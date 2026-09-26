import { math, type Scalar } from "./math";

type Definition = { names: string[]; value: number; unit?: string; label: string };

// CODATA 2018 values. All are treated as exact (they never limit significant figures).
// Names that are already math.js units (h = hour, g = gram, F = farad, kB = kilobyte) stay
// units; those constants get an alternative name. hbar is the one exception: as a unit it
// would be "hectobar", which nobody means.
const DEFINITIONS: Definition[] = [
  { names: ["c", "c_0"], value: 299792458, unit: "m/s", label: "speed of light" },
  { names: ["h_P"], value: 6.62607015e-34, unit: "J s", label: "Planck constant" },
  { names: ["hbar", "ħ"], value: 6.62607015e-34 / (2 * Math.PI), unit: "J s", label: "reduced Planck constant" },
  { names: ["G", "G_N"], value: 6.6743e-11, unit: "m^3 / (kg s^2)", label: "gravitational constant" },
  { names: ["g_n"], value: 9.80665, unit: "m/s^2", label: "standard gravity" },
  { names: ["k_B"], value: 1.380649e-23, unit: "J/K", label: "Boltzmann constant" },
  { names: ["N_A"], value: 6.02214076e23, unit: "mol^-1", label: "Avogadro constant" },
  { names: ["R"], value: 8.31446261815324, unit: "J / (mol K)", label: "gas constant" },
  { names: ["σ", "sigma"], value: 5.670374419e-8, unit: "W / (m^2 K^4)", label: "Stefan–Boltzmann constant" },

  { names: ["q_e"], value: 1.602176634e-19, unit: "C", label: "elementary charge" },
  { names: ["ε_0", "ε0", "eps_0", "eps0"], value: 8.8541878128e-12, unit: "F/m", label: "vacuum permittivity" },
  { names: ["µ_0", "µ0", "μ_0", "μ0", "mu_0", "mu0"], value: 1.25663706212e-6, unit: "N / A^2", label: "vacuum permeability" },
  { names: ["k_e"], value: 8.9875517923e9, unit: "N m^2 / C^2", label: "Coulomb constant" },
  { names: ["Z_0", "Z0"], value: 376.730313668, unit: "ohm", label: "impedance of free space" },

  { names: ["m_e"], value: 9.1093837015e-31, unit: "kg", label: "electron mass" },
  { names: ["m_p"], value: 1.67262192369e-27, unit: "kg", label: "proton mass" },
  { names: ["m_n"], value: 1.67492749804e-27, unit: "kg", label: "neutron mass" },
  { names: ["m_u"], value: 1.6605390666e-27, unit: "kg", label: "atomic mass constant" },
  { names: ["a_0", "a0"], value: 5.29177210903e-11, unit: "m", label: "Bohr radius" },
  { names: ["R_inf"], value: 10973731.56816, unit: "m^-1", label: "Rydberg constant" },
  { names: ["α", "alpha"], value: 7.2973525693e-3, label: "fine-structure constant" },

  { names: ["V_T"], value: (1.380649e-23 * 300) / 1.602176634e-19, unit: "V", label: "thermal voltage at 300 K" },
  { names: ["Faraday"], value: 96485.33212, unit: "C/mol", label: "Faraday constant" },
];

function build(def: Definition): Scalar {
  return def.unit ? math.unit(def.value, def.unit) : def.value;
}

export const PHYSICAL_CONSTANTS: Record<string, Scalar> = Object.fromEntries(
  DEFINITIONS.flatMap((def) => {
    const value = build(def);
    return def.names.map((name) => [name, value]);
  }),
);
