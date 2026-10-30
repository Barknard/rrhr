import { CAR_STATS } from '../cars/carStats.js';

// Which sound goes with what (ids from docs/audio/sfx-list.md). Pure: audioPlayer.js does the playing.
const NEAR = 6, FAR = 30, FLOOR = 0.15;             // tiles: full volume within NEAR, down to FLOOR at FAR and beyond
const FIRE = { arc: 'arc_fire', saw: 'saw_fire', harpoon: 'harpoon_fire', mine: 'mine_drop', napalm: 'napalm_drop' };
const HIT = { saw: 'saw_hit', napalm: 'napalm_burn', fire: 'napalm_burn' };
const VOICED = new Set(['arc', 'mine', 'bomb', 'ram', 'ball', 'tumble', 'harpoon']); // these hits sound in their own event
const PICKUP = { turbo: 'crate_turbo', bomb: 'bomb_pick' };
const PLAIN = { count: 'count_beep', go: 'go_horn', harpoon: 'harpoon_hit', wreck: 'boom_big', fell: 'fall_pit', tumble: 'tumble',
  launch: 'pad_launch', nitro: 'nitro', ram: 'ram_hit', ball: 'ball_hit', respawn: 'respawn', sawHit: 'saw_hit',
  sawBounce: 'saw_bounce', sawBreak: 'saw_break', bombPass: 'bomb_pass', bump: 'bump' };
const ENGINE_OF = { slaghog: 'boneshaker' }; // the boss rides a souped-up Boneshaker

const mine = (e, player) => !!player && (e.car === player || e.target === player || e.a === player || e.b === player);

function idFor(e, player, race) {
  switch (e.type) {
    case 'lap': return e.car === player && e.lap < race.laps ? (e.lap === race.laps - 1 ? 'final_lap' : 'lap') : null;
    case 'finish': return e.car === player ? 'finish_flag' : null;
    case 'empty': return e.car === player ? 'ui_back' : null;
    case 'fire': return FIRE[e.weapon] ?? null;
    case 'zap': return e.targets?.length ? 'arc_zap' : 'arc_fizzle';
    case 'hit': return HIT[e.cause] ?? (VOICED.has(e.cause) ? null : 'bump');
    case 'explosion': return e.cause === 'bomb' ? 'boom_bomb' : 'boom_small';
    case 'pickup': return PICKUP[e.content?.kind] ?? 'crate_pick';
    default: return PLAIN[e.type] ?? null;
  }
}

function gainFor(e, player) {
  if (!player || mine(e, player)) return 1;
  const at = Number.isFinite(e.x) ? e : e.car ?? e.a;
  if (!at || !Number.isFinite(at.x)) return 1;
  const d = Math.hypot(at.x - player.x, at.y - player.y);
  return d <= NEAR ? 1 : Math.max(FLOOR, 1 - (1 - FLOOR) * (d - NEAR) / (FAR - NEAR));
}

// One race step's events -> [{ id, gain }], one per id (the loudest). player = the car the camera follows, or null.
export function soundsForEvents(events, player, race) {
  const out = new Map();
  for (const e of events ?? []) {
    const id = idFor(e, player, race);
    if (!id) continue;
    const gain = gainFor(e, player);
    if (!out.has(id) || out.get(id).gain < gain) out.set(id, { id, gain });
  }
  return [...out.values()];
}

// Vehicle key -> its looping engine sfx id.
export function engineFor(key) {
  const k = ENGINE_OF[key] ?? (Object.hasOwn(CAR_STATS, key ?? '') ? key : 'grinder');
  return 'eng_' + k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Engine loop playback rate: 0.8 at rest to 1.6 flat out.
export function enginePitch(speed, maxSpeed) {
  const t = maxSpeed > 0 ? Math.max(0, Math.min(1, speed / maxSpeed)) : 0;
  return 0.8 + 0.8 * t;
}

const slug = s => String(s).toLowerCase().replace(/['’]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Music file name (assets/music/<name>.mp3): the menu tune everywhere but a race.
export function musicFor(mode, trackName) {
  return mode === 'race' && trackName ? 'race_' + slug(trackName) : 'menu';
}

// Every id soundsForEvents can return, plus the lava bed: preloaded at race load (a sound's first play only loads it).
export const RACE_SFX = [...new Set(['final_lap', 'lap', 'finish_flag', 'ui_back', 'arc_zap', 'arc_fizzle', 'bump', 'boom_bomb', 'boom_small',
  'crate_pick', 'lava_amb', ...Object.values(FIRE), ...Object.values(HIT), ...Object.values(PICKUP), ...Object.values(PLAIN)])];

// The player's engine loop: pitch from speed, a bit louder on the gas, quiet while wrecked or in the pit.
export function engineMix(car, throttle) {
  const rate = enginePitch(Math.hypot(car.vx ?? 0, car.vy ?? 0), car.stats?.maxSpeed ?? 0);
  return { rate, gain: car.wrecked || car.fallen ? 0 : 0.45 + 0.25 * Math.max(0, Math.min(1, throttle ?? 0)) };
}

// OPTIONS switches -> audioPlayer bus volumes.
export const busVolumes = s => ({ music: s.music ? 0.5 : 0, sfx: s.sfx ? 0.8 : 0, voice: s.voice ? 1 : 0 });
