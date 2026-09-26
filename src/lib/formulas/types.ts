export type Variable = {
  /** Calculator name, e.g. "v_0" or "ω". */
  symbol: string;
  /** Calculator unit expression, e.g. "m/s^2" or "Ω"; "" for dimensionless. */
  unit: string;
  description: string;
};

export type Formula = {
  id: string;
  name: string;
  category: string;
  latex: string;
  /** Calculator-syntax equation "lhs = rhs"; absent for reference-only formulas. */
  expr?: string;
  variables: Variable[];
  tags: string[];
  note?: string;
};

export type FormulaSource = "builtin" | "edited" | "user";
export type LibraryFormula = Formula & { source: FormulaSource };

export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
