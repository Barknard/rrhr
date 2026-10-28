import { applyDamage, NITRO_MAX, NITRO_TIME } from './damage.js';
import { touching } from '../physics/collide.js';
import { WEAPONS } from './weapons.js';
import { BALANCE } from './balance.js';

export const CRATE_RESPAWN = 8;     // s
export const BOMB_FUSE = 4;         // s
const CRATE_RADIUS = 0.75;
const CRATE_SIDE = 1.3;             // crates sit in pairs this far either side of the centerline
const BONUS_SHOTS = 2;
const BOMB = BALANCE.bomb;
const PAD = { reach: 0.6, vz: 38, speedMul: 1.25, cooldown: 1.5 };
const TUMBLE = { angle: Math.cos((50 * Math.PI) / 180), keep: 0.35, dmg: 10 };
const WEAPON_KEYS = Object.keys(WEAPONS);

const alive = c => !c.wrecked && !c.fallen && !c.flying; // a car flying off the track can't be hit

export function rollCrate(rng) {
  const r = rng();
  if (r < 0.6) return { kind: 'bonus', weapon: WEAPON_KEYS[Math.floor(rng() * WEAPON_KEYS.length)] };
  if (r < 0.85) return { kind: 'turbo' };
  return { kind: 'bomb' };
}

export function grantCrate(race, car, content) {
  if (content.kind === 'bomb' && car.bomb) content = { kind: 'bonus', weapon: WEAPON_KEYS[Math.floor(race.rng() * WEAPON_KEYS.length)] };
  if (content.kind === 'bonus') car.bonus = { weapon: content.weapon, shots: BONUS_SHOTS };
  else if (content.kind === 'turbo') { car.nitro = NITRO_MAX; car.boostTimer = NITRO_TIME; }
  else car.bomb = { fuse: BOMB_FUSE, cooldown: 0, from: null };
  race.events.push({ type: 'pickup', car, content });
}

export function setupPickups(race) {
  const { track } = race, def = track.def;
  race.crates = (def.crates ?? []).flatMap(s => {
    const p = track.pointAt(s), nx = -Math.sin(p.dir), ny = Math.cos(p.dir);
    return [-1, 1].map(side => ({ s, x: p.x + nx * side * CRATE_SIDE, y: p.y + ny * side * CRATE_SIDE, z: p.h, active: true, timer: 0 }));
  });
  race.pads = (def.pads ?? []).map(s => { const p = track.pointAt(s); return { s, x: p.x, y: p.y, z: p.h, dir: p.dir }; });
}

function explodeBomb(race, car) {
  const bomb = car.bomb;
  car.bomb = null;
  for (const c of race.cars) {
    if (c === car || !alive(c) || Math.hypot(c.x - car.x, c.y - car.y) > BOMB.splash) continue;
    applyDamage(race, c, BOMB.splashDmg, bomb.from ?? car, 'bomb');
  }
  race.events.push({ type: 'explosion', x: car.x, y: car.y, z: car.z, cause: 'bomb', car });
  applyDamage(race, car, BOMB.holderDmg, bomb.from, 'bomb');
}

// Race system: crates, the hot-potato bomb, launch pads and bad landings.
export const pickupSystem = {
  after(race, inputs, dt) {
    const { track } = race;
    for (const crate of race.crates) {
      if (!crate.active) { if ((crate.timer -= dt) <= 0) crate.active = true; continue; }
      const car = race.cars.find(c => alive(c) && Math.hypot(c.x - crate.x, c.y - crate.y) < CRATE_RADIUS && Math.abs(c.z - crate.z) < 12);
      if (car) { crate.active = false; crate.timer = CRATE_RESPAWN; grantCrate(race, car, rollCrate(race.rng)); }
    }

    for (const car of race.cars) {
      if (!car.bomb) continue;
      if (!alive(car)) { car.bomb = null; continue; }
      car.bomb.fuse -= dt;
      car.bomb.cooldown -= dt;
      if (car.bomb.fuse <= 0) { explodeBomb(race, car); continue; }
      if (car.bomb.cooldown > 0) continue;
      const other = race.cars.find(c => c !== car && alive(c) && !c.bomb && touching(c, car, BOMB.passRange));
      if (other) {
        other.bomb = { fuse: car.bomb.fuse, cooldown: BOMB.passCooldown, from: car };
        car.bomb = null;
        race.events.push({ type: 'bombPass', car, target: other });
      }
    }

    for (const car of race.cars) {
      if (!alive(car)) continue;
      car.padCooldown = Math.max(0, (car.padCooldown ?? 0) - dt);
      if (car.launched && car.grounded) {
        car.launched = false;
        const sp = Math.hypot(car.vx, car.vy);
        if (sp > 1 && !car.stats.crusher && (car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading)) / sp < TUMBLE.angle) {
          car.vx *= TUMBLE.keep; car.vy *= TUMBLE.keep;
          applyDamage(race, car, TUMBLE.dmg, null, 'tumble');
          race.events.push({ type: 'tumble', car });
        }
      }
      if (!car.grounded || car.padCooldown > 0) continue;
      for (const pad of race.pads) {
        const p = track.project(car.x, car.y);
        if (Math.abs(p.s - pad.s) > PAD.reach) continue;
        const sp = Math.hypot(car.vx, car.vy);
        const along = car.vx * Math.cos(pad.dir) + car.vy * Math.sin(pad.dir);
        if (sp < 0.5 || along < 0.5) continue; // only launches cars moving forward along the track
        const target = Math.max(sp, car.stats.maxSpeed) * PAD.speedMul;
        car.vx *= target / sp; car.vy *= target / sp;
        car.vz = PAD.vz; car.grounded = false; car.launched = true; car.padCooldown = PAD.cooldown;
        race.events.push({ type: 'launch', car });
        break;
      }
    }
  },
};
