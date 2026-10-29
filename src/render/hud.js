import { VIEW_W, VIEW_H } from '../game/camera.js';
import { standings, graceLeft } from '../game/race.js';
import { WEAPONS } from '../combat/weapons.js';
import { driverDef } from '../series/bosses.js';
import { drawIcon } from '../ui/icons.js';
import { drawMinimap } from './minimap.js';
import { COLOR, LAYOUT, tint, drawStyled, styledWidth } from '../ui/theme.js';

// Every colour, text size and anchor here comes from ui/theme.js.
const L = LAYOUT.hud;
const box = (ctx, x, y, w, h, a = 0.6) => { ctx.fillStyle = tint('black', a); ctx.fillRect(x, y, w, h); };
const center = (ctx, str, y, color, style = 'small', scale = null) => drawStyled(ctx, str, VIEW_W / 2, y, style, color, { align: 'center', scale });
const fmt = t => (t == null ? '--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`);
const SHORT = { arc: 'ARC', saw: 'SAW', harpoon: 'HARPOON', mine: 'MINE', napalm: 'NAPALM' };
const short = w => SHORT[w] ?? WEAPONS[w].name;

export const bottomBar = (driverName, carName) => `${driverName} IN THE ${carName}   TAB/Q SWAP WEAPONS   R RESTART   ESC MENU`;

// portrait: optional { canvas } of your driver, shown beside the armor box with the driver's skill.
export const RESULTS_HINT = 'R RACE AGAIN   ESC PICK A NEW COMBO';
export const resultsHint = touch => (touch ? 'TAP FOR A NEW COMBO' : RESULTS_HINT);
// A tap or click on a finished race: 'series' moves on to the standings, 'menu' leaves a quick race (like Esc).
// Nothing until the results have been up a moment, so a tap held over from the race can't skip them.
export function afterRaceTap({ series, online, phase, finishedFor, minSecs = 1.2 }) {
  if (phase !== 'finished' || online || finishedFor < minSecs) return null;
  return series ? 'series' : 'menu';
}
// resultsHint: the line under the results (a series says how to get to the standings).
export function drawHud(ctx, { race, player, banner, t, portrait = null, minimap = null, resultsHint = RESULTS_HINT }) {
  const order = standings(race);

  // standings, top-left
  const rows = order.map((c, i) => `${i + 1} ${c.name}${c.finished ? ' FIN' : c.wrecked ? ' X' : ''}`);
  box(ctx, L.standings.x, L.standings.y, Math.max(L.standings.w, ...rows.map(s => styledWidth(s, 'small'))) + 9, L.standings.h + order.length * L.standings.rowH);
  order.forEach((c, i) => {
    drawStyled(ctx, rows[i], 7, 6 + i * L.standings.rowH, 'small', c.wrecked ? 'dim' : c.color);
    if (c === player) { ctx.fillStyle = COLOR.white; ctx.fillRect(4, 6 + i * L.standings.rowH, 1, 7); }
  });

  // lap + time, top-right
  const lapStr = `LAP ${Math.min(player.lap + 1, race.laps)}/${race.laps}`;
  box(ctx, L.lap.x, L.lap.y, L.lap.w, L.lap.h);
  drawStyled(ctx, lapStr, L.lap.x + 3, 6, 'small', 'white');
  drawStyled(ctx, fmt(race.time), L.lap.x + 3, 16, 'small', 'gold');
  if (minimap) drawMinimap(ctx, minimap, race, player, t, VIEW_W - minimap.w - 3, L.minimap.y); // under the lap timer

  // armor and inventory, bottom-left: what you carry, the key that uses it, and how many shots are left
  const y0 = L.inventory.y, px = L.inventory.x, pw = L.inventory.w;
  box(ctx, px, y0, pw, L.inventory.h, 0.7);
  drawStyled(ctx, 'ARMOR', px + 4, y0 + 5, 'small', 'muted');
  ctx.fillStyle = COLOR.armorBack; ctx.fillRect(px + 36, y0 + 4, 70, 8);
  const frac = Math.max(0, player.armor) / player.maxArmor;
  ctx.fillStyle = frac > 0.5 ? COLOR.ok : frac > 0.25 ? COLOR.gold : Math.floor(t * 6) % 2 ? COLOR.danger : COLOR.dangerDim;
  ctx.fillRect(px + 36, y0 + 4, Math.round(70 * frac), 8);
  drawStyled(ctx, `KILLS ${player.kills}`, px + 110, y0 + 5, 'small', 'salmon');
  const slot = (row, key, icon, name, count, color) => { // color: a COLOR token name
    const y = y0 + 16 + row * 22;
    drawIcon(ctx, icon, px + 5, y, 2);
    drawStyled(ctx, key, px + 27, y + 1, 'small', 'hint');
    drawStyled(ctx, name, px + 27, y + 9, 'small', count > 0 ? color : 'dim');
    for (let k = 0; k < Math.max(3, count); k++) { // one pip per shot
      ctx.fillStyle = k < count ? COLOR[color] : COLOR.barBack;
      ctx.fillRect(px + 116 + k * 9, y + 6, 7, 7);
    }
  };
  slot(0, 'SPACE', player.loadout.forward, short(player.loadout.forward), player.charges.forward, 'cyan');
  slot(1, 'SHIFT', player.loadout.drop, short(player.loadout.drop), player.charges.drop, 'purple');
  slot(2, 'E', 'nitro', 'NITRO', Math.floor(player.nitro), 'amber');
  if (player.bonus) { // a crate's bonus shots get used first, so make them impossible to miss
    const bx = px + pw + 4, by = y0 + 16 + (WEAPONS[player.bonus.weapon].slot === 'forward' ? 0 : 22);
    box(ctx, bx, by - 2, 86, 22, 0.8);
    drawIcon(ctx, player.bonus.weapon, bx + 3, by, 2);
    drawStyled(ctx, `BONUS x${player.bonus.shots}`, bx + 23, by + 5, 'small', Math.floor(t * 4) % 2 ? 'gold' : 'white');
  }
  const driver = driverDef(player.stats.driver);
  if (driver) {
    box(ctx, L.driver.x, L.driver.y, L.driver.w, L.driver.h, 0.7);
    drawStyled(ctx, `${driver.short.toUpperCase()}: ${driver.skill.name}`, px + 5, y0 - 21, 'small', 'cyan');
    if (player.stats.trait) drawStyled(ctx, player.stats.trait.name, px + 5, y0 - 11, 'small', 'salmon');
    if (portrait?.canvas && !player.bonus) ctx.drawImage(portrait.canvas, px + pw + 4, y0 + L.inventory.h - portrait.canvas.height);
  }

  if (player.bomb) {
    const s = `BOMB! ${player.bomb.fuse.toFixed(1)} - RAM SOMEBODY!`;
    box(ctx, L.bomb.x, L.bomb.y, L.bomb.w, L.bomb.h, 0.7);
    center(ctx, s, L.bomb.y + 3, Math.floor(t * 8) % 2 ? 'danger' : 'gold');
  }

  if (race.phase === 'countdown') { // a big number that punches in each second: red, orange, yellow
    const n = Math.max(1, Math.ceil(race.countdown)), frac = race.countdown - (n - 1), scale = 8 + Math.round(frac * 8);
    center(ctx, String(n), Math.round(L.countdownY - scale * 2.5), n >= 3 ? 'danger' : n === 2 ? 'orange' : 'gold', 'small', scale);
    box(ctx, L.hint.x, L.hint.y, L.hint.w, L.hint.h, 0.7); // under the loadout banner, clear of the cars on the grid
    center(ctx, 'ARROWS/WASD DRIVE   SPACE FIRE   SHIFT DROP   E NITRO', L.hint.y + 3, 'text');
  } else if (race.time < 1) {
    const scale = 16 - Math.round(race.time * 6);
    if (race.time < 0.6 || Math.floor(race.time * 12) % 2) center(ctx, 'GO!', Math.round(L.countdownY - scale * 2.5), 'ok', 'small', scale);
  }
  const left = race.phase === 'racing' && !player.finished ? graceLeft(race) : null;
  if (left !== null) { // someone finished: the clock is running on everyone else
    const s = `RACE ENDS IN ${Math.ceil(left)}`;
    box(ctx, ((VIEW_W - styledWidth(s, 'body')) / 2 | 0) - 6, L.graceY, styledWidth(s, 'body') + 12, 16, 0.75);
    center(ctx, s, L.graceY + 3, left < 10 && Math.floor(t * 4) % 2 ? 'danger' : 'gold', 'body');
  }

  if (banner) {
    box(ctx, ((VIEW_W - styledWidth(banner, 'small')) / 2 | 0) - 4, L.banner.y, styledWidth(banner, 'small') + 8, L.banner.h, 0.75);
    center(ctx, banner, L.banner.y + 3, 'gold');
  }

  box(ctx, L.bottomBar.x, L.bottomBar.y, L.bottomBar.w, L.bottomBar.h, 0.7);
  center(ctx, bottomBar(player.driverName ?? player.name, player.stats.name), L.bottomBar.y + 1, 'muted');

  if (race.phase === 'finished') drawResults(ctx, race, order, player, resultsHint);
}

// The results headline: the truth, even when the race was called before you crossed the line.
export function resultHeadline(place, finished) {
  if (!finished) return 'DID NOT FINISH';
  return place === 1 ? 'YOU WON!' : `YOU FINISHED ${['1ST', '2ND', '3RD', '4TH'][place - 1]}`;
}

function drawResults(ctx, race, order, player, hint) {
  box(ctx, L.results.x, L.results.y, L.results.w, L.results.h + order.length * 11, 0.85);
  const place = order.indexOf(player) + 1;
  center(ctx, resultHeadline(place, player.finished), 56, place === 1 && player.finished ? 'ok' : player.finished ? 'gold' : 'danger', 'body');
  order.forEach((c, i) => {
    const y = 74 + i * 11;
    drawStyled(ctx, `${i + 1}. ${c.name}`, 72, y, 'small', c.color);
    drawStyled(ctx, c.finished ? fmt(c.finishTime) : 'DNF', 250, y, 'small', 'white');
    drawStyled(ctx, `${c.kills} KILLS`, 330, y, 'small', 'salmon');
  });
  center(ctx, hint, 77 + order.length * 11, 'muted');
}
