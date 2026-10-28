import { respawn } from '../physics/carPhysics.js';

export const WRECK_TIME = 1.5;       // s out of the race after being blown up
export const NITRO_TIME = 1.2;       // s per nitro charge
export const NITRO_SPEED = 1.5, NITRO_ACCEL = 1.6;
export const CHARGES = { forward: 3, drop: 2 };
export const NITRO_MAX = 3;
const CATCHUP_GAP = 8;               // tiles behind the leader before catch-up kicks in
const CATCHUP_SPEED = 1.06;
const CATCHUP_NITRO_EVERY = 12;      // s: trailing cars regain a nitro charge this often
const KILL_CREDIT_WINDOW = 3;        // s: knocking someone into the pit still counts as yours

export function initCombatCar(car) {
  Object.assign(car, {
    maxArmor: car.stats.armor, armor: car.stats.armor, wrecked: false, wreckTimer: 0,
    charges: { ...CHARGES }, nitro: NITRO_MAX, boostTimer: 0, catchupTimer: 0,
    lastHitBy: null, lastHitTime: -99, wasFallen: false,
  });
}

function wreck(race, car, attacker, cause) {
  car.armor = 0;
  car.wrecked = true;
  car.wreckTimer = WRECK_TIME;
  car.boostTimer = 0;
  car.lastHitBy = null; // this kill is settled; a later pit fall can't credit it again
  if (attacker && attacker !== car) attacker.kills++;
  race.events.push({ type: 'wreck', car, attacker, cause, x: car.x, y: car.y, z: car.z });
  for (const fn of race.onWreck ?? []) fn(race, car, attacker, cause);
}

// After a respawn (from a wreck or out of a pit) a car can't be hurt for a moment: no landing on a mine.
export const SPAWN_SAFE = 1.5; // s

export function applyDamage(race, victim, amount, attacker, cause) {
  if (victim.wrecked || victim.fallen || amount <= 0 || race.time < (victim.safeUntil ?? -1)) return;
  victim.armor -= amount;
  if (attacker && attacker !== victim) { victim.lastHitBy = attacker; victim.lastHitTime = race.time; }
  if (amount >= 1) race.events.push({ type: 'hit', car: victim, attacker, amount, cause });
  if (victim.armor <= 0) wreck(race, victim, attacker, cause);
}

export function refillOnLap(race, car) {
  car.charges = { ...CHARGES };
  car.nitro = NITRO_MAX;
}

// Race system: wreck timers, nitro, catch-up, pit-fall kill credit.
export const combatSystem = {
  before(race, inputs, dt) {
    const leader = Math.max(...race.cars.map(c => c.dist));
    race.cars.forEach((car, i) => {
      if (car.wrecked) {
        car.wreckTimer -= dt;
        if (car.wreckTimer <= 1e-9) {
          respawn(car, race.track);
          car.wrecked = false;
          car.armor = car.maxArmor;
          car.safeUntil = race.time + SPAWN_SAFE;
          race.events.push({ type: 'respawn', car });
        }
        return;
      }
      const input = inputs[i] ?? {};
      if (input.nitro && !car.prevInput.nitro && car.nitro >= 1 && car.boostTimer <= 0 && !car.fallen) {
        car.nitro--;
        car.boostTimer = NITRO_TIME * (1 + (car.stats.nitroBoost ?? 0));
        race.events.push({ type: 'nitro', car });
      }
      if (car.grounded) car.boostTimer = Math.max(0, car.boostTimer - dt); // nitro only pushes on the ground, so it keeps in the air
      const behind = leader - car.dist > CATCHUP_GAP;
      const boosting = car.boostTimer > 0;
      car.speedMul = (boosting ? NITRO_SPEED : 1) * (behind ? CATCHUP_SPEED : 1);
      car.accelMul = boosting ? NITRO_ACCEL : 1;
      if (behind) {
        car.catchupTimer += dt;
        if (car.catchupTimer >= CATCHUP_NITRO_EVERY) { car.catchupTimer = 0; car.nitro = Math.min(NITRO_MAX, car.nitro + 1); }
      } else {
        car.catchupTimer = 0;
      }
    });
  },
  after(race) {
    for (const car of race.cars) {
      if (car.fallen && !car.wasFallen) {
        const by = race.time - car.lastHitTime < KILL_CREDIT_WINDOW ? car.lastHitBy : null;
        if (by) by.kills++;
        race.events.push({ type: 'fell', car, attacker: by });
      }
      if (car.wasFallen && !car.fallen) car.safeUntil = race.time + SPAWN_SAFE; // climbed out of the pit
      car.wasFallen = car.fallen;
    }
  },
};
