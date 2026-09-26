import { readDataFile, writeDataFile } from "$lib/dataFiles";
import { BUILTIN_FORMULAS } from "./builtin";
import type { Formula, LibraryFormula } from "./types";

const USER_FILE = "formulas/my-formulas.json";
const builtinIds = new Set(BUILTIN_FORMULAS.map((f) => f.id));

/** Your formulas and edits; an entry with a built-in's id replaces that built-in. */
let userFormulas = $state<Formula[]>([]);

export const library = {
  get formulas(): LibraryFormula[] {
    const overrides = new Map(userFormulas.map((f) => [f.id, f]));
    const merged: LibraryFormula[] = BUILTIN_FORMULAS.map((f) =>
      overrides.has(f.id) ? { ...overrides.get(f.id)!, source: "edited" } : { ...f, source: "builtin" },
    );
    for (const f of userFormulas) if (!builtinIds.has(f.id)) merged.push({ ...f, source: "user" });
    return merged;
  },
  get categories(): string[] {
    return [...new Set(this.formulas.map((f) => f.category))].sort();
  },
};

export async function loadLibrary(): Promise<void> {
  const text = await readDataFile(USER_FILE);
  userFormulas = text ? (JSON.parse(text) as { formulas: Formula[] }).formulas : [];
}

async function persist(next: Formula[]): Promise<void> {
  await writeDataFile(USER_FILE, JSON.stringify({ formulas: next }, null, 2) + "\n");
  userFormulas = next;
}

export function saveFormula(formula: Formula): Promise<void> {
  const clean: Formula = { ...formula, expr: formula.expr?.trim() || undefined, note: formula.note?.trim() || undefined };
  delete (clean as Partial<LibraryFormula>).source;
  const exists = userFormulas.some((f) => f.id === clean.id);
  return persist(exists ? userFormulas.map((f) => (f.id === clean.id ? clean : f)) : [...userFormulas, clean]);
}

/** Deletes your own formula, or resets an edited built-in to the original. */
export function removeFormula(id: string): Promise<void> {
  return persist(userFormulas.filter((f) => f.id !== id));
}

export function isBuiltinId(id: string): boolean {
  return builtinIds.has(id);
}

function haystack(f: Formula): string {
  return [f.name, f.category, f.tags.join(" "), f.note ?? "", ...f.variables.flatMap((v) => [v.symbol, v.description])]
    .join(" ")
    .toLowerCase();
}

/** Every word of the query must appear; name matches rank first, shorter (more general) names before longer. */
export function searchFormulas(formulas: LibraryFormula[], query: string): LibraryFormula[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return formulas;
  const score = (f: LibraryFormula) => {
    const name = f.name.toLowerCase();
    if (name.startsWith(query.toLowerCase().trim())) return 0;
    if (words.every((w) => name.includes(w))) return 1;
    return 2;
  };
  return formulas
    .filter((f) => {
      const text = haystack(f);
      return words.every((w) => text.includes(w));
    })
    .map((f, index) => ({ f, index, rank: score(f) }))
    .sort((a, b) => a.rank - b.rank || (a.rank < 2 ? a.f.name.length - b.f.name.length : 0) || a.index - b.index)
    .map(({ f }) => f);
}
