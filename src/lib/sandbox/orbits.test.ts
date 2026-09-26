import { describe, expect, it } from "vitest";
import { circularVelocity, collide, makeBody, orbitOf, preset, step, totals } from "./orbits";

describe("orbit physics", () => {
  it("keeps a circular orbit circular and conserves energy over a period", () => {
    const sun = makeBody(0, 0, 0, 0, 4000, true);
    const [vx, vy] = circularVelocity(200, 0, sun);
    const planet = makeBody(200, 0, vx, vy, 0.001);
    const bodies = [sun, planet];
    const e0 = totals(bodies).energy;
    const { period, e } = orbitOf(planet, sun);
    expect(e).toBeLessThan(0.01);
    for (let t = 0; t < period!; t += 0.05) step(bodies, 0.05);
    expect(Math.hypot(planet.x - 200, planet.y)).toBeLessThan(5);
    expect(Math.abs(totals(bodies).energy / e0 - 1)).toBeLessThan(1e-3);
  });

  it("merges colliding bodies conserving momentum", () => {
    const bodies = [makeBody(0, 0, 1, 0, 3), makeBody(1, 0, -1, 0, 1)];
    collide(bodies);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].m).toBe(4);
    expect(bodies[0].vx).toBeCloseTo(0.5, 10);
  });

  it("figure-eight preset has zero total momentum", () => {
    const px = preset("figure8").reduce((s, b) => s + b.m * b.vx, 0);
    expect(Math.abs(px)).toBeLessThan(1e-6);
  });
});
