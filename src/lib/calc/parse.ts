import { UNIT_ALIASES } from "./math";

export type Node =
  | { type: "num"; value: number; digits: number }
  | { type: "name"; name: string }
  | { type: "call"; fn: string; args: Node[] }
  | { type: "neg"; arg: Node }
  | { type: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node }
  | { type: "pow"; base: Node; exp: Node }
  | { type: "implicit"; factors: Node[] }
  | { type: "polar"; mag: Node; angle: Node }
  | { type: "vector"; items: Node[] }
  | { type: "component"; base: Node; axis: "x" | "y" | "z" };

export type Line =
  | { kind: "empty" }
  | { kind: "comment" }
  | { kind: "expr"; assign?: string; expr: Node; convertTo?: string };

export const FUNCTION_NAMES = new Set([
  "sqrt", "cbrt", "abs", "re", "im", "conj", "arg", "exp", "ln", "log", "log2",
  "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
  "dot", "cross", "unit", "angle", "proj",
]);

export class CalcError extends Error {}

type Token =
  | { t: "num"; text: string }
  | { t: "name"; text: string }
  | { t: "op"; text: string };

const OP_ALIASES: Record<string, string> = {
  "×": "*", "·": "*", "÷": "/", "−": "-", "<": "∠",
};

function sigDigits(text: string): number {
  const mantissa = text.split(/[eE]/)[0].replace(".", "").replace(/^0+/, "");
  return Math.max(1, mantissa.length);
}

function lex(src: string): { tokens: Token[]; convertTo?: string } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\s+/))) {
      i += m[0].length;
    } else if ((m = rest.match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/))) {
      tokens.push({ t: "num", text: m[0] });
      i += m[0].length;
    } else if ((m = rest.match(/^°[CF]?/))) {
      tokens.push({ t: "name", text: m[0] });
      i += m[0].length;
    } else if ((m = rest.match(/^[\p{L}_][\p{L}\p{Nd}_]*/u))) {
      if (m[0] === "to") return { tokens, convertTo: rest.slice(2).trim() };
      const alias = UNIT_ALIASES[m[0]];
      if (alias) {
        const [top, bottom] = alias.split("/");
        tokens.push({ t: "op", text: "(" }, { t: "name", text: top }, { t: "op", text: "/" }, { t: "name", text: bottom }, { t: "op", text: ")" });
      } else {
        tokens.push({ t: "name", text: m[0] });
      }
      i += m[0].length;
    } else if (rest.startsWith("->") || rest.startsWith("→")) {
      return { tokens, convertTo: rest.slice(rest.startsWith("->") ? 2 : 1).trim() };
    } else if (rest[0] === "²" || rest[0] === "³") {
      tokens.push({ t: "op", text: "^" }, { t: "num", text: rest[0] === "²" ? "2" : "3" });
      i += 1;
    } else if (/^\.\p{L}/u.test(rest)) {
      tokens.push({ t: "op", text: "." });
      i += 1;
    } else if ("+-*/^(),[]∠<×·÷−".includes(rest[0])) {
      tokens.push({ t: "op", text: OP_ALIASES[rest[0]] ?? rest[0] });
      i += 1;
    } else {
      throw new CalcError(`Unexpected "${rest[0]}"`);
    }
  }
  return { tokens };
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(...ops: string[]): boolean {
    const tok = this.peek();
    return tok?.t === "op" && ops.includes(tok.text);
  }

  private next(): Token {
    const tok = this.tokens[this.pos++];
    if (!tok) throw new CalcError("Incomplete expression");
    return tok;
  }

  parseAll(): Node {
    const node = this.additive();
    const tok = this.peek();
    if (tok) throw new CalcError(`Unexpected "${tok.text}"`);
    return node;
  }

  private additive(): Node {
    let left = this.multiplicative();
    while (this.isOp("+", "-")) {
      const op = this.next().text as "+" | "-";
      left = { type: "bin", op, left, right: this.multiplicative() };
    }
    return left;
  }

  private multiplicative(): Node {
    let left = this.polar();
    while (this.isOp("*", "/")) {
      const op = this.next().text as "*" | "/";
      left = { type: "bin", op, left, right: this.polar() };
    }
    return left;
  }

  private polar(): Node {
    const mag = this.unary();
    if (!this.isOp("∠")) return mag;
    this.next();
    return { type: "polar", mag, angle: this.unary() };
  }

  private unary(): Node {
    if (this.isOp("-", "+")) {
      const op = this.next().text;
      const arg = this.unary();
      return op === "-" ? { type: "neg", arg } : arg;
    }
    return this.implicit();
  }

  // Juxtaposition ("2 pi tau", "4.7 µF") binds tighter than * and /, so 1 / 2 pi = 1 / (2π).
  private implicit(): Node {
    const factors = [this.power()];
    while (this.startsPrimary()) factors.push(this.power());
    return factors.length === 1 ? factors[0] : { type: "implicit", factors };
  }

  private startsPrimary(): boolean {
    const tok = this.peek();
    return tok !== undefined && (tok.t !== "op" || tok.text === "(" || tok.text === "[");
  }

  private power(): Node {
    const base = this.postfix();
    if (!this.isOp("^")) return base;
    this.next();
    return { type: "pow", base, exp: this.exponent() };
  }

  private exponent(): Node {
    if (this.isOp("-", "+")) {
      const op = this.next().text;
      const arg = this.exponent();
      return op === "-" ? { type: "neg", arg } : arg;
    }
    return this.power();
  }

  private postfix(): Node {
    let node = this.primary();
    while (this.isOp(".")) {
      this.next();
      const axis = this.next().text;
      if (axis !== "x" && axis !== "y" && axis !== "z") throw new CalcError("Use .x, .y or .z for a vector component");
      node = { type: "component", base: node, axis };
    }
    return node;
  }

  private list(close: string): Node[] {
    const items: Node[] = [];
    if (this.isOp(close)) return items;
    items.push(this.additive());
    while (this.isOp(",")) {
      this.next();
      items.push(this.additive());
    }
    return items;
  }

  private primary(): Node {
    const tok = this.next();
    if (tok.t === "num") {
      return { type: "num", value: Number(tok.text), digits: sigDigits(tok.text) };
    }
    if (tok.t === "name") {
      if (FUNCTION_NAMES.has(tok.text) && this.isOp("(")) {
        this.next();
        const args = this.list(")");
        this.expect(")");
        return { type: "call", fn: tok.text, args };
      }
      return { type: "name", name: tok.text };
    }
    if (tok.text === "[") {
      const items = this.list("]");
      this.expect("]");
      return { type: "vector", items };
    }
    if (tok.text === "(") {
      const inner = this.additive();
      this.expect(")");
      return inner;
    }
    throw new CalcError(`Unexpected "${tok.text}"`);
  }

  private expect(op: string) {
    if (!this.isOp(op)) throw new CalcError(`Missing "${op}"`);
    this.next();
  }
}

const ASSIGNMENT = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(.*)$/u;

export function parseLine(src: string): Line {
  const hash = src.indexOf("#");
  const code = hash === -1 ? src : src.slice(0, hash);
  if (!code.trim()) return { kind: src.trim() ? "comment" : "empty" };

  const assignment = code.match(ASSIGNMENT);
  const assign = assignment?.[1];
  const body = assignment ? assignment[2] : code;
  if (!body.trim()) throw new CalcError("Missing value after =");

  const { tokens, convertTo } = lex(body);
  if (tokens.length === 0) throw new CalcError("Missing value");
  if (convertTo === "") throw new CalcError("Missing unit after to");
  return { kind: "expr", assign, expr: new Parser(tokens).parseAll(), convertTo };
}
