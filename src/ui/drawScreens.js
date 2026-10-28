import { drawText, drawCentered, textWidth } from './uiFont.js';
import { MENU, OPTIONS, VEHICLE_KEYS } from './screens.js';
import { drawIcon, WEAPON_INFO } from './icons.js';
import { WEAPONS } from '../combat/weapons.js';
import { DRIVERS, DRIVER_KEYS, statBars } from '../drivers/drivers.js';
import { CAR_STATS, CLASSES } from '../cars/carStats.js';
import { pinupCanvas, pinupFrame, pinupShimmy, shimmyOffset, PINUP_GROUND } from './pinup.js';

// Draws whichever front-end screen is active, at 640x360. assets: { lava, showcase, portrait(key, frame) }.
const W = 640, H = 360;
const FIRE = ['#fff3a0', '#ffd84a', '#ffb21e', '#ff6a1a', '#d83c16', '#8a1e0c'];
const box = (ctx, x, y, w, h, fill = 'rgba(8,6,12,0.78)', edge = '#3a2a40') => {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
};
const blink = (t, rate = 2) => Math.floor(t * rate) % 2 === 0;
const pseudo = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

// Big flaming text: dark outline, fire-gradient fill by row, and flame licks rising off the top.
function flameText(ctx, str, cx, y, scale, t) {
  const w = textWidth(str, scale), x = Math.round(cx - w / 2);
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [3, 3]]) drawText(ctx, str, x + dx, y + dy, '#1a0608', null, scale);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, 5 * scale); ctx.clip();
  for (let r = 0; r < 5; r++) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + r * scale, w, scale); ctx.clip();
    drawText(ctx, str, x, y, FIRE[r], null, scale); ctx.restore();
  }
  ctx.restore();
  for (let i = 0; i < w / 3; i++) {
    const fx = x + pseudo(i) * w, life = (t * (0.8 + pseudo(i + 7)) + pseudo(i + 3)) % 1, h = 4 + pseudo(i + 11) * scale * 2.5;
    const fy = y - life * h;
    ctx.fillStyle = FIRE[Math.min(5, Math.floor(life * 6))];
    ctx.fillRect(Math.round(fx + Math.sin(t * 9 + i) * 1.5), Math.round(fy), life < 0.5 ? 2 : 1, life < 0.5 ? 2 : 1);
  }
}

// The landing page: the pin-up does the warning, the words just list what's in the game.
export const GATE_TEXT = ['STRONG LANGUAGE.', 'CRUDE SEXUAL HUMOR.', 'BRUTAL INSULTS.', 'CARTOON VIOLENCE.', '', 'NOT FOR KIDS.', 'NOT EVEN A LITTLE.'];
export const GATE_PROMPT = ['PRESS ENTER OR CLICK', 'IF YOU ARE A GROWN-ASS ADULT'];

function drawGate(ctx, s) {
  ctx.fillStyle = '#060406'; ctx.fillRect(0, 0, W, H);
  for (let r = 150; r > 0; r -= 10) { // a smoky spotlight behind her
    ctx.fillStyle = `rgba(${120 + r / 3 | 0},20,${50 + r / 4 | 0},0.07)`;
    ctx.beginPath(); ctx.ellipse(140, 190, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#7a0c12';
  for (let i = 0; i < W; i += 24) { ctx.fillRect(i, 0, 12, 6); ctx.fillRect(i + 12, H - 6, 12, 6); } // hazard edges
  const pin = pinupCanvas(pinupFrame(s.t)); // painted at full detail: drawn 1:1, cut at mid-thigh by the bottom of the screen
  const px = Math.round(140 - pin.canvas.width / 2), py = H - PINUP_GROUND, sh = pinupShimmy(s.t);
  ctx.imageSmoothingEnabled = false;
  if (!sh.s && !sh.lag) ctx.drawImage(pin.canvas, px, py);
  else for (let y = 0; y < pin.canvas.height; y++) { // the shimmy: each row slides its own way
    ctx.drawImage(pin.canvas, 0, y, pin.canvas.width, 1, px + shimmyOffset(y, sh.s, sh.lag), py + y, pin.canvas.width, 1);
  }

  const cx = 450;
  flameText(ctx, 'HOLD IT', cx, 40, 6, s.t);
  flameText(ctx, 'RIGHT THERE', cx, 84, 5, s.t + 0.37);
  GATE_TEXT.forEach((l, i) => drawCentered(ctx, l, cx, 136 + i * 16, '#e8e2ea', '#000', 2));
  if (blink(s.t, 1.6)) GATE_PROMPT.forEach((l, i) => drawCentered(ctx, l, cx, 268 + i * 16, '#ffd84a', '#000', 2));
  drawCentered(ctx, 'ESC TO LEAVE', cx, 312, '#8a8094', '#000', 1);
}

// The title opens like a trailer: the logo slams down from huge, a white flash and a shake, the tagline types
// itself out, then the menu slides in one line at a time. e: seconds since the title appeared.
function drawTitle(ctx, s, a) {
  const e = s.t - (s.titleAt ?? -10), ease = k => Math.max(0, Math.min(1, k));
  a.lava.draw(ctx, s.t, 0);
  ctx.fillStyle = 'rgba(6,3,8,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (e > 0.3 && e < 0.6) ctx.translate(Math.round((pseudo(s.t * 60) - 0.5) * 10 * (0.6 - e) / 0.3), Math.round((pseudo(s.t * 77) - 0.5) * 10 * (0.6 - e) / 0.3));
  const z = 1 + (1 - ease(e / 0.3)) ** 2 * 3;
  ctx.save(); ctx.translate(W / 2, 90); ctx.scale(z, z); ctx.translate(-W / 2, -90);
  flameText(ctx, 'ROLL AND ROCK', W / 2, 46, 7, s.t);
  flameText(ctx, 'HARD RACING', W / 2, 98, 9, s.t + 0.37);
  ctx.restore();
  const tag = 'AN ADULTS-ONLY COMBAT RACER';
  drawCentered(ctx, tag.slice(0, Math.floor(ease((e - 0.5) / 0.6) * tag.length)), W / 2, 152, '#e8e2ea', '#000', 1);
  const slide = i => Math.round(-((1 - ease((e - 0.7 - i * 0.07) / 0.25)) ** 2) * 340);
  ctx.save(); ctx.translate(slide(0), 0);
  box(ctx, W / 2 - 110, 178, 220, 22 + MENU.length * 18);
  ctx.restore();
  MENU.forEach((m, i) => {
    ctx.save(); ctx.translate(slide(i + 1), 0);
    const y = 190 + i * 18, sel = i === s.menuIdx;
    const label = m.disabled ? `${m.label}` : m.label;
    drawCentered(ctx, label, W / 2, y, m.disabled ? '#6a6070' : sel ? '#ffd84a' : '#e8e2ea', '#000', 2);
    if (sel) { const w = textWidth(label, 2) / 2 + 14; drawText(ctx, '>', W / 2 - w - 4 + (blink(s.t, 4) ? 0 : 2), y, '#ff6a1a', '#000', 2); drawText(ctx, '<', W / 2 + w - 2 - (blink(s.t, 4) ? 0 : 2), y, '#ff6a1a', '#000', 2); }
    if (m.disabled) drawText(ctx, 'SOON', W / 2 + 84, y + 3, '#8a5a30', null, 1);
    ctx.restore();
  });
  if (e > 1.2) drawCentered(ctx, 'ARROWS OR WASD TO MOVE   ENTER TO PICK   ESC TO GO BACK', W / 2, H - 14, '#a99fb8', '#000', 1);
  ctx.restore();
  if (e > 0.3 && e < 0.55) { ctx.fillStyle = `rgba(255,244,214,${((0.55 - e) / 0.25) * 0.85})`; ctx.fillRect(0, 0, W, H); } // the slam's flash
}

function drawOptions(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'OPTIONS', W / 2, 40, 6, s.t);
  box(ctx, 160, 120, 320, 30 + OPTIONS.length * 26);
  OPTIONS.forEach((o, i) => {
    const y = 136 + i * 26, sel = i === s.optIdx;
    drawText(ctx, o.label, 180, y, sel ? '#ffd84a' : '#e8e2ea', '#000', 2);
    if (o.toggle) drawText(ctx, s.settings[o.key] ? 'ON' : 'OFF', 420, y, s.settings[o.key] ? '#3cff7a' : '#ff3b5c', '#000', 2);
  });
}

function portrait(ctx, a, key, cx, by, t, i = 0) {
  const frame = (t + i * 0.7) % 3.2 > 3.0 ? 1 : 0; // a blink / glow every few seconds
  const p = a.portrait(key, frame);
  ctx.drawImage(p.canvas, Math.round(cx - p.canvas.width / 2), Math.round(by - p.canvas.height));
}

function vehicleOnPedestal(ctx, a, key, cx, cy, t, dt, scale = 2) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 88, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff6a1a';
  for (let k = 0; k < 64; k++) { const ang = (k / 64) * Math.PI * 2 + t * 0.6; if (k % 4) ctx.fillRect(Math.round(cx + Math.cos(ang) * 90), Math.round(cy + Math.sin(ang) * 31), 2, 1); }
  const v = a.showcase?.vehicle(key, t * 0.55, dt);
  if (!v) { drawCentered(ctx, 'IN THE GARAGE', cx, cy - 30, '#8a8094', '#000', 2); return; }
  ctx.imageSmoothingEnabled = false;
  const size = v.canvas.width * scale;
  ctx.drawImage(v.canvas, Math.round(cx - v.anchor * scale), Math.round(cy - v.anchor * scale), size, size);
}

// Word-wrap upper-case text to a pixel width (3x5 font at the given scale).
function wrap(text, width, scale = 1) {
  const lines = [''];
  for (const w of String(text).toUpperCase().split(' ')) {
    const cur = lines[lines.length - 1], next = cur ? `${cur} ${w}` : w;
    if (textWidth(next, scale) > width && cur) lines.push(w); else lines[lines.length - 1] = next;
  }
  return lines;
}

function abilityCard(ctx, x, y, w, h, title, titleCol, name, text, on = true) {
  box(ctx, x, y, w, h, on ? 'rgba(8,6,12,0.85)' : 'rgba(8,6,12,0.6)', on ? titleCol : '#3a2a40');
  drawText(ctx, title, x + 6, y + 6, titleCol, '#000', 1);
  drawText(ctx, name, x + 6, y + 16, on ? '#ffd84a' : '#6a6070', '#000', 2);
  wrap(text, w - 12).slice(0, 4).forEach((l, i) => drawText(ctx, l, x + 6, y + 32 + i * 9, on ? '#e8e2ea' : '#6a6070', '#000', 1));
}

// Step 3: everything the pairing gives you, the weapons you'll carry, then GO TO RACE.
function drawCombo(ctx, s, a, dt) {
  a.lava.draw(ctx, s.t, 2);
  const sel = s.select, dKey = DRIVER_KEYS[sel.driverIdx], d = DRIVERS[dKey], vKey = VEHICLE_KEYS[sel.vehicleIdx], v = CAR_STATS[vKey];
  const fav = d.fav === vKey;
  if (!s.captionOn) flameText(ctx, 'YOUR COMBO', W / 2, 8, 4, s.t); // while the announcer talks, his caption takes the title's place

  // driver
  box(ctx, 10, 36, 120, 136);
  const p = a.portrait(dKey, (s.t % 3.2) > 3 ? 1 : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.canvas, Math.round(70 - p.canvas.width), Math.round(148 - p.canvas.height * 2), p.canvas.width * 2, p.canvas.height * 2);
  drawCentered(ctx, d.short, 70, 152, '#ffd84a', '#000', 2);

  // combined stats
  box(ctx, 136, 36, 250, 136);
  drawText(ctx, `${d.short} + ${v.name}`, 144, 44, '#e8e2ea', '#000', 1);
  statBars(v, dKey).forEach((b, i) => {
    const y = 60 + i * 21, x = 144, w = 200;
    drawText(ctx, b.label, x, y, '#a99fb8', '#000', 1);
    ctx.fillStyle = '#2a2030'; ctx.fillRect(x, y + 8, w, 7);
    const base = Math.round(w * b.base), tot = Math.round(w * b.total);
    ctx.fillStyle = '#e8e2ea'; ctx.fillRect(x, y + 8, Math.min(base, tot), 7);
    if (tot > base) { ctx.fillStyle = '#3cff7a'; ctx.fillRect(x + base, y + 8, tot - base, 7); }
    if (tot < base) { ctx.fillStyle = '#ff3b5c'; ctx.fillRect(x + tot, y + 8, base - tot, 7); }
    const pct = Math.round((b.total / b.base - 1) * 100);
    drawText(ctx, pct ? `${pct > 0 ? '+' : ''}${pct}%` : '--', x + w + 6, y + 9, pct > 0 ? '#3cff7a' : pct < 0 ? '#ff3b5c' : '#6a6070', '#000', 1);
  });

  // vehicle
  box(ctx, 392, 36, 238, 136, 'rgba(8,6,12,0.55)');
  drawCentered(ctx, v.name, 511, 44, '#ffd84a', '#000', 2);
  if (CLASSES[v.cls]) drawCentered(ctx, CLASSES[v.cls].label, 511, 58, '#29e3ff', '#000', 1);
  vehicleOnPedestal(ctx, a, vKey, 511, 140, s.t, dt);

  // what the pairing can do
  abilityCard(ctx, 10, 178, 204, 84, 'DRIVER SKILL', '#29e3ff', d.skill.name, d.skill.text);
  abilityCard(ctx, 218, 178, 204, 84, 'VEHICLE TRAIT', '#ff8a6a', v.trait?.name ?? '', v.trait?.text ?? '');
  abilityCard(ctx, 426, 178, 204, 84, fav ? 'FAVORITE RIDE!' : 'FAVORITE RIDE', '#ffb21e', fav ? '+5% ALL STATS' : CAR_STATS[d.fav].name,
    fav ? `${d.short} drives this one best: every stat gets 5% better` : `${d.short} gets +5% to every stat in the ${CAR_STATS[d.fav].name}`, fav);

  // loadout + go
  box(ctx, 10, 268, 412, 72);
  [['forward', 'SPACE', 'FIRE'], ['drop', 'SHIFT', 'DROP']].forEach(([row, key, verb], i) => {
    const y = 274 + i * 22, on = sel.row === row, w = s.loadout[row];
    if (on) { ctx.fillStyle = blink(s.t, 3) ? '#3a1810' : '#2a120c'; ctx.fillRect(14, y - 2, 404, 20); }
    drawText(ctx, key, 20, y + 4, '#a99fb8', '#000', 1);
    drawText(ctx, verb, 54, y + 4, '#6a6070', '#000', 1);
    if (on) drawText(ctx, '<', 86, y + 2, '#ff6a1a', '#000', 2);
    drawIcon(ctx, w, 100, y, 2);
    drawText(ctx, WEAPONS[w].name, 124, y + 2, on ? '#ffd84a' : '#e8e2ea', '#000', 2);
    if (on) drawText(ctx, '>', 124 + textWidth(WEAPONS[w].name, 2) + 6, y + 2, '#ff6a1a', '#000', 2);
    drawText(ctx, WEAPON_INFO[w], 230, y + 4, on ? '#e8e2ea' : '#8a8094', '#000', 1);
  });
  drawText(ctx, 'E', 20, 323, '#a99fb8', '#000', 1);
  drawText(ctx, 'BOOST', 54, 323, '#6a6070', '#000', 1);
  drawIcon(ctx, 'nitro', 100, 318, 2);
  drawText(ctx, 'NITRO X3   CHARGES REFILL EVERY LAP', 124, 323, '#e8e2ea', '#000', 1);

  const go = sel.row === 'go';
  box(ctx, 428, 268, 202, 72, go ? (blink(s.t, 3) ? '#7a1e0c' : '#4a120a') : 'rgba(8,6,12,0.8)', go ? '#ffd84a' : '#3a2a40');
  drawCentered(ctx, 'GO TO RACE', 529, 290, go ? '#ffd84a' : '#a99fb8', '#000', 3);
  drawCentered(ctx, go ? 'PRESS ENTER' : 'DOWN TO SELECT', 529, 318, go ? '#e8e2ea' : '#6a6070', '#000', 1);
  drawCentered(ctx, 'UP/DOWN CHOOSE   LEFT/RIGHT CHANGE WEAPON   ENTER CONFIRM   ESC CHANGE RIDE', W / 2, H - 12, '#a99fb8', '#000', 1);
}

function drawSelect(ctx, s, a, dt) {
  if (s.select.step === 'combo') { drawCombo(ctx, s, a, dt); return; }
  a.lava.draw(ctx, s.t, 1);
  const sel = s.select, dKey = DRIVER_KEYS[sel.driverIdx], d = DRIVERS[dKey], vKey = VEHICLE_KEYS[sel.vehicleIdx], v = CAR_STATS[vKey];
  flameText(ctx, sel.step === 'driver' ? 'CHOOSE YOUR DRIVER' : 'CHOOSE YOUR RIDE', W / 2, 12, 4, s.t);

  // driver grid, left
  box(ctx, 10, 44, 276, 160);
  DRIVER_KEYS.forEach((k, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 16 + col * 67, y = 50 + row * 76, on = i === sel.driverIdx;
    ctx.fillStyle = on ? (sel.step === 'driver' ? (blink(s.t, 4) ? '#ffd84a' : '#ff6a1a') : '#ffb21e') : '#2a2030';
    ctx.fillRect(x, y, 64, 72);
    ctx.fillStyle = on ? '#3a1810' : '#140e18'; ctx.fillRect(x + 2, y + 2, 60, 68);
    portrait(ctx, a, k, x + 32, y + 58, s.t, i);
    drawCentered(ctx, DRIVERS[k].short.replace(/^the /i, ''), x + 32, y + 62, on ? '#ffd84a' : '#a99fb8', '#000', 1);
    if (sel.step === 'vehicle' && !on) { ctx.fillStyle = 'rgba(8,6,12,0.62)'; ctx.fillRect(x, y, 64, 72); } // the driver is picked: the rest step back
    if (sel.step === 'vehicle' && on) drawCentered(ctx, 'LOCKED IN', x + 32, y + 5, '#3cff7a', '#000', 1);
  });

  // driver card under the grid
  box(ctx, 10, 210, 276, 74);
  drawText(ctx, d.name, 18, 218, '#ffd84a', '#000', 1);
  drawText(ctx, d.look, 18, 228, '#a99fb8', '#000', 1);
  drawText(ctx, `SKILL: ${d.skill.name}`, 18, 242, '#29e3ff', '#000', 1);
  drawText(ctx, d.skill.text, 18, 252, '#e8e2ea', '#000', 1);
  drawText(ctx, `FAVORITE RIDE: ${CAR_STATS[d.fav].name}`, 18, 266, '#ff8a6a', '#000', 1);

  // vehicle turntable, right
  box(ctx, 296, 44, 334, 160, 'rgba(8,6,12,0.55)');
  drawCentered(ctx, v.name, 463, 52, sel.step === 'vehicle' ? '#ffd84a' : '#e8e2ea', '#000', 3);
  if (CLASSES[v.cls]) drawCentered(ctx, `${CLASSES[v.cls].label}: ${CLASSES[v.cls].wins}`, 463, 72, '#29e3ff', '#000', 1);
  if (sel.step === 'vehicle') { drawText(ctx, '<', 306, 116, '#ff6a1a', '#000', 3); drawText(ctx, '>', 612, 116, '#ff6a1a', '#000', 3); }
  vehicleOnPedestal(ctx, a, vKey, 463, 166, s.t, dt);
  drawText(ctx, `${sel.vehicleIdx + 1}/${VEHICLE_KEYS.length}`, 596, 192, '#6a6070', null, 1);
  if (v.trait) drawText(ctx, `TRAIT: ${v.trait.name}`, 304, 192, '#ff8a6a', '#000', 1);

  // combined stats, bottom right
  box(ctx, 296, 210, 334, 74);
  statBars(v, dKey).forEach((b, i) => {
    const y = 218 + i * 12, x = 380, w = 200;
    drawText(ctx, b.label, 304, y, '#a99fb8', '#000', 1);
    ctx.fillStyle = '#2a2030'; ctx.fillRect(x, y, w, 6);
    const base = Math.round(w * b.base), tot = Math.round(w * b.total);
    ctx.fillStyle = '#e8e2ea'; ctx.fillRect(x, y, Math.min(base, tot), 6);
    if (tot > base) { ctx.fillStyle = '#3cff7a'; ctx.fillRect(x + base, y, tot - base, 6); }
    if (tot < base) { ctx.fillStyle = '#ff3b5c'; ctx.fillRect(x + tot, y, base - tot, 6); }
    const pct = Math.round((b.total / b.base - 1) * 100);
    if (pct) drawText(ctx, `${pct > 0 ? '+' : ''}${pct}%`, 588, y, pct > 0 ? '#3cff7a' : '#ff3b5c', '#000', 1);
  });
  if (d.fav === vKey) {
    box(ctx, 296, 290, 334, 18, blink(s.t, 3) ? '#7a1e0c' : '#3a0e08', '#ffb21e');
    drawCentered(ctx, `FAVORITE RIDE!  +5% ALL STATS`, 463, 296, '#ffd84a', '#000', 1);
  }
  drawCentered(ctx, sel.step === 'driver' ? 'ARROWS PICK A DRIVER   ENTER TO LOCK IN   ESC BACK' : 'LEFT/RIGHT PICK A RIDE   ENTER TO SEE YOUR COMBO   ESC CHANGE DRIVER', W / 2, H - 14, '#a99fb8', '#000', 1);
}

function card(ctx, a, combo, x, y, t, label, i) {
  box(ctx, x, y, 190, 70, 'rgba(8,6,12,0.85)', label === 'YOU' ? '#ffd84a' : '#ff3b5c');
  portrait(ctx, a, combo.driver, x + 34, y + 66, t, i);
  drawText(ctx, label, x + 70, y + 8, label === 'YOU' ? '#ffd84a' : '#ff3b5c', '#000', 2);
  drawText(ctx, DRIVERS[combo.driver].short, x + 70, y + 28, '#e8e2ea', '#000', 1);
  drawText(ctx, CAR_STATS[combo.vehicle].name, x + 70, y + 40, '#a99fb8', '#000', 1);
  if (DRIVERS[combo.driver].fav === combo.vehicle) drawText(ctx, 'FAVORITE RIDE', x + 70, y + 54, '#ffb21e', '#000', 1);
}

function drawVs(ctx, s, a) {
  a.lava.draw(ctx, s.t, 1);
  const k = Math.min(1, s.vs.timer / 0.35), ease = 1 - (1 - k) ** 3;
  card(ctx, a, s.player, -200 + ease * 230, 140, s.t, 'YOU', 0);
  s.vs.rivals.forEach((r, i) => {
    const kk = Math.min(1, Math.max(0, (s.vs.timer - 0.1 * i) / 0.35)), e = 1 - (1 - kk) ** 3;
    card(ctx, a, r, W + 10 - e * 230, 36 + i * 82, s.t, `CPU ${i + 1}`, i + 1);
  });
  const pulse = 9 + (Math.floor(s.t * 8) % 2);
  flameText(ctx, 'VS', 300, 150, pulse, s.t);
  drawCentered(ctx, 'SLAG PIT SPEEDWAY', 300, 222, '#e8e2ea', '#000', 2);
  if (blink(s.t, 3)) drawCentered(ctx, 'GET READY TO GET WRECKED', 300, 244, '#ffd84a', '#000', 1);
}

// A row of letter boxes for typing (name, room code), with a blinking cursor in the next box.
function letterBoxes(ctx, text, slots, cx, y, t, scale = 4) {
  const cell = 5 * scale + 10, x0 = Math.round(cx - (slots * cell) / 2);
  for (let i = 0; i < slots; i++) {
    const x = x0 + i * cell;
    box(ctx, x, y, cell - 4, 5 * scale + 12, 'rgba(8,6,12,0.85)', i === text.length ? (blink(t, 2) ? '#ffd84a' : '#6a6070') : '#3a2a40');
    if (text[i]) drawText(ctx, text[i], x + (cell - 4 - textWidth(text[i], scale)) / 2, y + 6, '#ffd84a', '#000', scale);
  }
}

function drawName(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'WHO ARE YOU?', W / 2, 50, 6, s.t);
  drawCentered(ctx, 'TYPE YOUR NAME. YOUR FRIENDS WILL SEE IT IN THE LOBBY.', W / 2, 108, '#e8e2ea', '#000', 1);
  letterBoxes(ctx, s.nameInput, 10, W / 2, 140, s.t, 3);
  drawCentered(ctx, 'ENTER TO CONTINUE   BACKSPACE TO FIX   ESC BACK', W / 2, H - 14, '#a99fb8', '#000', 1);
}

function drawJoin(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'JOIN ONLINE', W / 2, 40, 6, s.t);
  drawCentered(ctx, 'TYPE THE 4-LETTER ROOM CODE YOUR FRIEND SEES ON THEIR SCREEN', W / 2, 100, '#e8e2ea', '#000', 1);
  letterBoxes(ctx, s.joinCode, 4, W / 2, 128, s.t, 6);
  if (s.joinStatus === 'connecting') drawCentered(ctx, `CONNECTING${'.'.repeat(1 + (Math.floor(s.t * 3) % 3))}`, W / 2, 210, '#29e3ff', '#000', 2);
  if (s.joinError) {
    const lines = wrap(s.joinError, 520, 2);
    lines.forEach((l, i) => drawCentered(ctx, l, W / 2, 210 + i * 16, '#ff3b5c', '#000', 2));
  }
  drawCentered(ctx, 'ENTER TO JOIN   BACKSPACE TO FIX   ESC BACK', W / 2, H - 14, '#a99fb8', '#000', 1);
}

const LOBBY_LABEL = { pick: 'PICK YOUR COMBO', start: 'GO TO RACE', leave: 'LEAVE' };
function drawLobby(ctx, s, a) {
  a.lava.draw(ctx, s.t, 1);
  const lb = s.lobby;
  flameText(ctx, lb.role === 'host' ? 'YOUR RACE' : 'LOBBY', W / 2, 10, 4, s.t);
  box(ctx, 160, 40, 320, 50);
  drawCentered(ctx, 'ROOM CODE', W / 2, 46, '#a99fb8', '#000', 1);
  drawCentered(ctx, lb.code, W / 2, 56, '#ffd84a', '#000', 5);
  if (lb.role === 'host') drawCentered(ctx, 'FRIENDS: PRESS JOIN ONLINE AND TYPE THIS CODE', W / 2, 94, '#e8e2ea', '#000', 1);
  for (let i = 0; i < 4; i++) {
    const seat = lb.seats[i], y = 108 + i * 36;
    box(ctx, 40, y, 560, 32, seat ? 'rgba(8,6,12,0.85)' : 'rgba(8,6,12,0.5)', seat?.ready ? '#3cff7a' : '#3a2a40');
    if (!seat) { drawText(ctx, `SEAT ${i + 1}: OPEN (A CPU DRIVES IF NOBODY JOINS)`, 52, y + 12, '#6a6070', '#000', 1); continue; }
    if (seat.driver) { const p = a.portrait(seat.driver, 0); ctx.drawImage(p.canvas, 46, y + 31 - Math.min(30, p.canvas.height), Math.round(p.canvas.width * (30 / p.canvas.height)), 30); }
    drawText(ctx, `${seat.name}${seat.host ? ' (HOST)' : ''}`, 90, y + 6, seat.connected === false ? '#6a6070' : '#ffd84a', '#000', 2);
    drawText(ctx, seat.driver ? `${DRIVERS[seat.driver].short} IN THE ${CAR_STATS[seat.vehicle].name}` : 'PICKING A COMBO...', 90, y + 22, '#a99fb8', '#000', 1);
    drawText(ctx, seat.connected === false ? 'LEFT' : seat.ready ? 'READY' : 'NOT READY', 520, y + 12, seat.connected === false ? '#6a6070' : seat.ready ? '#3cff7a' : '#ff8a6a', '#000', 1);
  }
  lb.items.forEach((item, i) => {
    const x = 120 + i * 140, on = i === lb.idx, w = 130;
    box(ctx, x, 256, w, 26, on ? (blink(s.t, 3) ? '#7a1e0c' : '#4a120a') : 'rgba(8,6,12,0.8)', on ? '#ffd84a' : '#3a2a40');
    drawCentered(ctx, LOBBY_LABEL[item], x + w / 2, 265, on ? '#ffd84a' : '#a99fb8', '#000', 1);
  });
  drawCentered(ctx, lb.role === 'host' ? 'GO TO RACE STARTS WHEN YOU ARE READY. ANYONE NOT READY IS DRIVEN BY THE CPU' : 'THE HOST STARTS THE RACE. PICK YOUR COMBO TO GET READY', W / 2, 296, '#e8e2ea', '#000', 1);
  drawCentered(ctx, 'LEFT/RIGHT OR UP/DOWN CHOOSE   ENTER PICK   ESC LEAVE', W / 2, H - 14, '#a99fb8', '#000', 1);
}

export function drawScreen(ctx, s, assets, dt = 1 / 60) {
  if (s.screen === 'gate') drawGate(ctx, s);
  else if (s.screen === 'title') drawTitle(ctx, s, assets);
  else if (s.screen === 'options') drawOptions(ctx, s, assets);
  else if (s.screen === 'name') drawName(ctx, s, assets);
  else if (s.screen === 'join') drawJoin(ctx, s, assets);
  else if (s.screen === 'lobby') drawLobby(ctx, s, assets);
  else if (s.screen === 'select') drawSelect(ctx, s, assets, dt);
  else if (s.screen === 'vs' || s.screen === 'race') drawVs(ctx, s, assets);
  if (s.flash) {
    const w = textWidth(s.flash.text, 2) + 16;
    box(ctx, (W - w) / 2, H - 46, w, 20, 'rgba(60,10,8,0.9)', '#ff6a1a');
    drawCentered(ctx, s.flash.text, W / 2, H - 40, '#ffd84a', '#000', 2);
  }
}

// The caption strip for whatever the announcer is saying, word-wrapped. x/w place it (the race keeps it clear
// of the HUD in the bottom-left corner).
export function drawCaption(ctx, text, alpha = 1, { x = 30, w = W - 60, top = null } = {}) {
  if (!text) return;
  const words = text.toUpperCase().split(' '), lines = [''];
  for (const wd of words) { const cur = lines[lines.length - 1]; if (textWidth(`${cur} ${wd}`, 1) > w - 40 && cur) lines.push(wd); else lines[lines.length - 1] = cur ? `${cur} ${wd}` : wd; }
  const h = 8 + lines.length * 9, y = top ?? H - 14 - h;
  ctx.globalAlpha = alpha;
  box(ctx, x, y, w, h, 'rgba(0,0,0,0.8)', '#ffb21e');
  drawText(ctx, 'MEL:', x + 6, y + 5, '#ffb21e', null, 1);
  lines.forEach((l, i) => drawText(ctx, l, x + 28, y + 5 + i * 9, '#fff', '#000', 1));
  ctx.globalAlpha = 1;
}
