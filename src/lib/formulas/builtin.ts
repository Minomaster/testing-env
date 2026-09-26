import { slug, type Formula } from "./types";

/*
 * Built-in formulas live in ./builtin/*.txt, one category per file:
 *
 *   @category Mechanics
 *
 *   = Newton's second law
 *   latex: \vec F = m \vec a
 *   expr: F = m a
 *   v: F | N | net force
 *   v: m | kg | mass
 *   tags: force, dynamics
 *   note: optional remark
 *
 * A formula without `expr:` is reference-only (not solvable). A unit of "1" means dimensionless.
 */
export function parseFormulaFile(text: string, file: string): Formula[] {
  let category = "";
  const formulas: Formula[] = [];
  let current: Formula | undefined;

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const where = `${file}:${index + 1}`;
    if (!line || line.startsWith("//")) return;
    if (line.startsWith("@category ")) {
      category = line.slice(10).trim();
      return;
    }
    if (line.startsWith("= ")) {
      if (!category) throw new Error(`${where}: formula before @category`);
      const name = line.slice(2).trim();
      current = { id: `${slug(category)}/${slug(name)}`, name, category, latex: "", variables: [], tags: [] };
      formulas.push(current);
      return;
    }
    if (!current) throw new Error(`${where}: line outside a formula`);
    const colon = line.indexOf(":");
    if (colon === -1) throw new Error(`${where}: expected "key: value"`);
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    switch (key) {
      case "latex":
        current.latex = value;
        break;
      case "expr":
        current.expr = value;
        break;
      case "v": {
        const [symbol, unit, description] = value.split("|").map((s) => s.trim());
        if (!symbol || unit === undefined || !description) throw new Error(`${where}: expected "v: symbol | unit | description"`);
        current.variables.push({ symbol, unit: unit === "1" ? "" : unit, description });
        break;
      }
      case "tags":
        current.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
        break;
      case "note":
        current.note = value;
        break;
      default:
        throw new Error(`${where}: unknown key "${key}"`);
    }
  });
  return formulas;
}

const files = import.meta.glob("./builtin/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const BUILTIN_FORMULAS: Formula[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([file, text]) => parseFormulaFile(text, file));
