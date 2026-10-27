import { WEAPONS } from '../combat/weapons.js';

// Computer drivers: follow a racing line in their own lane, brake for sharp corners,
// shoot at cars ahead, drop on cars behind, use nitro on straights, back out when stuck.
// Good enough to fight for position; no cheating (same physics and rules as players).
const FIRE_RANGE = { arc: 6.5, saw: 10, harpoon: 8.5 };
const FIRE_CONE = { arc: Math.cos(0.45), saw: Math.cos(0.22), harpoon: Math.cos(0.2) };
const DROP_RANGE = 3.2;

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const alive = c => !c.wrecked && !c.fallen;

function brain(race, car) {
  if (!car.ai) {
    car.ai = {
      lane: (car.id % 2 ? 1 : -1) * (0.4 + race.rng() * 0.6),
      laneTimer: 2 + race.rng() * 3,
      aimTimer: 0, dropTimer: 0, nitroTimer: 1 + race.rng() * 2,
      stuck: 0, reverse: 0, last: {},
    };
  }
  return car.ai;
}

function seen(car, other, range, cone) {
  const dx = other.x - car.x, dy = other.y - car.y, d = Math.hypot(dx, dy);
  if (d > range || d < 1e-6 || Math.abs(other.z - car.z) > 16) return false;
  return (dx * Math.cos(car.heading) + dy * Math.sin(car.heading)) / d >= cone;
}

export function cpuInput(race, car, dt) {
  const ai = brain(race, car);
  const out = { throttle: 0, steer: 0, fire: false, drop: false, nitro: false };
  if (race.phase !== 'racing' || !alive(car)) { ai.last = out; return out; }
  const { track } = race;
  const sp = Math.hypot(car.vx, car.vy);
  const p = track.project(car.x, car.y);

  // drift between lanes now and then so the pack spreads out
  if ((ai.laneTimer -= dt) <= 0) { ai.laneTimer = 2 + race.rng() * 4; ai.lane = clamp(ai.lane + (race.rng() - 0.5) * 1.6, -1.3, 1.3); }

  // steer at a point ahead on the racing line (or at a victim when carrying the bomb)
  const look = 2 + sp * 0.35;
  const tgt = track.pointAt(p.s + look);
  let tx = tgt.x - Math.sin(tgt.dir) * ai.lane, ty = tgt.y + Math.cos(tgt.dir) * ai.lane;
  if (car.bomb) {
    const victim = race.cars.filter(c => c !== car && alive(c) && !c.bomb && seen(car, c, 6, 0.3))
      .sort((a, b) => Math.hypot(a.x - car.x, a.y - car.y) - Math.hypot(b.x - car.x, b.y - car.y))[0];
    if (victim) { tx = victim.x; ty = victim.y; }
  }
  const err = wrap(Math.atan2(ty - car.y, tx - car.x) - car.heading);
  out.steer = clamp(err * 3, -1, 1);

  // speed: lift or brake when the road ahead turns hard
  const bend = Math.abs(wrap(track.pointAt(p.s + 4 + sp * 0.6).dir - tgt.dir));
  const max = car.stats.maxSpeed;
  out.throttle = 1;
  if (bend > 1.5 && sp > max * 0.6) out.throttle = -0.6;
  else if (bend > 0.9 && sp > max * 0.75) out.throttle = 0;
  if (Math.abs(err) > 1.3 && sp > 2) out.throttle = Math.min(out.throttle, 0.3);

  // unstick: back up with opposite lock for a moment
  if (car.grounded && sp < 0.8) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 1.0) { ai.reverse = 0.7; ai.stuck = 0; }
  if (ai.reverse > 0) { ai.reverse -= dt; out.throttle = -1; out.steer = -Math.sign(err || 1); }

  // weapons: a short reaction delay once a target lines up, one press per shot
  const fwdWeapon = car.bonus && WEAPONS[car.bonus.weapon].slot === 'forward' ? car.bonus.weapon : car.loadout.forward;
  const canFire = (car.bonus && WEAPONS[car.bonus.weapon].slot === 'forward') || car.charges.forward > 0;
  const lined = canFire && race.cars.some(c => c !== car && alive(c) && seen(car, c, FIRE_RANGE[fwdWeapon], FIRE_CONE[fwdWeapon]));
  if (lined) { ai.aimTimer += dt; if (ai.aimTimer > 0.25 + race.rng() * 0.3 && !ai.last.fire) { out.fire = true; ai.aimTimer = 0; } } else ai.aimTimer = 0;

  const canDrop = (car.bonus && WEAPONS[car.bonus.weapon].slot === 'drop') || car.charges.drop > 0;
  const tail = race.cars.some(c => c !== car && alive(c) && seen({ ...car, heading: car.heading + Math.PI }, c, DROP_RANGE, 0.5));
  ai.dropTimer -= dt;
  if (canDrop && tail && ai.dropTimer <= 0 && !ai.last.drop) { out.drop = true; ai.dropTimer = 1.5; }

  // nitro on straights
  ai.nitroTimer -= dt;
  const straightAhead = Math.abs(wrap(track.pointAt(p.s + 12).dir - track.pointAt(p.s).dir)) < 0.25;
  if (car.nitro > 0 && car.boostTimer <= 0 && straightAhead && sp > max * 0.6 && ai.nitroTimer <= 0 && !ai.last.nitro) {
    out.nitro = true; ai.nitroTimer = 3 + race.rng() * 4;
  }

  ai.last = out;
  return out;
}
