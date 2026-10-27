import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from '../game/camera.js';
import { standings } from '../game/race.js';
import { WEAPONS } from '../combat/weapons.js';
import { DRIVERS } from '../drivers/drivers.js';
import { drawIcon } from '../ui/icons.js';
import { drawMinimap } from './minimap.js';

const box = (ctx, x, y, w, h, a = 0.6) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(x, y, w, h); };
const center = (ctx, str, y, color, scale = 1) => drawText(ctx, str, ((VIEW_W - textWidth(str, scale)) / 2) | 0, y, color, '#000', scale);
const fmt = t => (t == null ? '--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`);
const SHORT = { arc: 'ARC', saw: 'SAW', harpoon: 'HARPOON', mine: 'MINE', napalm: 'NAPALM' };
const short = w => SHORT[w] ?? WEAPONS[w].name;

export const bottomBar = (driverName, carName) => `${driverName} IN THE ${carName}   TAB/Q SWAP WEAPONS   R RESTART   ESC MENU`;

// portrait: optional { canvas } of your driver, shown beside the armor box with the driver's skill.
export function drawHud(ctx, { race, player, banner, t, portrait = null, minimap = null }) {
  const order = standings(race);

  // standings, top-left
  box(ctx, 3, 3, 84, 8 + order.length * 7);
  order.forEach((c, i) => {
    const tag = c.finished ? ' FIN' : c.wrecked ? ' X' : '';
    drawText(ctx, `${i + 1} ${c.name}${tag}`, 6, 6 + i * 7, c.wrecked ? '#777' : c.color);
    if (c === player) { ctx.fillStyle = '#fff'; ctx.fillRect(4, 6 + i * 7, 1, 5); }
  });

  // lap + time, top-right
  const lapStr = `LAP ${Math.min(player.lap + 1, race.laps)}/${race.laps}`;
  box(ctx, VIEW_W - 58, 3, 55, 17);
  drawText(ctx, lapStr, VIEW_W - 55, 6, '#fff');
  drawText(ctx, fmt(race.time), VIEW_W - 55, 13, '#ffe14a');
  if (minimap) drawMinimap(ctx, minimap, race, player, t, VIEW_W - minimap.w - 3, 23); // under the lap timer

  // armor and inventory, bottom-left: what you carry, the key that uses it, and how many shots are left
  const y0 = VIEW_H - 96, px = 4, pw = 172;
  box(ctx, px, y0, pw, 86, 0.7);
  drawText(ctx, 'ARMOR', px + 5, y0 + 5, '#bbb');
  ctx.fillStyle = '#331'; ctx.fillRect(px + 30, y0 + 4, 102, 7);
  const frac = Math.max(0, player.armor) / player.maxArmor;
  ctx.fillStyle = frac > 0.5 ? '#3cff7a' : frac > 0.25 ? '#ffe14a' : Math.floor(t * 6) % 2 ? '#ff3b5c' : '#7a1020';
  ctx.fillRect(px + 30, y0 + 4, Math.round(102 * frac), 7);
  drawText(ctx, `KILLS ${player.kills}`, px + 138, y0 + 5, '#ff8a6a');
  const slot = (row, key, icon, name, count, color) => {
    const y = y0 + 16 + row * 22;
    drawIcon(ctx, icon, px + 5, y, 2);
    drawText(ctx, key, px + 27, y + 1, '#8a8094');
    drawText(ctx, name, px + 27, y + 9, count > 0 ? color : '#6a6070');
    for (let k = 0; k < Math.max(3, count); k++) { // one pip per shot
      ctx.fillStyle = k < count ? color : '#2a2030';
      ctx.fillRect(px + 116 + k * 9, y + 6, 7, 7);
    }
  };
  slot(0, 'SPACE', player.loadout.forward, short(player.loadout.forward), player.charges.forward, '#29e3ff');
  slot(1, 'SHIFT', player.loadout.drop, short(player.loadout.drop), player.charges.drop, '#d07bff');
  slot(2, 'E', 'nitro', 'NITRO', Math.floor(player.nitro), '#ffb21e');
  if (player.bonus) { // a crate's bonus shots get used first, so make them impossible to miss
    const bx = px + pw + 4, by = y0 + 16 + (WEAPONS[player.bonus.weapon].slot === 'forward' ? 0 : 22);
    box(ctx, bx, by - 2, 62, 22, 0.8);
    drawIcon(ctx, player.bonus.weapon, bx + 3, by, 2);
    drawText(ctx, `BONUS x${player.bonus.shots}`, bx + 23, by + 5, Math.floor(t * 4) % 2 ? '#ffe14a' : '#fff');
  }
  const driver = DRIVERS[player.stats.driver];
  if (driver) {
    box(ctx, px, y0 - 12, pw, 11, 0.7);
    drawText(ctx, `${driver.short.toUpperCase()}: ${driver.skill.name}`, px + 5, y0 - 9, '#29e3ff');
    if (player.stats.trait) drawText(ctx, player.stats.trait.name, px + pw - 4 - textWidth(player.stats.trait.name), y0 - 9, '#ff8a6a');
    if (portrait?.canvas && !player.bonus) ctx.drawImage(portrait.canvas, px + pw + 4, y0 + 86 - portrait.canvas.height);
  }

  if (player.bomb) {
    const s = `BOMB! ${player.bomb.fuse.toFixed(1)} - RAM SOMEBODY!`;
    box(ctx, 0, 44, VIEW_W, 11, 0.7);
    center(ctx, s, 47, Math.floor(t * 8) % 2 ? '#ff3b5c' : '#ffe14a');
  }

  if (race.phase === 'countdown') {
    center(ctx, String(Math.ceil(race.countdown)), 70, '#ffe14a', 6);
  } else if (race.time < 1.2) {
    center(ctx, 'GO!', 70, '#3cff7a', 6);
  }

  if (banner) {
    box(ctx, ((VIEW_W - textWidth(banner)) / 2 | 0) - 4, 28, textWidth(banner) + 8, 11, 0.75);
    center(ctx, banner, 31, '#ffe14a');
  }

  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.fillRect(0, VIEW_H - 8, VIEW_W, 8);
  center(ctx, bottomBar(player.driverName ?? player.name, player.stats.name), VIEW_H - 7, '#a99fb8');

  if (race.phase === 'finished') drawResults(ctx, race, order, player);
}

function drawResults(ctx, race, order, player) {
  box(ctx, 60, 50, VIEW_W - 120, 30 + order.length * 10, 0.85);
  const place = order.indexOf(player) + 1;
  center(ctx, place === 1 ? 'YOU WON!' : `YOU FINISHED ${['1ST', '2ND', '3RD', '4TH'][place - 1]}`, 56, place === 1 ? '#3cff7a' : '#ffe14a', 2);
  order.forEach((c, i) => {
    const y = 74 + i * 10;
    drawText(ctx, `${i + 1}. ${c.name}`, 72, y, c.color);
    drawText(ctx, c.finished ? fmt(c.finishTime) : 'DNF', 180, y, '#fff');
    drawText(ctx, `${c.kills} KILLS`, 236, y, '#ff8a6a');
  });
  center(ctx, 'PRESS R TO RACE AGAIN   ESC FOR THE MENU', 80 + order.length * 10 - 2, '#a99fb8');
}
