import { describe, expect, it } from "vitest";
import { evaluateSheet, type AngleMode } from "./evaluate";
import { formatQuantity, formatReal } from "./format";

function run(text: string, mode: AngleMode = "deg"): string[] {
  return evaluateSheet(text, mode).map((r) => {
    if (r.kind === "value") return formatQuantity(r.quantity, mode);
    if (r.kind === "error") return `error: ${r.message}`;
    return r.kind;
  });
}
const one = (line: string, mode: AngleMode = "deg") => run(line, mode)[0];

describe("significant figures", () => {
  it("treats bare numbers as exact", () => {
    expect(one("2 * 3")).toBe("6");
    expect(one("1/3")).toBe("0.333333");
    expect(one("2 pi")).toBe("6.28319");
  });

  it("counts every digit of a number written with a unit, trailing zeros included", () => {
    expect(one("220 ohm")).toBe("220 Ω");
    expect(one("4.70 uF")).toBe("4.70 µF");
    expect(one("1500 m")).toBe("1.500 km");
    expect(one("0.0047 F")).toBe("4.7 mF");
    expect(one("4.7e-6 F")).toBe("4.7 µF");
  });

  it("uses the fewest significant figures for multiplication and division", () => {
    expect(one("220 ohm * 4.7 uF")).toBe("1.0 ms");
    expect(one("9.81 m/s^2 * 2.0 kg")).toBe("20 N");
  });

  it("keeps exact factors from limiting precision", () => {
    expect(one("1 / (2 pi 220 ohm 4.70 uF)")).toBe("154 Hz");
  });

  it("uses the least precise decimal place for addition, across units", () => {
    expect(one("1.2 m + 3.45 cm")).toBe("1.2 m");
    expect(one("2.0 m + 3 m")).toBe("5 m");
    expect(one("10.52 V - 0.3 V")).toBe("10.2 V");
  });

  it("steps up an SI prefix rather than show ambiguous trailing zeros", () => {
    expect(one("0.05 m")).toBe("0.05 m");
    expect(one("0.54 m")).toBe("0.54 m");
    expect(one("1 / (2 pi 1.0 ms)")).toBe("0.16 kHz");
    expect(one("1.5e2 m/s")).toBe("1.5 × 10² m/s");
  });

  it("switches to scientific notation instead of showing non-significant zeros", () => {
    expect(formatReal(1540, 2)).toBe("1.5 × 10³");
    expect(formatReal(154, 3)).toBe("154");
    expect(formatReal(0.00001234, Infinity)).toBe("1.234 × 10⁻⁵");
    expect(formatReal(2.2, 3)).toBe("2.20");
  });
});

describe("sheet behaviour", () => {
  it("carries variables down the sheet", () => {
    expect(run("R = 220 Ω\nC = 4.70 µF\ntau = R C\nf_c = 1 / (2 pi tau)")).toEqual([
      "220 Ω", "4.70 µF", "1.03 ms", "154 Hz",
    ]);
  });

  it("handles comments and blank lines", () => {
    expect(run("# RC filter\n\n5 V # supply")).toEqual(["comment", "empty", "5 V"]);
  });

  it("supports ans for the previous result", () => {
    expect(run("2.0 m\nans * 3")).toEqual(["2.0 m", "6.0 m"]);
  });

  it("lets variables shadow unit names", () => {
    expect(run("C = 2\n3 C")).toEqual(["2", "6"]);
  });

  it("rejects reserved names and reports unknown ones", () => {
    expect(one("pi = 3")).toBe('error: "pi" is reserved');
    expect(one("x + 1")).toBe('error: Unknown name "x"');
    expect(one("1 m + 1 s")).toBe("error: Units don't match");
  });

  it("keeps evaluating lines after an error", () => {
    expect(run("oops +\n2 * 2")).toEqual(["error: Incomplete expression", "4"]);
  });
});

describe("units", () => {
  it("simplifies and converts", () => {
    expect(one("5.0 ohm * 2.0 A")).toBe("10 V");
    expect(one("120 mph to m/s")).toBe("53.6 m/s");
    expect(one("100 km/h -> mph")).toBe("62.1 mph");
    expect(one("2.5 kohm")).toBe("2.5 kΩ");
    expect(one("25.0 °C to K")).toBe("298 K");
    expect(one("9.81 m/s²")).toBe("9.81 m/s²");
  });

  it("keeps SI units for results even though mph/kph are understood", () => {
    expect(one("10.0 m / 2.00 s")).toBe("5.00 m/s");
    expect(one("3.0 km/h * 2")).toBe("6.0 km/h");
  });
});

describe("complex numbers and angles", () => {
  it("shows rectangular and polar forms together", () => {
    expect(one("3 + 4i")).toBe("3 + 4i · 5∠53.1301°");
    expect(one("3 + 4i", "rad")).toBe("3 + 4i · 5∠0.927295 rad");
    expect(one("-2i")).toBe("-2i · 2∠-90°");
  });

  it("builds phasors with ∠ (or <) and tracks units and sig figs", () => {
    expect(one("5.00 V ∠ 30")).toBe("(4.33 + 2.50i) V · 5.00∠30.0° V");
    expect(one("5.00 V < 30")).toBe("(4.33 + 2.50i) V · 5.00∠30.0° V");
    expect(one("10∠90")).toBe("10i · 10∠90°");
  });

  it("collapses complex results with no imaginary part", () => {
    expect(one("i * i")).toBe("-1");
  });

  it("applies the DEG/RAD toggle to trig and ∠, while explicit units win", () => {
    expect(one("sin(30)")).toBe("0.5");
    expect(one("sin(30)", "rad")).toBe("-0.988032");
    expect(one("sin(30 deg)", "rad")).toBe("0.50");
    expect(one("asin(0.5)")).toBe("30°");
    expect(one("asin(0.5)", "rad")).toBe("0.523599");
    expect(one("sin(180)")).toBe("0");
  });

  it("converts bare angles using the current mode", () => {
    expect(one("90 to rad")).toBe("1.5708 rad");
  });
});

describe("physical constants", () => {
  it("are available by symbol and exact", () => {
    expect(one("c")).toBe("2.99792 × 10⁸ m/s");
    expect(one("g_n")).toBe("9.80665 m/s²");
    expect(one("hbar")).toBe("1.05457 × 10⁻³⁴ J·s");
    expect(one("ħ")).toBe("1.05457 × 10⁻³⁴ J·s");
    expect(one("V_T")).toBe("25.852 mV");
    expect(one("h_P c / (500 nm)")).toBe("3.97 × 10⁻¹⁹ J");
    expect(one("1 / sqrt(ε_0 µ_0)")).toBe("2.99792 × 10⁸ m/s");
  });

  it("never override units (h is hours, g is grams)", () => {
    expect(one("5 h")).toBe("5 h");
    expect(one("2 g")).toBe("2 g");
  });

  it("can be shadowed by your own variables", () => {
    expect(run("R\nR = 220 Ω\nR")).toEqual(["8.31446 J/(mol·K)", "220 Ω", "220 Ω"]);
  });

  it("uses × 10ⁿ in the base unit instead of exotic prefixes", () => {
    expect(one("m_e")).toBe("9.10938 × 10⁻³¹ kg");
    expect(one("q_e")).toBe("1.60218 × 10⁻¹⁹ C");
    expect(one("N_A")).toBe("6.02214 × 10²³ mol⁻¹");
    expect(one("a_0")).toBe("52.9177 pm");
  });
});

describe("unit display is independent of what was typed before", () => {
  it("doesn't let an earlier nm turn later speeds into nm/s", () => {
    expect(run("500 nm\n10.0 m / 2.00 s")).toEqual(["500 nm", "5.00 m/s"]);
    expect(one("10.0 m / 2.00 s")).toBe("5.00 m/s");
  });

  it("keeps units as you typed them", () => {
    expect(one("60 mph")).toBe("60 mph");
    expect(one("3.0 km/h * 2")).toBe("6.0 km/h");
  });
});

describe("plots", () => {
  it("samples one or more curves over a range, using earlier variables", () => {
    const [, r] = evaluateSheet("A = 2\nplot A sin(x), cos(x) from 0 to 180", "deg");
    if (r.kind !== "plot") throw new Error(JSON.stringify(r));
    expect(r.plot.curves.map((c) => c.label)).toEqual(["A sin(x)", "cos(x)"]);
    expect(r.plot.xs[0]).toBe(0);
    expect(r.plot.xs.at(-1)).toBe(180);
    expect(Math.max(...r.plot.curves[0].ys)).toBeCloseTo(2, 3);
  });

  it("supports a named variable with units", () => {
    const [r] = evaluateSheet("plot 5 V exp(-t / 1 ms) for t from 0 s to 5 ms", "deg");
    if (r.kind !== "plot") throw new Error(JSON.stringify(r));
    expect(r.plot.variable).toBe("t");
    expect(r.plot.xs.at(-1)).toBeCloseTo(0.005, 10);
    expect(r.plot.curves[0].ys[0]).toBeCloseTo(5, 10);
  });

  it("explains bad plot lines", () => {
    expect(one("plot sin(x)")).toBe("error: Use: plot <expression> from <start> to <end>");
    expect(one("plot x m, x s from 0 to 1")).toBe("error: All curves in one plot need the same unit");
  });
});

describe("vectors", () => {
  it("shows components, magnitude, and a direction angle for 2D", () => {
    expect(one("[3, 4]")).toBe("[3, 4] · 5 @ 53.1301°");
    expect(one("[3, 4]", "rad")).toBe("[3, 4] · 5 @ 0.927295 rad");
    expect(one("[1, 2, 2] N")).toBe("[1, 2, 2] N · |3 N|");
  });

  it("gives components one shared precision and lets written zeros not limit it", () => {
    expect(one("[3.00, 4.00, 0] N")).toBe("[3.00, 4.00, 0.00] N · |5.00 N|");
    expect(one("[0.20 m, 0, 0.50 m]")).toBe("[0.20, 0.00, 0.50] m · |0.54 m|");
  });

  it("adds, scales and converts", () => {
    expect(one("[1.0, 2.0] m + [0.5, 0.5] m")).toBe("[1.5, 2.5] m · 2.9 m @ 59°");
    expect(one("2 [1.0, 2.0] m")).toBe("[2.0, 4.0] m · 4.5 m @ 63°");
    expect(one("-[1, 2]")).toBe("[-1, -2] · 2.23607 @ -116.565°");
    expect(one("[1.00, 2.00] cm to mm")).toBe("[10.0, 20.0] mm · 22.4 mm @ 63.4°");
  });

  it("has dot, cross, unit, angle, proj and abs", () => {
    expect(run("F = [3.0, 4.0] N\nd = [2.0, 0] m\ndot(F, d)")[2]).toBe("6.0 J");
    expect(one("cross([1.0, 0, 0] m, [0, 2.0, 0] N)")).toBe("[0.0, 0.0, 2.0] N·m · |2.0 N·m|");
    expect(one("cross([2.0, 0] m, [0, 3.0] N)")).toBe("6.0 N·m");
    expect(one("unit([3, 4])")).toBe("[0.6, 0.8] · 1 @ 53.1301°");
    expect(one("angle([1, 0], [1, 1])")).toBe("45°");
    expect(one("proj([2, 3], [1, 0])")).toBe("[2, 0] · 2 @ 0°");
    expect(one("abs([3, 4])")).toBe("5");
  });

  it("reads single components with .x .y .z", () => {
    expect(run("F = [3.00, 4.00] N\nF.x\nF.y\nF.z")).toEqual(["[3.00, 4.00] N · 5.00 N @ 53.1°", "3.00 N", "4.00 N", "error: This vector has no z component"]);
    expect(one("([1, 2] + [3, 4]).y")).toBe("6");
  });

  it("explains invalid vector operations", () => {
    expect(one("[1, 2] * [3, 4]")).toBe("error: Use dot() or cross() to multiply vectors");
    expect(one("[1, 2] + 3")).toBe("error: Can't add a vector and a number");
    expect(one("sin([1, 2])")).toBe("error: sin() doesn't take a vector");
    expect(one("[1 m, 2 s]")).toBe("error: Vector components must have the same kind of unit");
    expect(one("[1 m, 2]")).toBe("error: Vector mixes numbers and units");
    expect(one("dot([1, 2], [1, 2, 3])")).toBe("error: Vectors have different lengths (2 and 3)");
    expect(one("[5]")).toBe("error: A vector needs at least 2 components");
    expect(one("dot([1, 2])")).toBe("error: dot() takes 2 vectors");
  });
});
