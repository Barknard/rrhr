import { createRng } from '../core/rng.js';
import { createCar, stepCar } from '../physics/carPhysics.js';
import { collideCars } from '../physics/collide.js';
import { createLapTracker } from '../track/laps.js';
import { initCombatCar, combatSystem, refillOnLap } from '../combat/damage.js';
import { weaponSystem } from '../combat/weapons.js';
import { pickupSystem, setupPickups } from '../combat/pickups.js';
import { abilitySystem, ramOnBump, gunnerOnLap, setupAbilities } from '../combat/abilities.js';
import { combineStats } from '../drivers/drivers.js';
import { driverSkillSystem } from '../drivers/skills.js';

const FINISH_GRACE = 30;          // s the race keeps going after the first finisher
const COUNTDOWN = 3;

// A whole race: cars, laps, positions and the event stream the renderer/announcer read.
// Consumers drain race.events themselves.
export function createRace({ track, entrants, laps = 4, seed = 1 }) {
  const rng = createRng(seed);
  const L = track.length;
  const cars = entrants.map((e, i) => {
    const row = i >> 1, lane = i & 1 ? 1.1 : -1.1;
    const s = L - 1.5 - row * 2.4;
    const p = track.pointAt(s);
    const car = createCar(e.key, { x: p.x - Math.sin(p.dir) * lane, y: p.y + Math.cos(p.dir) * lane, h: p.h, dir: p.dir });
    if (e.driver) car.stats = combineStats(car.stats, e.driver); // the driver's percentages, before armor is set
    return Object.assign(car, {
      id: i, name: e.name ?? e.key.toUpperCase(), color: e.color, human: !!e.human,
      loadout: { forward: 'arc', drop: 'mine', ...e.loadout },
      dist: s - L, prevS: s, lapTracker: createLapTracker(track), lap: 0,
      finished: false, finishTime: null, kills: 0,
      prevInput: {}, speedMul: 1, accelMul: 1,
    });
  });
  for (const c of cars) { c.lapTracker.update(c.x, c.y); initCombatCar(c); }
  const race = {
    track, cars, laps, rng, time: 0, phase: 'countdown', countdown: COUNTDOWN,
    entities: [], events: [], finishOrder: [], firstFinishTime: null,
    systems: [combatSystem, weaponSystem, pickupSystem, abilitySystem, driverSkillSystem], onLap: [refillOnLap, gunnerOnLap], onBump: [ramOnBump],
  };
  driverSkillSystem.install(race);
  setupPickups(race);
  setupAbilities(race);
  return race;
}

export function standings(race) {
  return [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.dist - a.dist;
  });
}

function trackProgress(race, car) {
  const L = race.track.length;
  const s = race.track.project(car.x, car.y).s;
  let ds = s - car.prevS;
  if (ds > L / 2) ds -= L; else if (ds < -L / 2) ds += L;
  car.dist += ds;
  car.prevS = s;
  if (car.lapTracker.update(car.x, car.y) === 'lap') {
    car.lap = car.lapTracker.lap;
    race.events.push({ type: 'lap', car, lap: car.lap });
    for (const fn of race.onLap ?? []) fn(race, car);
    if (!car.finished && car.lap >= race.laps) {
      car.finished = true; car.finishTime = race.time;
      race.finishOrder.push(car);
      if (race.firstFinishTime === null) race.firstFinishTime = race.time;
      race.events.push({ type: 'finish', car, place: race.finishOrder.length });
    }
  }
}

// inputs[i] = {throttle, steer, fire, drop, nitro} for car i (missing = coast).
export function stepRace(race, inputs, dt) {
  if (race.phase === 'countdown') {
    const before = Math.ceil(race.countdown);
    race.countdown -= dt;
    if (Math.ceil(race.countdown) !== before && race.countdown > 0) race.events.push({ type: 'count', n: Math.ceil(race.countdown) });
    if (race.countdown <= 0) { race.phase = 'racing'; race.events.push({ type: 'go' }); }
    return;
  }
  if (race.phase === 'finished') return; // results are final: the track freezes
  race.time += dt;
  for (const sys of race.systems) sys.before?.(race, inputs, dt);
  race.cars.forEach((car, i) => {
    if (car.wrecked) return;
    const input = inputs[i] ?? {};
    stepCar(car, { throttle: input.throttle ?? 0, steer: input.steer ?? 0 }, dt, race.track);
    car.prevInput = input;
  });
  collideCars(race);
  for (const car of race.cars) if (!car.wrecked && !car.fallen) trackProgress(race, car);
  for (const sys of race.systems) sys.after?.(race, inputs, dt);

  if (race.phase === 'racing') {
    const humans = race.cars.filter(c => c.human);
    const allDone = race.cars.every(c => c.finished) || (humans.length > 0 && humans.length < race.cars.length && humans.every(c => c.finished));
    const graceOver = race.firstFinishTime !== null && race.time - race.firstFinishTime >= FINISH_GRACE - 1e-9;
    if (allDone || graceOver) { race.phase = 'finished'; race.events.push({ type: 'raceOver' }); }
  }
}
