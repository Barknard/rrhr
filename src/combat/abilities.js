import { applyDamage } from './damage.js';
import { gapTo } from '../physics/collide.js';

// Vehicle-specific mechanics (see carStats extras): Last Ride's ram, Demo Derrick's wrecking ball and
// Rattler's trailers. Simulation state, so the host decides it like everything else; it is all plain
// data (cooldowns keyed by car id) so a race snapshot can be sent as JSON.
export const RAM = { cooldown: 0.5 };
export const MOMENTUM_AFTER = 3;          // s flat out without touching a wall before Hellwheel's bonus kicks in
const NOSE_CONE = Math.cos((50 * Math.PI) / 180);
export const BALL = { chain: 1.4, r: 0.2, dmg: 10, shove: 2.5, cooldown: 1, maxSwing: 1.4 };
export const TRAILER = { gap: 1.0, count: 2, r: 0.45, shove: 3, grace: 1.5 }; // grace: no shoves while leaving the grid

const alive = c => !c.wrecked && !c.fallen && !c.flying; // a car flying off the track can't be hit

// Registered in race.onBump: a rammer deals impact × ram damage to whoever it hits (impact = closing
// speed in tiles/s), once per pair per cooldown.
// Grinder's nose saw does the same with a flat amount, but only when it hits nose-first. Boneshaker's monster
// tires shrug both off.
export function ramOnBump(race, a, b, impact) {
  for (const [hitter, victim] of [[a, b], [b, a]]) {
    if (!alive(victim) || victim.stats.crusher) continue;
    const ram = hitter.stats.ram, saw = hitter.stats.noseSaw && noseFirst(hitter, victim);
    if (!ram && !saw) continue;
    race.ramCool ??= {};
    const key = `${hitter.id}>${victim.id}`;
    if ((race.ramCool[key] ?? -Infinity) > race.time) continue;
    race.ramCool[key] = race.time + RAM.cooldown;
    if (ram) {
      applyDamage(race, victim, impact * ram, hitter, 'ram');
      race.events.push({ type: 'ram', car: hitter, target: victim, impact });
    } else {
      applyDamage(race, victim, hitter.stats.noseSaw, hitter, 'saw');
      race.events.push({ type: 'sawHit', car: hitter, target: victim, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: hitter.z + 4 });
    }
  }
}

// The other car is in front of the hitter's nose (within about 50 degrees of straight ahead).
function noseFirst(hitter, victim) {
  const dx = victim.x - hitter.x, dy = victim.y - hitter.y, d = Math.hypot(dx, dy) || 1;
  return (dx * Math.cos(hitter.heading) + dy * Math.sin(hitter.heading)) / d > NOSE_CONE;
}

// Registered in race.onLap after the normal refill: Hog & Hitch's sidecar gunner brings extra shots.
export function gunnerOnLap(race, car) {
  if (car.stats.gunner) car.charges.forward += car.stats.gunner;
}

const newBall = car => ({ angle: 0, angV: 0, prevH: car.heading, hits: {}, down: false, x: car.x, y: car.y, z: car.z });

function stepBall(race, car, dt) {
  const b = (car.ball ??= newBall(car));
  const down = !alive(car);
  if (b.down && !down) Object.assign(b, { angle: 0, angV: 0, prevH: car.heading }); // respawned: hang straight behind
  b.down = down;
  const yaw = Math.atan2(Math.sin(car.heading - b.prevH), Math.cos(car.heading - b.prevH));
  b.prevH = car.heading;
  // The ball lags behind when the truck turns, then swings back on its chain.
  const speed = Math.hypot(car.vx, car.vy);
  b.angle -= yaw;
  b.angV += (-(4 + speed * 1.5) * Math.sin(b.angle) - 1.2 * b.angV) * dt;
  b.angle = Math.max(-BALL.maxSwing, Math.min(BALL.maxSwing, b.angle + b.angV * dt));
  const back = car.heading + Math.PI + b.angle;
  b.x = car.x + Math.cos(back) * BALL.chain; b.y = car.y + Math.sin(back) * BALL.chain; b.z = car.z;
  if (!alive(car)) return;
  for (const c of race.cars) {
    if (c === car || !alive(c) || Math.abs(c.z - car.z) > 12) continue;
    const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy);
    if (gapTo(c, b.x, b.y) > BALL.r || (b.hits[c.id] ?? -Infinity) > race.time) continue;
    b.hits[c.id] = race.time + BALL.cooldown;
    const nx = d > 1e-6 ? dx / d : -Math.cos(back), ny = d > 1e-6 ? dy / d : -Math.sin(back);
    const k = BALL.shove * (c.stats.knockMul ?? 1);
    c.vx += nx * k; c.vy += ny * k;
    applyDamage(race, c, BALL.dmg, car, 'ball');
    race.events.push({ type: 'ball', car, target: c, x: b.x, y: b.y, z: b.z });
  }
}

// Trailers follow the cab's own path (a breadcrumb trail), so they track the road through corners.
function stepTrailers(race, car) {
  const path = (car.trailerPath ??= []);
  const last = path[0], down = !alive(car);
  if (!last || Math.hypot(car.x - last.x, car.y - last.y) > 1.5 || (car.trailersDown && !down)) path.length = 0; // first step or a respawn
  car.trailersDown = down;
  if (!path.length || Math.hypot(car.x - path[0].x, car.y - path[0].y) > 0.05) path.unshift({ x: car.x, y: car.y, z: car.z });
  const need = TRAILER.gap * TRAILER.count + 1;
  // walk back along the trail; past its end, carry on straight behind the cab
  const along = dist => {
    let px = car.x, py = car.y, pz = car.z, left = dist;
    for (const p of path) {
      const seg = Math.hypot(p.x - px, p.y - py);
      if (seg >= left && seg > 1e-9) { const f = left / seg; return { x: px + (p.x - px) * f, y: py + (p.y - py) * f, z: pz + (p.z - pz) * f }; }
      left -= seg; px = p.x; py = p.y; pz = p.z;
    }
    const tail = path.length > 1 ? Math.atan2(path[path.length - 1].y - path[path.length - 2].y, path[path.length - 1].x - path[path.length - 2].x) : car.heading + Math.PI;
    return { x: px + Math.cos(tail) * left, y: py + Math.sin(tail) * left, z: pz };
  };
  let total = 0;
  for (let i = 1; i < path.length; i++) { total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); if (total > need) { path.length = i + 1; break; } }
  car.trailers = [];
  let front = { x: car.x, y: car.y };
  for (let i = 1; i <= TRAILER.count; i++) {
    const p = along(TRAILER.gap * i);
    const heading = Math.hypot(front.x - p.x, front.y - p.y) > 1e-6 ? Math.atan2(front.y - p.y, front.x - p.x) : car.heading;
    car.trailers.push({ x: p.x, y: p.y, z: p.z, heading });
    front = p;
  }
  if (down || race.time < TRAILER.grace) return;
  for (const t of car.trailers) {
    const nx = -Math.sin(t.heading), ny = Math.cos(t.heading);
    for (const c of race.cars) {
      if (c === car || !alive(c) || Math.abs(c.z - t.z) > 12) continue;
      const dx = c.x - t.x, dy = c.y - t.y;
      if (Math.hypot(dx, dy) > TRAILER.r) continue;
      const side = dx * nx + dy * ny >= 0 ? 1 : -1;
      const vn = (c.vx * nx + c.vy * ny) * side;
      if (vn < TRAILER.shove) { c.vx += nx * side * (TRAILER.shove - vn); c.vy += ny * side * (TRAILER.shove - vn); }
    }
  }
}

// Called by createRace so trailers and the ball are there (and drawn) from the grid, before GO.
export function setupAbilities(race) {
  for (const car of race.cars) {
    if (car.stats.ball) stepBall(race, car, 0);
    if (car.stats.trailers) stepTrailers(race, car);
  }
}

export const abilitySystem = {
  // Runs after the combat system has set this step's speedMul (nitro, catch-up), so the bonus stacks on top.
  before(race, inputs, dt) {
    race.cars.forEach((car, i) => {
      if (!car.stats.momentum) return;
      const flatOut = alive(car) && (inputs[i]?.throttle ?? 0) >= 1 && !(car.scrape > 0);
      car.momentumT = flatOut ? (car.momentumT ?? 0) + dt : 0;
      if (car.momentumT >= MOMENTUM_AFTER) car.speedMul *= 1 + car.stats.momentum;
    });
  },
  after(race, inputs, dt) {
    for (const car of race.cars) {
      if (car.stats.ball) stepBall(race, car, dt);
      if (car.stats.trailers) stepTrailers(race, car);
    }
  },
};
