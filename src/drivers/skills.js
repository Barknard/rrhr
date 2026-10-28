import { applyDamage, NITRO_TIME, NITRO_MAX } from '../combat/damage.js';
import { standings } from '../game/race.js';

// The drivers' signature skills, as one race system. It only reads race events and car state (plus the
// onLap/onWreck hooks), so the simulation files stay untouched and everything stays deterministic.
// Tuned with tools/balance-sim.mjs (see docs/balance/).
export const SKILL = { THICK_HIDE: 0.35, CALCULATED: 0.3, MAMA_EVERY: 4, JACKRABBIT: 0.9, OVERCHARGE: 9, BLOODSUCKER: 40, GREASE_DELAY: 5, GREASE_RATE: 1.5 };
const { THICK_HIDE, CALCULATED, MAMA_EVERY, JACKRABBIT, OVERCHARGE, BLOODSUCKER, GREASE_DELAY, GREASE_RATE } = SKILL;

const driverOf = car => car?.stats?.driver;
const alive = car => !car.wrecked && !car.fallen && !car.flying;
const heal = (car, n) => { if (alive(car) && car.armor > 0) car.armor = Math.min(car.maxArmor, car.armor + n); };

function shortFuse(race, car) { if (driverOf(car) === 'dolly') car.charges.drop += 1; }
function bloodsucker(race, car, attacker) { if (attacker && attacker !== car && driverOf(attacker) === 'count') heal(attacker, BLOODSUCKER); }

export const driverSkillSystem = {
  install(race) {
    race.onLap = [...(race.onLap ?? []), shortFuse];
    race.onWreck = [...(race.onWreck ?? []), bloodsucker];
    race.skillSeen = new WeakSet(); // events are drained by the game between steps; this marks the ones handled
    for (const car of race.cars) car.skill = { quiet: 0, mama: 0, started: false, wasFallen: false, lastArmor: car.armor };
  },
  after(race, inputs, dt) {
    for (const e of race.events) {
      if (race.skillSeen.has(e)) continue;
      race.skillSeen.add(e);
      const who = driverOf(e.car);
      if (e.type === 'hit') {
        e.car.skill.quiet = 0;
        if (who === 'vinnie') heal(e.car, e.amount * THICK_HIDE);
      } else if (e.type === 'nitro' && who === 'professor') e.car.boostTimer += NITRO_TIME * CALCULATED;
      else if (e.type === 'respawn' && who === 'juice') e.car.boostTimer = JACKRABBIT;
      else if (e.type === 'fell' && driverOf(e.attacker) === 'count') heal(e.attacker, BLOODSUCKER); // a pit kill counts too
      else if (e.type === 'zap' && who === 'voltage') for (const t of e.targets) if (alive(t)) applyDamage(race, t, OVERCHARGE, e.car, 'arc');
    }
    if (race.phase !== 'racing') return;
    const order = standings(race);
    for (const car of race.cars) {
      const s = car.skill, who = driverOf(car);
      if (!s.started) { s.started = true; if (who === 'juice') car.boostTimer = JACKRABBIT; }
      // pit and lava respawns happen inside the physics without an event, so watch for the car coming back
      if (s.wasFallen && !car.fallen && who === 'juice') car.boostTimer = JACKRABBIT;
      s.wasFallen = car.fallen;
      // any armor loss, including fire ticks too small to raise a hit event, restarts Grease Monkey's wait
      if (car.armor < s.lastArmor - 1e-9) s.quiet = 0;
      if (!alive(car)) { s.lastArmor = car.armor; continue; }
      if (who === 'mama') {
        if (order.indexOf(car) >= Math.ceil(race.cars.length / 2) && !car.finished) { // back half: 3rd or 4th of four
          if ((s.mama += dt) >= MAMA_EVERY - 1e-9) { s.mama = 0; car.nitro = Math.min(NITRO_MAX, car.nitro + 1); }
        } else s.mama = 0;
      }
      if (who === 'sprocket') {
        s.quiet += dt;
        if (s.quiet >= GREASE_DELAY) heal(car, GREASE_RATE * dt);
      }
      s.lastArmor = car.armor;
    }
  },
};
