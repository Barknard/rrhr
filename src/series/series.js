import { CAR_KEYS } from '../cars/carStats.js';
import { DRIVER_KEYS } from '../drivers/drivers.js';
import { BOSS } from './bosses.js';

// Series state machine. Pure: no DOM, no clock. All randomness comes from the injected rng (0..1).
export const POINTS = [10, 6, 4, 2];
export const BOSS_ID = 'boss';
export const PLAYER_ID = 'player';
const KEY = 'rrhr.unlocks';

const pick = (arr, rng) => arr.splice(Math.min(arr.length - 1, Math.floor(rng() * arr.length)), 1)[0];

export function createSeries({ def, player, rng = Math.random }) {
  const drivers = DRIVER_KEYS.filter(k => k !== player.driver);
  const cars = CAR_KEYS.filter(k => k !== player.vehicle);
  const rivals = [1, 2, 3].map(n => ({ id: 'rival' + n, driver: pick(drivers, rng), vehicle: pick(cars, rng) }));
  const points = new Map([[PLAYER_ID, 0], ...rivals.map(r => [r.id, 0])]);
  return { def, race: 0, player, rivals, points, results: [], state: 'racing', bossOut: null, finaleBase: null, unlocked: [] };
}

const playerEntrant = s => ({ id: PLAYER_ID, driver: s.player.driver, vehicle: s.player.vehicle, loadout: s.player.loadout, isPlayer: true });

// Lowest rival on points (first on ties). Fixed when race 4 is first set up so a retry keeps the same grid.
function lowestRival(s) {
  return s.rivals.reduce((lo, r) => (s.points.get(r.id) < s.points.get(lo.id) ? r : lo), s.rivals[0]);
}

export function entrantsFor(s) {
  const finale = s.race === 3;
  const out = finale ? (s.bossOut ?? lowestRival(s).id) : null;
  const list = [playerEntrant(s), ...s.rivals.filter(r => r.id !== out)];
  if (finale) list.push({ id: BOSS_ID, driver: BOSS.driver, vehicle: BOSS.vehicle, isBoss: true });
  const pts = e => s.points.get(e.id) ?? 0;
  // stable sort ascending: points leader ends up last on the grid
  return list.map((e, i) => [e, i]).sort((a, b) => pts(a[0]) - pts(b[0]) || a[1] - b[1]).map(x => x[0]);
}

export function recordRace(s, order) {
  if (s.state !== 'racing') return s;
  order.forEach((id, i) => s.points.set(id, (s.points.get(id) ?? 0) + (POINTS[i] ?? 0)));
  s.results.push(order.slice());
  if (s.race < 3) {
    s.race++;
    s.state = s.race === 3 ? 'finale' : 'standings';
    if (s.race === 3) { s.bossOut = lowestRival(s).id; s.finaleBase = new Map(s.points); }
    return s;
  }
  // Finale: champion only if strictly ahead of the boss in the running order.
  const p = order.indexOf(PLAYER_ID), b = order.indexOf(BOSS_ID);
  const won = p >= 0 && (b < 0 || p < b);
  s.state = won ? 'champion' : 'beaten';
  if (won) s.unlocked = ['series2', 'boss'];
  return s;
}

// Called by the screen flow when the player leaves standings/finale intro.
export function startNextRace(s) {
  if (s.state === 'standings' || s.state === 'finale') s.state = 'racing';
  return s;
}

// After a loss: forget race 4 only, same picks, points from races 1-3 kept.
export function retryFinale(s) {
  if (s.state !== 'beaten') return s;
  s.results.length = 3;
  s.points = new Map(s.finaleBase);
  s.race = 3;
  s.state = 'finale';
  return s;
}

export function loadUnlocks(storage) {
  const none = { series2: false, boss: false };
  try {
    const o = JSON.parse(storage.getItem(KEY));
    if (!o || typeof o !== 'object') return none;
    return { series2: o.series2 === true, boss: o.boss === true };
  } catch { return none; }
}

export function saveUnlock(storage, key) {
  const cur = loadUnlocks(storage);
  if (!Object.hasOwn(cur, key)) return cur;
  cur[key] = true;
  try { storage.setItem(KEY, JSON.stringify(cur)); } catch { /* storage unavailable */ }
  return cur;
}
