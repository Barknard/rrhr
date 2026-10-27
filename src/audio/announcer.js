import { LINES, TRIGGERS } from './lines.js';
import { standings } from '../game/race.js';

// "Big Mouth" Mel Mangano's brain. Pure: it watches the race (events plus snapshots) and returns at most one
// line per call, chosen by priority, chance and cooldown from per-trigger shuffle bags that never repeat a
// line until every other line of that trigger has been said. The voice and captions are someone else's job.
const MIN_GAP = 3.5, MULTI_WINDOW = 6, TRIPLE_WINDOW = 10, MISS_WINDOW = 2, FILLER_AFTER = 20;
const LAST_PLACE_AFTER = 15, WALL_HUG_AFTER = 1.5, WRONG_WAY_AFTER = 3, RIVALRY_AFTER = 3, COMEBACK_WINDOW = 45;
const STORAGE_KEY = 'rrhr.announcer.bags';
const PLACES = ['first', 'second', 'third', 'fourth'];
const stripTags = s => s.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

export function createAnnouncer({ lines = LINES, triggers = TRIGGERS, rng = Math.random, storage = null, nameOf = c => c.name } = {}) {
  let t = 0, nextFree = 0, currentPriority = -1, lastSpoke = 0;
  const lastFired = {}, seen = new WeakSet();
  const bags = loadBags();
  // What the announcer remembers about the race in progress; a new race object starts it fresh.
  const freshTrack = race => ({ race, leader: null, finalLapCalled: false, kills: new Map(), killedBy: new Map(), shots: [], perCar: new Map() });
  let track = freshTrack(null);

  function loadBags() {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return {};
      // keep only bags that are still a valid shuffle of their trigger's lines (the bank may have changed)
      const valid = (b, n) => b && Array.isArray(b.order) && b.order.length === n && Number.isInteger(b.pos) && b.pos >= 0 && b.pos <= n &&
        [...b.order].sort((x, y) => x - y).every((v, i) => v === i);
      for (const k of Object.keys(saved)) if (!lines[k] || !valid(saved[k], lines[k].length)) delete saved[k];
      return saved;
    } catch { return {}; }
  }
  const shuffled = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const fill = (text, vars) => {
    let ok = true;
    const out = text.replace(/\{(\w+)\}/g, (_, k) => { if (vars[k] == null || vars[k] === '') ok = false; return vars[k]; });
    return ok ? out : null;
  };

  // Next unused line of this trigger that all its placeholders can fill.
  function pick(trigger, vars) {
    const pool = lines[trigger];
    if (!pool?.length) return null;
    let bag = bags[trigger];
    if (!bag || bag.pos >= bag.order.length) {
      const order = shuffled(pool.length);
      if (bag && order.length > 1 && order[0] === bag.last) [order[0], order[1]] = [order[1], order[0]];
      bag = bags[trigger] = { order, pos: 0, last: bag?.last ?? -1 };
    }
    for (let i = bag.pos; i < bag.order.length; i++) {
      const text = fill(pool[bag.order[i]], vars);
      if (!text) continue;
      [bag.order[bag.pos], bag.order[i]] = [bag.order[i], bag.order[bag.pos]];
      bag.last = bag.order[bag.pos++];
      return text;
    }
    for (let i = 0; i < pool.length; i++) { // the unused lines all need something we don't have: reuse a used one
      if (i === bag.last) continue;
      const text = fill(pool[i], vars);
      if (text) { bag.last = i; return text; }
    }
    return null;
  }

  // script keeps the ElevenLabs v3 delivery tags ([shouting], [laughs]...) for the voice; text is the caption.
  function utter(trigger, vars) {
    const script = pick(trigger, vars);
    if (!script) return null;
    const priority = triggers[trigger]?.priority ?? 0;
    lastFired[trigger] = t; lastSpoke = t; currentPriority = priority; nextFree = t + MIN_GAP;
    return { trigger, text: stripTags(script), script, priority };
  }

  // Candidate lines from this step, best first; the first one that clears every gate is spoken.
  function choose(cands) {
    cands.sort((a, b) => (triggers[b.trigger]?.priority ?? 0) - (triggers[a.trigger]?.priority ?? 0));
    for (const c of cands) {
      const p = triggers[c.trigger];
      if (!p || !lines[c.trigger]) continue;
      if (t - (lastFired[c.trigger] ?? -1e9) < p.cooldown) continue;
      if (t < nextFree && p.priority <= currentPriority) continue;
      if (rng() >= p.chance) continue;
      const u = utter(c.trigger, c.vars);
      if (u) return u;
    }
    return null;
  }

  const carState = car => {
    let s = track.perCar.get(car);
    if (!s) track.perCar.set(car, s = { last: 0, hug: 0, stuck: 0, prevDist: car.dist, near: new Map(), wasLastAt: -1e9 });
    return s;
  };

  function hear(race, dt) {
    t += dt;
    if (track.race !== race) track = freshTrack(race);
    const order = standings(race), leader = order[0], lastCar = order[order.length - 1];
    const name = c => (c ? nameOf(c) : null);
    const base = { leader: name(leader), last: order.length > 1 ? name(lastCar) : null, track: race.track?.def?.name, lap: null };
    const cands = [];
    const add = (trigger, vars) => cands.push({ trigger, vars: { ...base, ...vars } });

    for (const e of race.events) {
      if (seen.has(e)) continue;
      seen.add(e);
      const who = name(e.car);
      switch (e.type) {
        case 'go': add('go', {}); break;
        case 'wreck': {
          const k = e.attacker && e.attacker !== e.car ? e.attacker : null;
          if (k) {
            const times = [...(track.kills.get(k) ?? []).filter(x => t - x <= TRIPLE_WINDOW), t];
            track.kills.set(k, times);
            const vars = { killer: name(k), victim: who };
            if (times.length >= 3) add('triple_kill', vars);
            else if (times.filter(x => t - x <= MULTI_WINDOW).length >= 2) add('multi_kill', vars);
            if (track.killedBy.get(k) === e.car) add('revenge', { ...vars, car: k.stats?.name });
            if (e.car.human) add('wrecked_human', vars);
            else add(lines[`kill_${e.cause}`] && rng() < 0.5 ? `kill_${e.cause}` : 'kill', vars);
            if (e.car.human && k.human) add('rivalry', { a: name(k), b: who });
          } else if (e.cause === 'bomb') add('kill_bomb', { victim: who });
          else add('self_wreck', { name: who });
          track.killedBy.set(e.car, k);
          break;
        }
        case 'fell':
          if (e.attacker) add('fell_pushed', { killer: name(e.attacker), victim: who });
          else add('fell', { name: who });
          break;
        case 'pickup':
          if (e.content?.kind === 'bomb') add('bomb_got', { name: who });
          else if (e.content?.kind === 'turbo') add('turbo', { name: who });
          break;
        case 'bombPass': add('bomb_pass', { giver: who, taker: name(e.target) }); break;
        case 'launch': add('big_air', { name: who }); break;
        case 'tumble': add('bad_landing', { name: who }); break;
        case 'nitro': if (e.car.human) add('nitro', { name: who }); break;
        case 'fire': if (e.car.human) track.shots.push({ car: e.car, t, hit: false }); break;
        case 'hit':
          for (const s of track.shots) if (s.car === e.attacker) s.hit = true;
          if (e.attacker && e.attacker !== e.car && !e.car.wrecked) add('hit', { killer: name(e.attacker), victim: who });
          break;
        case 'lap':
          if (e.car !== leader) break;
          if (e.lap === race.laps - 1 && !track.finalLapCalled) { track.finalLapCalled = true; add('final_lap', {}); }
          else if (e.lap < race.laps - 1) add('lap', { lap: e.lap + 1 });
          break;
        case 'finish': {
          const fin = race.finishOrder ?? [];
          if (e.place === 2 && fin[0] && Math.abs((e.car.finishTime ?? 0) - (fin[0].finishTime ?? 0)) < 0.5) add('photo_finish', { winner: name(fin[0]), second: who });
          if (!e.car.human) break;
          if (e.place === 1) add('win_human', { name: who });
          else if (e.place === race.cars.length) add('finish_last', { name: who });
          else add('finish_mid', { name: who, place: PLACES[e.place - 1] });
          break;
        }
        case 'raceOver': {
          const w = (race.finishOrder ?? [])[0];
          if (w && !w.human && race.cars.some(c => c.human)) add('win_cpu', { winner: name(w) });
          break;
        }
        default: break;
      }
    }

    // missed shots: nothing hit within the window
    track.shots = track.shots.filter(s => {
      if (t - s.t < MISS_WINDOW) return true;
      if (!s.hit) add('miss', { name: name(s.car) });
      return false;
    });

    if (race.phase === 'racing') {
      if (track.leader && leader !== track.leader && race.time > 3) add('lead_change', { leader: name(leader), loser: name(track.leader) });
      track.leader = leader;
      const second = order[1];
      if (second && race.track?.length && leader.dist - second.dist > race.track.length / 2) add('blowout', {});

      const humans = race.cars.filter(c => c.human);
      for (const c of humans) {
        const s = carState(c), idx = order.indexOf(c), out = c.wrecked || c.fallen || c.finished;
        if (idx === order.length - 1 && order.length > 1) { s.last += dt; s.wasLastAt = t; } else s.last = 0;
        if (s.last >= LAST_PLACE_AFTER) { s.last = 0; add('last_place', { name: name(c) }); }
        if (idx <= 1 && t - s.wasLastAt < COMEBACK_WINDOW && s.wasLastAt > 0 && order.length > 2) { s.wasLastAt = -1e9; add('comeback', { name: name(c) }); }
        s.hug = !out && c.scrape > 0 ? s.hug + dt : 0;
        if (s.hug >= WALL_HUG_AFTER) { s.hug = 0; add('wall_hug', { name: name(c) }); }
        s.stuck = !out && c.dist - s.prevDist <= 1e-4 ? s.stuck + dt : 0;
        s.prevDist = c.dist;
        if (s.stuck >= WRONG_WAY_AFTER) { s.stuck = 0; add('wrong_way', { name: name(c) }); }
      }
      for (let i = 0; i < humans.length; i++) for (let j = i + 1; j < humans.length; j++) {
        const a = humans[i], b = humans[j], s = carState(a);
        const close = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0)) < 1;
        const n = close ? (s.near.get(b) ?? 0) + dt : 0;
        s.near.set(b, n >= RIVALRY_AFTER ? 0 : n);
        if (n >= RIVALRY_AFTER) add('rivalry', { a: name(a), b: name(b) });
      }
      if (t - lastSpoke >= FILLER_AFTER) add('filler', {});
    }
    return choose(cands);
  }

  return {
    hear,
    // Menu and screen lines: always spoken, cutting off whatever is playing.
    say(trigger, vars = {}) { return utter(trigger, vars); },
    // The voice reports how long a line takes so nothing lower-priority talks over it.
    speaking(duration) { nextFree = Math.max(nextFree, t + duration); },
    tick(dt) { t += dt; },
    save() { try { storage?.setItem(STORAGE_KEY, JSON.stringify(bags)); } catch { /* storage full or blocked: bags just won't persist */ } },
  };
}
