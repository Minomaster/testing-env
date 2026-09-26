import type { Unit } from "mathjs";
import { add, div, loose, math, mul, neg, sub, type Scalar } from "./math";
import { CalcError } from "./parse";

const sqrt = loose(math.sqrt);

export class Vector {
  constructor(readonly components: Scalar[]) {}
  get length(): number {
    return this.components.length;
  }
}

export const isVector = (v: unknown): v is Vector => v instanceof Vector;

const TORQUE = math.unit(1, "N m");

/** Builds a vector, letting bare 0 components take the others' unit ([0.20 m, 0, 0.50 m]). */
export function vectorFrom(components: Scalar[]): Vector {
  if (components.length < 2) throw new CalcError("A vector needs at least 2 components");
  if (components.some((c) => math.isComplex(c))) throw new CalcError("Vector components can't be complex");
  const template = components.find((c) => math.isUnit(c)) as Unit | undefined;
  if (!template) return new Vector(components);
  return new Vector(
    components.map((c) => {
      if (math.isUnit(c)) {
        if (!(c as Unit).equalBase(template)) throw new CalcError("Vector components must have the same kind of unit");
        return c;
      }
      if (c === 0) return mul(template, 0);
      throw new CalcError("Vector mixes numbers and units");
    }),
  );
}

/** Signed component values in SI base units. */
export function siComponents(v: Vector): number[] {
  return v.components.map((c) => (math.isUnit(c) ? ((c as Unit).value as number) : (c as number)));
}

function sameLength(a: Vector, b: Vector) {
  if (a.length !== b.length) throw new CalcError(`Vectors have different lengths (${a.length} and ${b.length})`);
}

export function addVectors(a: Vector, b: Vector, op: "+" | "-"): Vector {
  sameLength(a, b);
  return new Vector(a.components.map((c, i) => (op === "+" ? add(c, b.components[i]) : sub(c, b.components[i]))));
}

export function scale(v: Vector, s: Scalar, divide = false): Vector {
  if (math.isComplex(s)) throw new CalcError("Vectors can't be scaled by complex numbers");
  return new Vector(v.components.map((c) => (divide ? div(c, s) : mul(c, s))));
}

export function negate(v: Vector): Vector {
  return new Vector(v.components.map((c) => neg(c)));
}

export function dot(a: Vector, b: Vector): Scalar {
  sameLength(a, b);
  return a.components.map((c, i) => mul(c, b.components[i])).reduce((sum, term) => add(sum, term));
}

/** Keeps the components' unit when it was fixed explicitly (a torque in N·m, or after `to mm`). */
export function magnitude(v: Vector): Scalar {
  const size = sqrt(dot(v, v));
  const first = v.components[0] as Unit & { fixPrefix?: boolean };
  return math.isUnit(first) && first.fixPrefix ? (size as Unit).to(first.formatUnits()) : size;
}

// r × F has energy dimensions, but it is a torque: show N·m, not J.
function asTorque(x: Scalar): Scalar {
  return math.isUnit(x) && (x as Unit).equalBase(TORQUE) ? (x as Unit).to("N m") : x;
}

/** 3D vectors give a vector; 2D vectors give the scalar z-component. */
export function cross(a: Vector, b: Vector): Scalar | Vector {
  const [ax, ay, az] = a.components;
  const [bx, by, bz] = b.components;
  const z = () => asTorque(sub(mul(ax, by), mul(ay, bx)));
  if (a.length === 2 && b.length === 2) return z();
  if (a.length !== 3 || b.length !== 3) throw new CalcError("cross() needs two 2D or two 3D vectors");
  return new Vector([
    asTorque(sub(mul(ay, bz), mul(az, by))),
    asTorque(sub(mul(az, bx), mul(ax, bz))),
    z(),
  ]);
}

export function unitVector(v: Vector): Vector {
  const size = magnitude(v);
  if (math.isUnit(size) ? (size as Unit).value === 0 : size === 0) throw new CalcError("A zero vector has no direction");
  return scale(v, size, true);
}

export function angleBetween(a: Vector, b: Vector): number {
  sameLength(a, b);
  const sa = siComponents(a);
  const sb = siComponents(b);
  const product = Math.hypot(...sa) * Math.hypot(...sb);
  if (product === 0) throw new CalcError("A zero vector has no direction");
  const cos = sa.reduce((sum, x, i) => sum + x * sb[i], 0) / product;
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

export function project(a: Vector, b: Vector): Vector {
  const bb = dot(b, b);
  if (math.isUnit(bb) ? (bb as Unit).value === 0 : bb === 0) throw new CalcError("Can't project onto a zero vector");
  return scale(b, div(dot(a, b), bb));
}

export function convertVector(v: Vector, unitExpr: string): Vector {
  if (!v.components.every((c) => math.isUnit(c))) throw new CalcError("Nothing to convert: the vector has no unit");
  return new Vector(v.components.map((c) => (c as Unit).to(unitExpr)));
}
