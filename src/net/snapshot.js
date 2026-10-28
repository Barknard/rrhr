import { CAR_STATS } from '../cars/carStats.js';
import { combineStats } from '../drivers/drivers.js';
import { setupPickups } from '../combat/pickups.js';

// The host's race as plain JSON for the wire, and a guest-side "race view" it is poured into. The view is shaped
// like a real race (cars, entities, crates, events, phase...) so the renderer, HUD, effects and mini map draw it
// unchanged. Only what the screen needs travels; numbers are rounded; cars are referred to by id.
const r = (v, k) => (Number.isFinite(v) ? Math.round(v * k) / k : 0);
const r3 = v => r(v, 1000), r2 = v => r(v, 100), r1 = v => r(v, 10);
// JSON silently drops undefined, so optional fields are left out instead of sent empty.
const compact = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function carState(c) {
  return compact({
    x: r3(c.x), y: r3(c.y), z: r2(c.z), vx: r2(c.vx), vy: r2(c.vy), vz: r1(c.vz), h: r3(c.heading),
    g: c.grounded, f: c.fallen, w: c.wrecked, fin: c.finished, ft: c.finishTime === null ? null : r2(c.finishTime),
    armor: r1(c.armor), maxArmor: c.maxArmor, lap: c.lap, dist: r2(c.dist), kills: c.kills,
    charges: { ...c.charges }, nitro: c.nitro, boost: r2(c.boostTimer), loadout: { ...c.loadout },
    bonus: c.bonus ? { ...c.bonus } : null, bomb: c.bomb ? { fuse: r2(c.bomb.fuse) } : null,
    scrape: r2(c.scrape ?? 0), launched: !!c.launched, input: { throttle: c.prevInput?.throttle ?? 0, steer: c.prevInput?.steer ?? 0 },
    trailers: c.trailers?.map(t => ({ x: r3(t.x), y: r3(t.y), z: r2(t.z), heading: r3(t.heading) })),
    ball: c.ball ? { x: r3(c.ball.x), y: r3(c.ball.y), z: r2(c.ball.z), angle: r3(c.ball.angle) } : undefined,
    fly: c.flying ? { t: r3(c.flying.t), spin: r3(c.flying.spin) } : undefined, // only while flying off the track
  });
}

// Events and entities point at car objects; on the wire those become { car: id } so the guest can point them
// back at its own cars.
const isCar = v => v && typeof v === 'object' && Number.isInteger(v.id) && v.stats;
function encode(value) {
  if (isCar(value)) return { car: value.id };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
function decode(value, cars) {
  if (Array.isArray(value)) return value.map(v => decode(v, cars));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'car' && Number.isInteger(value.car)) return cars[value.car];
    return Object.fromEntries(keys.map(k => [k, decode(value[k], cars)]));
  }
  return value;
}

// eventsSinceLast: the race events the host collected since its previous snapshot.
export function snapshot(race, eventsSinceLast = []) {
  race.nextEntityId ??= 1;
  for (const e of race.entities) e.id ??= race.nextEntityId++; // stable ids so guests keep the same object
  return {
    phase: race.phase, countdown: r2(race.countdown), time: r2(race.time), laps: race.laps,
    finishOrder: race.finishOrder.map(c => c.id), firstFinishTime: race.firstFinishTime,
    cars: race.cars.map(carState),
    entities: race.entities.map(e => encode(compact({
      id: e.id, type: e.type, x: r3(e.x), y: r3(e.y), z: r2(e.z), age: r2(e.age ?? 0),
      vx: e.vx === undefined ? undefined : r2(e.vx), vy: e.vy === undefined ? undefined : r2(e.vy), owner: e.owner,
    }))),
    crates: race.crates.map(c => c.active),
    events: eventsSinceLast.map(encode),
  };
}

// The guest's copy of the race. entrants: the same list the host built its race from (driver, vehicle, name,
// colour, human, loadout per seat), so each car's combined stats are rebuilt locally rather than sent.
export function createRaceView(track, entrants) {
  const view = {
    track, laps: 4, phase: 'countdown', countdown: 3, time: 0, entities: [], events: [], finishOrder: [], firstFinishTime: null,
    cars: entrants.map((e, id) => ({
      id, key: e.key, name: e.name ?? e.key.toUpperCase(), color: e.color, human: !!e.human,
      stats: e.driver ? combineStats(CAR_STATS[e.key], e.driver) : CAR_STATS[e.key],
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, fallen: false, flying: null, wrecked: false, finished: false, finishTime: null,
      armor: 0, maxArmor: 0, lap: 0, dist: 0, kills: 0, charges: { forward: 0, drop: 0 }, nitro: 0, boostTimer: 0,
      loadout: { ...e.loadout }, bonus: null, bomb: null, scrape: 0, launched: false, prevInput: { throttle: 0, steer: 0 },
    })),
  };
  setupPickups(view); // crates and pads sit where the host's are: they come from the track
  return view;
}

export function applySnapshot(view, snap) {
  Object.assign(view, { phase: snap.phase, countdown: snap.countdown, time: snap.time, laps: snap.laps, firstFinishTime: snap.firstFinishTime });
  view.finishOrder = snap.finishOrder.map(id => view.cars[id]);
  snap.cars.forEach((s, i) => {
    const c = view.cars[i];
    Object.assign(c, {
      x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, heading: s.h, grounded: s.g, fallen: s.f, wrecked: s.w,
      finished: s.fin, finishTime: s.ft, armor: s.armor, maxArmor: s.maxArmor, lap: s.lap, dist: s.dist, kills: s.kills,
      charges: s.charges, nitro: s.nitro, boostTimer: s.boost, loadout: s.loadout, bonus: s.bonus, bomb: s.bomb,
      scrape: s.scrape, launched: s.launched, prevInput: s.input,
    });
    c.flying = s.fly && Number.isFinite(s.fly.t) && Number.isFinite(s.fly.spin) ? { t: s.fly.t, spin: s.fly.spin } : null;
    if (s.trailers) c.trailers = s.trailers;
    if (s.ball) c.ball = { ...(c.ball ?? {}), ...s.ball };
  });
  const byId = new Map(view.entities.map(e => [e.id, e]));
  view.entities = snap.entities.map(raw => {
    const e = decode(raw, view.cars), known = byId.get(e.id);
    return known ? Object.assign(known, e) : e; // keep the same object so effects and drawing don't flicker
  });
  snap.crates.forEach((active, i) => { if (view.crates[i]) view.crates[i].active = active; });
  view.events.push(...decode(snap.events, view.cars));
}
