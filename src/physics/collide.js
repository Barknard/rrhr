// Car-to-car collision with each vehicle's real footprint: an oriented box (stats.size = [length, width] in
// tiles) instead of a small circle, so cars touch where they look like they touch. Overlap is found with the
// separating-axis test; the push-out and bounce are shared by mass, and an off-centre hit kicks the struck car's
// heading (a T-bone spins you), capped so it never turns into a pirouette.
const RESTITUTION = 0.4;
const SPIN_PER_IMPULSE = 0.35, SPIN_MAX = 0.35; // rad of heading per unit of (impulse x lever arm / mass)
const MAX_DZ = 10;                               // px: cars further apart in height pass over each other
const DEFAULT_SIZE = [0.7, 0.7];

export function footprint(car) {
  const [len, wid] = car.stats?.size ?? DEFAULT_SIZE;
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  return { x: car.x, y: car.y, ux: c, uy: s, vx: -s, vy: c, hl: len / 2, hw: wid / 2 };
}

const radius = (b, ax, ay) => b.hl * Math.abs(b.ux * ax + b.uy * ay) + b.hw * Math.abs(b.vx * ax + b.vy * ay);

// Smallest push that separates the boxes, as { nx, ny, depth } with n pointing from a to b, or null.
export function boxOverlap(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let best = null;
  for (const [ax, ay] of [[a.ux, a.uy], [a.vx, a.vy], [b.ux, b.uy], [b.vx, b.vy]]) {
    const dist = dx * ax + dy * ay, depth = radius(a, ax, ay) + radius(b, ax, ay) - Math.abs(dist);
    if (depth <= 0) return null;
    if (!best || depth < best.depth) best = { nx: dist < 0 ? -ax : ax, ny: dist < 0 ? -ay : ay, depth };
  }
  return best;
}

// Distance from a point to a car's body (0 inside it): what projectiles and the wrecking ball test against.
export function gapTo(car, x, y) {
  const f = footprint(car), dx = x - f.x, dy = y - f.y;
  const ex = Math.max(0, Math.abs(dx * f.ux + dy * f.uy) - f.hl), ey = Math.max(0, Math.abs(dx * f.vx + dy * f.vy) - f.hw);
  return Math.hypot(ex, ey);
}

// Bodies within `margin` of each other (passing the hot-potato bomb takes contact, not centres close together).
export function touching(a, b, margin = 0) {
  const grow = f => ({ ...f, hl: f.hl + margin / 2, hw: f.hw + margin / 2 });
  return !!boxOverlap(grow(footprint(a)), grow(footprint(b)));
}

const sgn = v => (v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0);
// The box's furthest point along (dx, dy): a corner, or the middle of an edge facing straight that way.
const support = (b, dx, dy) => [
  b.x + b.ux * b.hl * sgn(b.ux * dx + b.uy * dy) + b.vx * b.hw * sgn(b.vx * dx + b.vy * dy),
  b.y + b.uy * b.hl * sgn(b.ux * dx + b.uy * dy) + b.vy * b.hw * sgn(b.vx * dx + b.vy * dy),
];
const clamp = (v, m) => Math.max(-m, Math.min(m, v));

export function collidePair(race, a, b) {
  if (a.wrecked || b.wrecked || a.fallen || b.fallen || a.flying || b.flying || Math.abs(a.z - b.z) > MAX_DZ) return;
  const fa = footprint(a), fb = footprint(b), hit = boxOverlap(fa, fb);
  if (!hit) return;
  const { nx, ny, depth } = hit, ma = a.stats.mass, mb = b.stats.mass;
  a.x -= nx * depth * mb / (ma + mb); a.y -= ny * depth * mb / (ma + mb);
  b.x += nx * depth * ma / (ma + mb); b.y += ny * depth * ma / (ma + mb);
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return; // already separating
  const j = (-(1 + RESTITUTION) * rel) / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
  b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
  // where they touch: halfway between a's leading point and b's leading point
  const [pax, pay] = support(fa, nx, ny), [pbx, pby] = support(fb, -nx, -ny);
  const cx = (pax + pbx) / 2, cy = (pay + pby) / 2;
  const cross = (rx, ry, fx, fy) => rx * fy - ry * fx;
  a.heading += clamp((SPIN_PER_IMPULSE * cross(cx - a.x, cy - a.y, -j * nx, -j * ny)) / ma, SPIN_MAX);
  b.heading += clamp((SPIN_PER_IMPULSE * cross(cx - b.x, cy - b.y, j * nx, j * ny)) / mb, SPIN_MAX);
  if (-rel > 2) race.events.push({ type: 'bump', a, b, impact: -rel });
  for (const fn of race.onBump ?? []) fn(race, a, b, -rel);
}

// Every pair, twice, so a car squeezed between two others ends up clear of both.
export function collideCars(race) {
  const cars = race.cars;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < cars.length; i++) for (let k = i + 1; k < cars.length; k++) collidePair(race, cars[i], cars[k]);
  }
}
