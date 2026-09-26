/** 2D n-body gravity in simulation units (G = 1, distances in screen pixels at zoom 1). */
export type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  r: number;
  hue: number;
  star: boolean;
  trail: number[];
};

const G = 1;
const SOFTENING = 2;
export const TRAIL_POINTS = 400;

export function radiusFor(m: number, star: boolean): number {
  return star ? 8 + 2 * Math.cbrt(m / 100) : 2 + 1.4 * Math.cbrt(m);
}

export function makeBody(x: number, y: number, vx: number, vy: number, m: number, star = false, hue = Math.random() * 360): Body {
  return { x, y, vx, vy, m, r: radiusFor(m, star), hue, star, trail: [] };
}

function accelerations(bodies: Body[]): Float64Array {
  const a = new Float64Array(bodies.length * 2);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const [p, q] = [bodies[i], bodies[j]];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
      const inv = G / (d2 * Math.sqrt(d2));
      a[2 * i] += dx * inv * q.m;
      a[2 * i + 1] += dy * inv * q.m;
      a[2 * j] -= dx * inv * p.m;
      a[2 * j + 1] -= dy * inv * p.m;
    }
  }
  return a;
}

/** One kick-drift-kick leapfrog step (conserves energy well over long runs). */
export function step(bodies: Body[], dt: number): void {
  let a = accelerations(bodies);
  bodies.forEach((b, i) => {
    b.vx += (a[2 * i] * dt) / 2;
    b.vy += (a[2 * i + 1] * dt) / 2;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  a = accelerations(bodies);
  bodies.forEach((b, i) => {
    b.vx += (a[2 * i] * dt) / 2;
    b.vy += (a[2 * i + 1] * dt) / 2;
  });
}

/** Merges touching bodies into the heavier one, conserving mass and momentum. Returns true if any merged. */
export function collide(bodies: Body[]): boolean {
  let merged = false;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const [p, q] = [bodies[i], bodies[j]];
      if (Math.hypot(q.x - p.x, q.y - p.y) > p.r + q.r) continue;
      const [big, small] = p.m >= q.m ? [p, q] : [q, p];
      const m = big.m + small.m;
      big.vx = (big.vx * big.m + small.vx * small.m) / m;
      big.vy = (big.vy * big.m + small.vy * small.m) / m;
      big.x = (big.x * big.m + small.x * small.m) / m;
      big.y = (big.y * big.m + small.y * small.m) / m;
      big.m = m;
      big.star ||= small.star;
      big.r = radiusFor(m, big.star);
      bodies.splice(bodies.indexOf(small), 1);
      merged = true;
      j = i;
    }
  }
  return merged;
}

export function recordTrails(bodies: Body[]): void {
  for (const b of bodies) {
    b.trail.push(b.x, b.y);
    if (b.trail.length > TRAIL_POINTS * 2) b.trail.splice(0, 2);
  }
}

export function totals(bodies: Body[]): { energy: number; angularMomentum: number } {
  let energy = 0;
  let angularMomentum = 0;
  bodies.forEach((p, i) => {
    energy += 0.5 * p.m * (p.vx * p.vx + p.vy * p.vy);
    angularMomentum += p.m * (p.x * p.vy - p.y * p.vx);
    for (let j = i + 1; j < bodies.length; j++) {
      const q = bodies[j];
      energy -= (G * p.m * q.m) / Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + SOFTENING ** 2);
    }
  });
  return { energy, angularMomentum };
}

/** Orbital elements of `b` around `host` (two-body approximation). */
export function orbitOf(b: Body, host: Body): { a: number; e: number; period: number | null; bound: boolean } {
  const mu = G * (host.m + b.m);
  const [rx, ry] = [b.x - host.x, b.y - host.y];
  const [vx, vy] = [b.vx - host.vx, b.vy - host.vy];
  const r = Math.hypot(rx, ry);
  const energy = (vx * vx + vy * vy) / 2 - mu / r;
  const h = rx * vy - ry * vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
  const bound = energy < 0;
  const a = -mu / (2 * energy);
  return { a, e, period: bound ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : null, bound };
}

/** Velocity for a circular orbit around `host`, counter-clockwise on screen. */
export function circularVelocity(x: number, y: number, host: Body): [number, number] {
  const [rx, ry] = [x - host.x, y - host.y];
  const r = Math.hypot(rx, ry);
  const v = Math.sqrt((G * host.m) / r);
  return [host.vx + (ry / r) * v, host.vy - (rx / r) * v];
}

export function heaviest(bodies: Body[]): Body | undefined {
  return bodies.reduce<Body | undefined>((best, b) => (!best || b.m > best.m ? b : best), undefined);
}

export type Preset = "solar" | "binary" | "figure8";

export function preset(name: Preset): Body[] {
  if (name === "solar") {
    const sun = makeBody(0, 0, 0, 0, 4000, true, 45);
    const planets = [70, 110, 160, 230, 310].map((r, i) => {
      const [vx, vy] = circularVelocity(r, 0, sun);
      return makeBody(r, 0, vx, vy, [1, 3, 4, 12, 8][i], false, [20, 200, 120, 30, 260][i]);
    });
    return [sun, ...planets];
  }
  if (name === "binary") {
    const m = 2000;
    const d = 160;
    const v = Math.sqrt((G * m) / (2 * d));
    const planet = makeBody(0, -340, Math.sqrt((G * 2 * m) / 340), 0, 3, false, 190);
    return [makeBody(-d / 2, 0, 0, v, m, true, 30), makeBody(d / 2, 0, 0, -v, m, true, 210), planet];
  }
  // Chenciner–Montgomery figure-eight: three equal masses chasing each other.
  const [L, m] = [180, 1500];
  const s = Math.sqrt((G * m) / L);
  const [x1, y1, vx3, vy3] = [-0.97000436, 0.24308753, -0.93240737, -0.86473146];
  return [
    makeBody(x1 * L, y1 * L, (-vx3 / 2) * s, (-vy3 / 2) * s, m, true, 0),
    makeBody(-x1 * L, -y1 * L, (-vx3 / 2) * s, (-vy3 / 2) * s, m, true, 120),
    makeBody(0, 0, vx3 * s, vy3 * s, m, true, 240),
  ];
}

/** Future path of a body launched now (others move too), stopping if it hits something. */
export function predict(bodies: Body[], launched: Body, steps: number, dt: number): number[] {
  const copy = [...bodies.map((b) => ({ ...b, trail: [] })), { ...launched, trail: [] }];
  const me = copy[copy.length - 1];
  const path: number[] = [];
  for (let k = 0; k < steps; k++) {
    step(copy, dt);
    if (k % 3 === 0) path.push(me.x, me.y);
    if (copy.some((b) => b !== me && Math.hypot(b.x - me.x, b.y - me.y) < b.r + me.r)) break;
  }
  return path;
}
