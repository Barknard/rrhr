import { applyDamage } from './damage.js';
import { gapTo } from '../physics/collide.js';
import { BALANCE } from './balance.js';

// The five weapons. Every car carries one forward and one dropped weapon (its loadout);
// crates add bonus shots of any weapon on top.
export const WEAPONS = {
  arc:     { slot: 'forward', name: 'ARC COIL' },
  saw:     { slot: 'forward', name: 'BUZZSAW' },
  harpoon: { slot: 'forward', name: 'HARPOON' },
  mine:    { slot: 'drop',    name: 'GRAVITY MINE' },
  napalm:  { slot: 'drop',    name: 'NAPALM SLICK' },
};

const ARC = { ...BALANCE.arc, cone: Math.cos((BALANCE.arc.coneDeg * Math.PI) / 180) };
const { saw: SAW, harpoon: HARPOON, mine: MINE, napalm: NAPALM } = BALANCE;
const HIT_HEIGHT = 14; // px: projectiles pass over/under cars further apart than this

const alive = c => !c.wrecked && !c.fallen && !c.flying; // a car flying off the track can't be hit
const fwd = car => [Math.cos(car.heading), Math.sin(car.heading)];
const knockOf = c => c.stats.knockMul ?? 1;

export function behindOnRoad(race, car, back) {
  const [dx, dy] = fwd(car);
  const x = car.x - dx * back, y = car.y - dy * back;
  return race.track.isDrivable(x, y) ? [x, y] : [car.x, car.y];
}

const LAUNCH = {
  arc(race, car) {
    const [dx, dy] = fwd(car);
    const cands = race.cars.filter(c => c !== car && alive(c) && Math.abs(c.z - car.z) < 20);
    let first = null, best = Infinity;
    for (const c of cands) {
      const rx = c.x - car.x, ry = c.y - car.y, d = Math.hypot(rx, ry);
      if (d > ARC.range || d < 1e-6 || (rx * dx + ry * dy) / d < ARC.cone) continue;
      if (d < best) { best = d; first = c; }
    }
    const points = [[car.x, car.y, car.z + 6]];
    const targets = [];
    if (first) {
      targets.push(first);
      while (targets.length < 1 + ARC.links) {
        const cur = targets[targets.length - 1];
        let next = null, nd = ARC.chain;
        for (const c of cands) {
          if (targets.includes(c)) continue;
          const d = Math.hypot(c.x - cur.x, c.y - cur.y);
          if (d <= nd) { nd = d; next = c; }
        }
        if (!next) break;
        targets.push(next);
      }
      for (const c of targets) points.push([c.x, c.y, c.z + 6]);
      targets.forEach((c, i) => applyDamage(race, c, (i ? ARC.chainDmg : ARC.dmg) * (c.stats.arcWeak ?? 1), car, 'arc'));
    } else {
      points.push([car.x + dx * 4, car.y + dy * 4, car.z + 6]); // fizzles into the air
    }
    race.events.push({ type: 'zap', car, points, targets });
  },
  saw(race, car) {
    const [dx, dy] = fwd(car);
    race.entities.push({ type: 'saw', owner: car, x: car.x + dx * 0.6, y: car.y + dy * 0.6, z: car.z + 4,
      vx: dx * SAW.speed, vy: dy * SAW.speed, age: 0, bounces: 0 });
  },
  harpoon(race, car) {
    const [dx, dy] = fwd(car);
    race.entities.push({ type: 'harpoon', owner: car, x: car.x + dx * 0.5, y: car.y + dy * 0.5, z: car.z + 5,
      vx: dx * HARPOON.speed, vy: dy * HARPOON.speed, traveled: 0 });
  },
  mine(race, car) {
    const [x, y] = behindOnRoad(race, car, 1.0);
    const g = race.track.groundAt(x, y);
    race.entities.push({ type: 'mine', owner: car, x, y, z: Number.isFinite(g) ? g : car.z, age: 0 });
  },
  napalm(race, car) {
    car.napalm = { left: NAPALM.patches, timer: 0 };
  },
};

export function fire(race, car, slot) {
  if (!alive(car)) return false;
  let weapon;
  if (car.bonus && WEAPONS[car.bonus.weapon].slot === slot) {
    weapon = car.bonus.weapon;
    if (--car.bonus.shots <= 0) car.bonus = null;
  } else if (car.charges[slot] > 0) {
    car.charges[slot]--;
    weapon = car.loadout[slot];
  } else {
    return false;
  }
  LAUNCH[weapon](race, car);
  race.events.push({ type: 'fire', car, weapon });
  return true;
}

function explode(race, e, cause) {
  for (const c of race.cars) {
    if (!alive(c)) continue;
    const dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy);
    if (d > MINE.blast) continue;
    if (d > 1e-6) { c.vx += (dx / d) * MINE.knock * knockOf(c); c.vy += (dy / d) * MINE.knock * knockOf(c); }
    applyDamage(race, c, MINE.dmg, e.owner, cause);
  }
  race.events.push({ type: 'explosion', x: e.x, y: e.y, z: e.z, cause, car: e.owner });
}

function stepSaw(race, e, dt) {
  const track = race.track, lim = track.halfWidth - 0.15;
  e.age += dt;
  const n = Math.max(1, Math.ceil((SAW.speed * dt) / 0.2));
  for (let k = 0; k < n; k++) {
    e.x += (e.vx * dt) / n; e.y += (e.vy * dt) / n;
    const p = track.project(e.x, e.y);
    if (p.dist > lim) {
      const nx = (e.x - p.px) / p.dist, ny = (e.y - p.py) / p.dist;
      e.x = p.px + nx * lim; e.y = p.py + ny * lim;
      const vn = e.vx * nx + e.vy * ny;
      if (vn > 0) { e.vx -= 2 * vn * nx; e.vy -= 2 * vn * ny; e.bounces++; race.events.push({ type: 'sawBounce', x: e.x, y: e.y, z: e.z }); }
    }
    const g = track.groundAt(e.x, e.y);
    if (Number.isFinite(g)) e.z = g + 4;
    for (const c of race.cars) {
      if (!alive(c) || (c === e.owner && e.age < SAW.safe)) continue;
      if (gapTo(c, e.x, e.y) < SAW.r && Math.abs(c.z + 4 - e.z) < HIT_HEIGHT) {
        const sp = Math.hypot(e.vx, e.vy);
        c.vx += (e.vx / sp) * SAW.knock * knockOf(c); c.vy += (e.vy / sp) * SAW.knock * knockOf(c);
        applyDamage(race, c, SAW.dmg, e.owner, 'saw');
        race.events.push({ type: 'sawHit', x: e.x, y: e.y, z: e.z, car: e.owner, target: c });
        e.dead = true;
        return;
      }
    }
  }
  if (e.age > SAW.life || e.bounces > SAW.bounces) { e.dead = true; race.events.push({ type: 'sawBreak', x: e.x, y: e.y, z: e.z }); }
}

function stepHarpoon(race, e, dt) {
  const n = Math.max(1, Math.ceil((HARPOON.speed * dt) / 0.2));
  for (let k = 0; k < n; k++) {
    e.x += (e.vx * dt) / n; e.y += (e.vy * dt) / n;
    e.traveled += (HARPOON.speed * dt) / n;
    if (!race.track.isDrivable(e.x, e.y) || e.traveled > HARPOON.range) { e.dead = true; return; }
    for (const c of race.cars) {
      if (c === e.owner || !alive(c)) continue;
      if (gapTo(c, e.x, e.y) < HARPOON.r && Math.abs(c.z + 5 - e.z) < HIT_HEIGHT) {
        const o = e.owner, dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (alive(o)) { o.vx += (dx / d) * HARPOON.reel; o.vy += (dy / d) * HARPOON.reel; }
        const resist = c.stats.spinResist ?? 0, slow = HARPOON.slow + (1 - HARPOON.slow) * resist;
        c.heading += HARPOON.spin * (1 - resist);
        c.vx *= slow; c.vy *= slow;
        applyDamage(race, c, HARPOON.dmg, o, 'harpoon');
        race.events.push({ type: 'harpoon', car: o, target: c });
        e.dead = true;
        return;
      }
    }
  }
}

function stepMine(race, e, dt) {
  e.age += dt;
  if (e.age > MINE.life) { e.dead = true; return; }
  if (e.age < MINE.arm) return;
  for (const c of race.cars) {
    if (!alive(c) || c.stats.hover) continue;
    const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
    if (d < MINE.trigger) { explode(race, e, 'mine'); e.dead = true; return; }
    if (d < MINE.pull) { c.vx += (dx / d) * MINE.pullAccel * dt; c.vy += (dy / d) * MINE.pullAccel * dt; }
  }
}

function stepFire(race, e, dt, burned) {
  e.age += dt;
  if (e.age > NAPALM.life) { e.dead = true; return; }
  for (const c of race.cars) {
    if (c === e.owner || !alive(c) || c.stats.hover || burned.has(c)) continue;
    if (gapTo(c, e.x, e.y) < NAPALM.r && Math.abs(c.z - e.z) < HIT_HEIGHT) {
      burned.add(c);
      applyDamage(race, c, NAPALM.dps * (e.damageMul ?? 1) * dt, e.owner, 'napalm');
    }
  }
}

// Race system: fire on button presses (one shot per press), lay napalm, move/resolve entities.
export const weaponSystem = {
  before(race, inputs, dt) {
    race.cars.forEach((car, i) => {
      if (!alive(car) || car.finished) return; // finished cars cruise home, they don't shoot
      const input = inputs[i] ?? {}, prev = car.prevInput ?? {};
      for (const [key, slot] of [['fire', 'forward'], ['drop', 'drop']]) { // a press on empty is reported, so the HUD can say so
        if (input[key] && !prev[key] && !fire(race, car, slot)) race.events.push({ type: 'empty', car, slot });
      }
      if (car.napalm) {
        car.napalm.timer -= dt;
        if (car.napalm.timer <= 0) {
          const [x, y] = behindOnRoad(race, car, 0.8);
          race.entities.push({ type: 'fire', owner: car, x, y, z: car.z, age: 0 });
          car.napalm.timer = NAPALM.every;
          if (--car.napalm.left <= 0) car.napalm = null;
        }
      }
    });
  },
  after(race, inputs, dt) {
    const burned = new Set();
    for (const e of race.entities) {
      if (e.type === 'saw') stepSaw(race, e, dt);
      else if (e.type === 'harpoon') stepHarpoon(race, e, dt);
      else if (e.type === 'mine') stepMine(race, e, dt);
      else if (e.type === 'fire') stepFire(race, e, dt, burned);
    }
    race.entities = race.entities.filter(e => !e.dead);
  },
};
