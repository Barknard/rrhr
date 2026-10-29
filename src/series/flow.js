import { createSeries, entrantsFor, recordRace, startNextRace, retryFinale, saveUnlock, PLAYER_ID, BOSS_ID } from './series.js';
import { driverDef, vehicleStats } from './bosses.js';
import { TRACKS } from '../track/tracks.js';

// The series as the game plays it: which transmission, race or screen comes next. Pure (no DOM, no clock); the
// game asks and does what it's told.
//   begin()        -> { transmission: 'seriesIntro' }
//   next()         -> { transmission: 'finaleTaunt' } once before race 4, else { race: { track, nextTrack, entrants, index } }
//   finish(order)  -> { screen: 'standings' | 'champion' | 'beaten', view }  (order: entrant ids, first place first)
//   retry()        -> race 4 again, same grid, no taunt
//   view()         -> the standings view as it stands
export function createSeriesFlow({ def, player, rng = Math.random, storage = null }) {
  const series = createSeries({ def, player, rng });
  let taunted = false;
  const nameOf = e => driverDef(e.driver).short.toUpperCase();
  const all = () => [{ id: PLAYER_ID, driver: player.driver, vehicle: player.vehicle, isPlayer: true }, ...series.rivals,
    ...(series.race === 3 || series.results.length > 3 ? [{ id: BOSS_ID, driver: 'kingCinder', vehicle: 'slaghog', isBoss: true }] : [])];
  const byId = id => all().find(e => e.id === id);

  function raceOrder() {
    const index = series.race;
    return { race: { index, track: def.tracks[index], nextTrack: def.tracks[index + 1] ?? null, entrants: entrantsFor(series) } };
  }

  function view() {
    const last = series.results[series.results.length - 1] ?? [];
    const table = all()
      .map(e => ({ id: e.id, name: nameOf(e), car: vehicleStats(e.vehicle).name, points: series.points.get(e.id) ?? 0, isPlayer: !!e.isPlayer, isBoss: !!e.isBoss, out: e.id === series.bossOut }))
      .sort((a, b) => b.points - a.points || (a.out - b.out));
    const done = series.results.length, next = def.tracks[done];
    const place = last.indexOf(PLAYER_ID) + 1;
    const caption = series.state === 'finale' && series.bossOut
      ? `KING CINDER TAKES ${nameOf(byId(series.bossOut))}'S SEAT FOR THE FINALE`
      : next ? `NEXT: ${TRACKS[next].name.toUpperCase()}` : '';
    return {
      race: done, total: def.tracks.length, place,
      result: last.map(id => ({ name: nameOf(byId(id)), isPlayer: id === PLAYER_ID, isBoss: id === BOSS_ID })),
      table, caption, unlocked: [...series.unlocked],
    };
  }

  return {
    series,
    begin() { return { transmission: 'seriesIntro' }; },
    next() {
      if (series.state === 'finale' && !taunted) { taunted = true; return { transmission: 'finaleTaunt' }; }
      startNextRace(series);
      return raceOrder();
    },
    finish(order) {
      recordRace(series, order);
      if (series.state === 'champion' && storage) for (const k of series.unlocked) saveUnlock(storage, k);
      const screen = series.state === 'champion' || series.state === 'beaten' ? series.state : 'standings';
      return { screen, view: view() };
    },
    retry() { retryFinale(series); startNextRace(series); return raceOrder(); },
    view,
  };
}
