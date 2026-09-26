import { describe, expect, it } from "vitest";
import { evaluateInput } from "$lib/calc/evaluate";
import { formatQuantity } from "$lib/calc/format";
import { decode, encode } from "./colourCode";
import { combineExpr, impedanceExpr } from "./expressions";

const show = (expr: string) => formatQuantity(evaluateInput(expr, "deg"), "deg");

describe("resistor colour code", () => {
  it("decodes 4, 5 and 6 bands", () => {
    expect(decode(["yellow", "violet", "red", "gold"])).toEqual({ ohms: 4700, tolerance: 5, tempco: undefined });
    expect(decode(["brown", "black", "black", "brown", "brown"])).toEqual({ ohms: 1000, tolerance: 1, tempco: undefined });
    expect(decode(["red", "red", "black", "black", "brown", "red"])).toEqual({ ohms: 220, tolerance: 1, tempco: 50 });
    expect(decode(["brown", "black", "gold", "gold"]).ohms).toBe(1);
  });

  it("encodes values that fit, and rejects ones that don't", () => {
    expect(encode(4700, 2)).toEqual(["yellow", "violet", "red"]);
    expect(encode(220, 3)).toEqual(["red", "red", "black", "black"]);
    expect(encode(1, 2)).toEqual(["brown", "black", "gold"]);
    expect(encode(4750, 2)).toBeNull();
    expect(encode(4750, 3)).toEqual(["yellow", "violet", "green", "brown"]);
  });
});

describe("combining and impedance", () => {
  it("combines resistors and capacitors correctly", () => {
    expect(show(combineExpr("resistor", ["220 Ω", "330 Ω"], "series"))).toBe("550 Ω");
    expect(show(combineExpr("resistor", ["220 Ω", "330 Ω"], "parallel"))).toBe("132 Ω");
    expect(show(combineExpr("capacitor", ["10 uF", "10 uF"], "series"))).toBe("5.0 µF");
    expect(show(combineExpr("capacitor", ["10 uF", "10 uF"], "parallel"))).toBe("20 µF");
  });

  it("computes a series RLC impedance", () => {
    expect(show(impedanceExpr("100 Ω", "", "", "50 Hz"))).toBe("100 Ω");
    expect(show(impedanceExpr("100 Ω", "", "10.0 uF", "1.00 kHz"))).toBe("(100 - 16i) Ω · 101∠-9.04° Ω");
  });
});
