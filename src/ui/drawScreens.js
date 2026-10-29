import { textWidth } from './uiFont.js'; // numeric-scale width: flame text, wrapping and letter boxes size text per call
import { COLOR, LAYOUT, TIMING, tint, smoke, drawStyled, styledWidth } from './theme.js';
import { MENU, OPTIONS, RIDE_ROWS, SERIES_ITEMS, driverList, vehicleList, pickedDriver, pickedVehicle } from './screens.js';
import { drawIcon, WEAPON_INFO } from './icons.js';
import { WEAPONS } from '../combat/weapons.js';
import { statBars } from '../drivers/drivers.js';
import { CLASSES } from '../cars/carStats.js';
import { driverDef, vehicleStats } from '../series/bosses.js';
import { pinupCanvas, pinupFrame, pinupShimmy, shimmyOffset, pinupMotion, PINUP_GROUND } from './pinup.js';
import { artRows } from './pinupArt.js';

// Draws whichever front-end screen is active, at 640x360. assets: { lava, showcase, portrait(key, frame), hits? }.
// Each screen registers its clickable rectangles in assets.hits as it draws (see pointer() in screens.js).
const W = 640, H = 360;
const hit = (a, x, y, w, h, action) => a.hits?.add(x, y, w, h, action);
// Touch mode swaps the keyboard hints for one tap hint.
const footer = (ctx, s, text, y = LAYOUT.footerY) => drawStyled(ctx, s.touch ? TOUCH_HINT : text, W / 2, y, 'small', 'muted', { align: 'center' });
export const TOUCH_HINT = 'TAP TO PICK';
const FIRE = COLOR.fire;
const box = (ctx, x, y, w, h, fill = COLOR.panel, edge = COLOR.panelEdge) => {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
};
const blink = (t, rate = 2) => Math.floor(t * rate) % 2 === 0;
const pseudo = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

// Big flaming text: dark outline, fire-gradient fill by row, and flame licks rising off the top.
function flameText(ctx, str, cx, y, scale, t) {
  const w = textWidth(str, scale), x = Math.round(cx - w / 2); // scale here is a number: flame text is sized per call
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [3, 3]]) drawStyled(ctx, str, x + dx, y + dy, 'small', 'outline', { shadow: null, scale: scale });
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, 5 * scale); ctx.clip();
  for (let r = 0; r < 5; r++) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + r * scale, w, scale); ctx.clip();
    drawStyled(ctx, str, x, y, 'small', FIRE[r], { shadow: null, scale: scale }); ctx.restore();
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
export const GATE_PROMPT_TOUCH = ['TAP', 'IF YOU ARE A GROWN-ASS ADULT'];

// Imported HD art (assets/pinup): fitted to the gate's height (a little taller, so her hops never show its bottom
// edge), moved row by row with the painted girl's motion. Pose images, if given, stand in for those moments;
// without a tease image she fidgets instead.
const ART_H = 328;
function drawPinupArt(ctx, art, t) {
  const m = pinupMotion(t), img = art.poseImgs[m.pose] ?? art.img;
  const scale = ART_H / img.height, w = Math.round(img.width * scale), x0 = 140 - (w >> 1), y0 = H - 320 + m.body;
  const rows = artRows(ART_H, art.chest, m);
  const fidget = m.pose === 'tease' && !art.poseImgs.tease ? (Math.floor(t * 16) % 2 ? 1 : -1) : 0;
  ctx.imageSmoothingEnabled = !art.pixelated;
  for (let y = 0; y < ART_H; y++) { // each screen row shows the source row dy above it: content shifts, nothing tears
    const sy = Math.max(0, Math.min(ART_H - 1, y - rows.dy[y])) / scale;
    ctx.drawImage(img, 0, sy, img.width, 1 / scale, x0 + rows.dx[y] + fidget, y0 + y, w, 1);
  }
  ctx.imageSmoothingEnabled = false;
}

function drawGate(ctx, s, a = {}) {
  ctx.fillStyle = COLOR.gateBg; ctx.fillRect(0, 0, W, H);
  for (let r = 150; r > 0; r -= 10) { // a smoky spotlight behind her
    ctx.fillStyle = smoke(r);
    ctx.beginPath(); ctx.ellipse(140, 190, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = COLOR.gateHazard;
  for (let i = 0; i < W; i += 24) { ctx.fillRect(i, 0, 12, 6); ctx.fillRect(i + 12, H - 6, 12, 6); } // hazard edges
  if (a.gateVideo?.playing) a.gateVideo.draw(ctx); // Eddie's video stands in for the pin-up once it is really playing
  else if (a.pinupArt) drawPinupArt(ctx, a.pinupArt, s.t);
  else {
    const pin = pinupCanvas(pinupFrame(s.t)); // painted at full detail: drawn 1:1, cut at mid-thigh by the bottom of the screen
    const px = Math.round(140 - pin.canvas.width / 2), py = H - PINUP_GROUND, sh = pinupShimmy(s.t);
    ctx.imageSmoothingEnabled = false;
    if (!sh.s && !sh.lag) ctx.drawImage(pin.canvas, px, py);
    else for (let y = 0; y < pin.canvas.height; y++) { // the shimmy: each row slides its own way
      ctx.drawImage(pin.canvas, 0, y, pin.canvas.width, 1, px + shimmyOffset(y, sh.s, sh.lag), py + y, pin.canvas.width, 1);
    }
  }

  const cx = 450;
  flameText(ctx, 'HOLD IT', cx, 40, 6, s.t);
  flameText(ctx, 'RIGHT THERE', cx, 84, 5, s.t + 0.37);
  GATE_TEXT.forEach((l, i) => drawStyled(ctx, l, cx, 136 + i * 16, 'body', 'text', { align: 'center' }));
  if (blink(s.t, 1.6)) (s.touch ? GATE_PROMPT_TOUCH : GATE_PROMPT).forEach((l, i) => drawStyled(ctx, l, cx, 268 + i * 16, 'body', 'gold', { align: 'center' }));
  if (!s.touch) drawStyled(ctx, 'ESC TO LEAVE', cx, 312, 'small', 'hint', { align: 'center' });
  hit(a, 0, 0, W, H, { a: 'ok' });
}

// The title opens like a trailer: the logo slams down from huge, a white flash and a shake, the tagline types
// itself out, then the menu slides in one line at a time. e: seconds since the title appeared.
function drawTitle(ctx, s, a) {
  const e = s.t - (s.titleAt ?? -10), ease = k => Math.max(0, Math.min(1, k));
  a.lava.draw(ctx, s.t, 0);
  ctx.fillStyle = COLOR.titleVeil; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (e > TIMING.slamStart && e < TIMING.slamEnd) ctx.translate(Math.round((pseudo(s.t * 60) - 0.5) * 10 * (TIMING.slamEnd - e) / TIMING.slamStart), Math.round((pseudo(s.t * 77) - 0.5) * 10 * (TIMING.slamEnd - e) / TIMING.slamStart));
  const z = 1 + (1 - ease(e / TIMING.slamStart)) ** 2 * 3;
  ctx.save(); ctx.translate(W / 2, 90); ctx.scale(z, z); ctx.translate(-W / 2, -90);
  flameText(ctx, 'ROLL AND ROCK', W / 2, 46, 7, s.t);
  flameText(ctx, 'HARD RACING', W / 2, 98, 9, s.t + 0.37);
  ctx.restore();
  const tag = 'AN ADULTS-ONLY COMBAT RACER';
  drawStyled(ctx, tag.slice(0, Math.floor(ease((e - TIMING.taglineStart) / TIMING.taglineSecs) * tag.length)), W / 2, 152, 'small', 'text', { align: 'center' });
  const slide = i => Math.round(-((1 - ease((e - TIMING.menuStart - i * TIMING.menuStagger) / TIMING.menuSlideSecs)) ** 2) * 340);
  ctx.save(); ctx.translate(slide(0), 0);
  box(ctx, W / 2 - 110, 178, 220, 22 + MENU.length * 18);
  ctx.restore();
  MENU.forEach((m, i) => {
    ctx.save(); ctx.translate(slide(i + 1), 0);
    const y = 190 + i * 18, sel = i === s.menuIdx;
    const label = m.disabled ? `${m.label}` : m.label;
    drawStyled(ctx, label, W / 2, y, 'body', m.disabled ? 'dim' : sel ? 'gold' : 'text', { align: 'center' });
    if (sel) { const w = styledWidth(label, 'body') / 2 + 14; drawStyled(ctx, '>', W / 2 - w - 4 + (blink(s.t, 4) ? 0 : 2), y, 'body', 'accent'); drawStyled(ctx, '<', W / 2 + w - 2 - (blink(s.t, 4) ? 0 : 2), y, 'body', 'accent'); }
    if (m.disabled) drawStyled(ctx, 'SOON', W / 2 + 84, y + 3, 'small', 'soon', { shadow: null });
    ctx.restore();
    hit(a, W / 2 - 110, y - 4, 220, 18, { a: 'select', i });
  });
  if (e > TIMING.hintAt) footer(ctx, s, 'ARROWS OR WASD TO MOVE   ENTER TO PICK   ESC TO GO BACK');
  ctx.restore();
  if (e > TIMING.flashStart && e < TIMING.flashEnd) { ctx.fillStyle = tint('flash', ((TIMING.flashEnd - e) / (TIMING.flashEnd - TIMING.flashStart)) * 0.85); ctx.fillRect(0, 0, W, H); } // the slam's flash
}

function drawOptions(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'OPTIONS', W / 2, 40, 6, s.t);
  box(ctx, 160, 120, 320, 30 + OPTIONS.length * 26);
  OPTIONS.forEach((o, i) => {
    const y = 136 + i * 26, sel = i === s.optIdx;
    drawStyled(ctx, o.label, 180, y, 'body', sel ? 'gold' : 'text');
    if (o.toggle) drawStyled(ctx, s.settings[o.key] ? 'ON' : 'OFF', 420, y, 'body', s.settings[o.key] ? 'ok' : 'danger');
    hit(a, 160, y - 6, 320, 26, { a: 'select', i });
  });
}

function portrait(ctx, a, key, cx, by, t, i = 0) {
  const frame = (t + i * 0.7) % 3.2 > 3.0 ? 1 : 0; // a blink / glow every few seconds
  const p = a.portrait(key, frame);
  ctx.drawImage(p.canvas, Math.round(cx - p.canvas.width / 2), Math.round(by - p.canvas.height));
}

function vehicleOnPedestal(ctx, a, key, cx, cy, t, dt, scale = 2) {
  ctx.fillStyle = tint('black', 0.55);
  ctx.beginPath(); ctx.ellipse(cx, cy, 88, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLOR.accent;
  for (let k = 0; k < 64; k++) { const ang = (k / 64) * Math.PI * 2 + t * 0.6; if (k % 4) ctx.fillRect(Math.round(cx + Math.cos(ang) * 90), Math.round(cy + Math.sin(ang) * 31), 2, 1); }
  const v = a.showcase?.vehicle(key, t * 0.55, dt);
  if (!v) { drawStyled(ctx, 'IN THE GARAGE', cx, cy - 30, 'body', 'hint', { align: 'center' }); return; }
  ctx.imageSmoothingEnabled = false;
  const size = v.canvas.width * scale;
  ctx.drawImage(v.canvas, Math.round(cx - v.anchor * scale), Math.round(cy - v.anchor * scale), size, size);
}

// Text widths the 6 px small font has to fit: the driver card, the ride's weapon blurb and trait line.
export const SELECT_CARD_W = 370, COMBO_INFO_W = 300, COMBO_CARD_TEXT_W = 300;

// Word-wrap upper-case text to a pixel width (the given scale's font).
export function wrap(text, width, scale = 1) {
  const lines = [''];
  for (const w of String(text).toUpperCase().split(' ')) {
    const cur = lines[lines.length - 1], next = cur ? `${cur} ${w}` : w;
    if (textWidth(next, scale) > width && cur) lines.push(w); else lines[lines.length - 1] = next;
  }
  return lines;
}

// A clickable button: an ember box when it's the selection.
function button(ctx, a, s, x, y, w, h, label, on, region, style = 'body') {
  box(ctx, x, y, w, h, on ? (blink(s.t, 3) ? COLOR.ember : COLOR.emberDim) : COLOR.panel, on ? COLOR.gold : COLOR.panelEdge);
  drawStyled(ctx, label, x + w / 2, y + ((h - 5 * (style === 'heading' ? 3 : style === 'body' ? 2 : 1)) >> 1), style, on ? 'gold' : 'muted', { align: 'center' });
  hit(a, x, y, w, h, region);
}

// A stat bar from base to total, green for gains and red for losses, with the change in per cent.
function statBar(ctx, b, x, y, w, h, pctX) {
  ctx.fillStyle = COLOR.barBack; ctx.fillRect(x, y, w, h);
  const base = Math.round(w * b.base), tot = Math.round(w * b.total);
  ctx.fillStyle = COLOR.text; ctx.fillRect(x, y, Math.min(base, tot), h);
  if (tot > base) { ctx.fillStyle = COLOR.ok; ctx.fillRect(x + base, y, tot - base, h); }
  if (tot < base) { ctx.fillStyle = COLOR.danger; ctx.fillRect(x + tot, y, base - tot, h); }
  const pct = Math.round((b.total / b.base - 1) * 100);
  drawStyled(ctx, pct ? `${pct > 0 ? '+' : ''}${pct}%` : '--', pctX, y, 'small', pct > 0 ? 'ok' : pct < 0 ? 'danger' : 'dim');
}

const MOD_LABELS = [['TOP SPEED', 'speed'], ['ACCEL', 'accel'], ['HANDLING', 'handling'], ['GRIP', 'grip'], ['ARMOR', 'armor']];

// Phase 1, full screen: a big portrait on a spotlight, the driver's card, and the roster strip along the bottom.
function drawDriverPhase(ctx, s, a) {
  a.lava.draw(ctx, s.t, 1);
  const list = driverList(s), sel = s.select, dKey = pickedDriver(s), d = driverDef(dKey);
  if (!s.captionOn) flameText(ctx, 'CHOOSE YOUR DRIVER', W / 2, 8, 4, s.t);

  box(ctx, 10, 40, 220, 196, COLOR.panelSoft);
  for (let r = 90; r > 0; r -= 10) { ctx.fillStyle = smoke(r * 1.6); ctx.beginPath(); ctx.ellipse(120, 150, r, r * 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
  const p = a.portrait(dKey, frameOf(dKey, s.t));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.canvas, Math.round(120 - p.canvas.width), Math.round(232 - p.canvas.height * 2), p.canvas.width * 2, p.canvas.height * 2);

  box(ctx, 240, 40, 390, 196);
  drawStyled(ctx, d.name, 250, 48, 'heading', 'gold');
  drawStyled(ctx, `AKA ${d.short}`.toUpperCase(), 250, 68, 'small', 'muted');
  wrap(d.look, SELECT_CARD_W).slice(0, 2).forEach((l, i) => drawStyled(ctx, l, 250, 80 + i * 9, 'small', 'text'));
  drawStyled(ctx, `SKILL: ${d.skill.name}`, 250, 102, 'body', 'cyan');
  wrap(d.skill.text, SELECT_CARD_W).slice(0, 3).forEach((l, i) => drawStyled(ctx, l, 250, 120 + i * 9, 'small', 'text'));
  drawStyled(ctx, `FAVORITE RIDE: ${vehicleStats(d.fav)?.name ?? ''}`, 250, 150, 'small', 'salmon');
  MOD_LABELS.forEach(([label, k], i) => { // the driver's modifiers, out from a centre line
    const y = 166 + i * 13, v = d.mods?.[k] ?? 0, len = Math.max(-80, Math.min(80, v * 8));
    drawStyled(ctx, label, 250, y, 'small', 'muted');
    ctx.fillStyle = COLOR.barBack; ctx.fillRect(340, y, 160, 6);
    ctx.fillStyle = v > 0 ? COLOR.ok : COLOR.danger; ctx.fillRect(len > 0 ? 420 : 420 + len, y, Math.abs(len), 6);
    ctx.fillStyle = COLOR.text; ctx.fillRect(420, y - 1, 1, 8);
    drawStyled(ctx, v ? `${v > 0 ? '+' : ''}${v}%` : '--', 510, y, 'small', v > 0 ? 'ok' : v < 0 ? 'danger' : 'dim');
  });

  const cell = 66, x0 = Math.round((W - list.length * cell) / 2);
  list.forEach((k, i) => {
    const x = x0 + i * cell, y = 244, on = i === sel.driverIdx;
    ctx.fillStyle = on ? (blink(s.t, 4) ? COLOR.gold : COLOR.accent) : COLOR.barBack;
    ctx.fillRect(x, y, 64, 72);
    ctx.fillStyle = on ? COLOR.rowHi : COLOR.portraitBack; ctx.fillRect(x + 2, y + 2, 60, 68);
    portrait(ctx, a, k, x + 32, y + 58, s.t, i);
    drawStyled(ctx, driverDef(k).short.replace(/^the /i, '').replace(/^king /i, ''), x + 32, y + 62, 'small', on ? 'gold' : 'muted', { align: 'center' });
    hit(a, x, y, 64, 72, { a: 'select', i });
  });
  button(ctx, a, s, 10, 322, 90, 20, 'BACK', false, { a: 'back' }, 'small');
  button(ctx, a, s, 540, 322, 90, 20, 'LOCK IN', true, { a: 'ok' }, 'small');
  footer(ctx, s, 'ARROWS PICK A DRIVER   ENTER TO LOCK IN   ESC BACK');
}

// King Cinder talks with his jaw (frames 2 and 3); everyone else blinks now and then (frame 1).
const frameOf = (key, t, i = 0) => ((t + i * 0.7) % 3.2 > 3.0 ? 1 : 0);

// Phase 2, full screen: the turntable, the combined stats, the weapons, the ride strip and GO TO RACE / BACK.
function drawRidePhase(ctx, s, a, dt) {
  a.lava.draw(ctx, s.t, 2);
  const list = vehicleList(s), sel = s.select, dKey = pickedDriver(s), d = driverDef(dKey), vKey = pickedVehicle(s), v = vehicleStats(vKey);
  const fav = d.fav === vKey, row = sel.row;
  if (!s.captionOn) flameText(ctx, 'CHOOSE YOUR RIDE', W / 2, 8, 4, s.t);

  // the turntable
  box(ctx, 10, 36, 300, 196, row === 'vehicle' ? COLOR.panelStrong : COLOR.panelSoft, row === 'vehicle' ? COLOR.gold : COLOR.panelEdge);
  drawStyled(ctx, v.name, 160, 42, 'heading', row === 'vehicle' ? 'gold' : 'text', { align: 'center' });
  if (CLASSES[v.cls]) {
    drawStyled(ctx, CLASSES[v.cls].label, 160, 62, 'small', 'cyan', { align: 'center' });
    drawStyled(ctx, wrap(CLASSES[v.cls].wins, 280)[0], 160, 72, 'small', 'muted', { align: 'center' });
  }
  vehicleOnPedestal(ctx, a, vKey, 160, 196, s.t, dt);
  drawStyled(ctx, '<', 18, 120, 'heading', 'accent'); drawStyled(ctx, '>', 290, 120, 'heading', 'accent');
  hit(a, 10, 100, 40, 60, { a: 'select', i: 0, then: 'left' });
  hit(a, 270, 100, 40, 60, { a: 'select', i: 0, then: 'right' });
  hit(a, 50, 36, 220, 196, { a: 'select', i: 0, then: null });
  drawStyled(ctx, `${sel.vehicleIdx + 1}/${list.length}`, 302, 222, 'small', 'dim', { shadow: null, align: 'right' });

  // the pairing's stats, trait and favourite-ride badge
  box(ctx, 316, 36, 314, 112);
  drawStyled(ctx, `${d.short} + ${v.name}`.toUpperCase(), 324, 42, 'small', 'text');
  statBars(v, dKey).forEach((b, i) => {
    const y = 54 + i * 13;
    drawStyled(ctx, b.label, 324, y, 'small', 'muted');
    statBar(ctx, b, 390, y, 170, 6, 566);
  });
  if (v.trait) drawStyled(ctx, `TRAIT: ${v.trait.name}`, 324, 118, 'small', 'salmon');
  if (fav) { box(ctx, 320, 130, 306, 14, blink(s.t, 3) ? COLOR.ember : COLOR.emberDeep, COLOR.amber); drawStyled(ctx, 'FAVORITE RIDE!  +5% ALL STATS', 473, 134, 'small', 'gold', { align: 'center' }); }
  else drawStyled(ctx, `FAVORITE RIDE: ${vehicleStats(d.fav)?.name ?? ''}`, 324, 134, 'small', 'dim');

  // the weapons
  box(ctx, 316, 152, 314, 84);
  [['forward', 'SPACE', 'FIRE'], ['drop', 'SHIFT', 'DROP']].forEach(([r, key, verb], i) => {
    const y = 156 + i * 34, on = row === r, w = s.loadout[r], ri = RIDE_ROWS.indexOf(r);
    if (on) { ctx.fillStyle = blink(s.t, 3) ? COLOR.rowHi : COLOR.rowHiDim; ctx.fillRect(320, y - 2, 306, 32); }
    drawStyled(ctx, key, 324, y + 4, 'small', 'muted');
    drawStyled(ctx, verb, 324, y + 12, 'small', 'dim');
    drawStyled(ctx, '<', 360, y + 2, 'body', on ? 'accent' : 'dim');
    drawIcon(ctx, w, 374, y, 2);
    drawStyled(ctx, WEAPONS[w].name, 398, y + 2, 'body', on ? 'gold' : 'text');
    drawStyled(ctx, '>', 612, y + 2, 'body', on ? 'accent' : 'dim');
    wrap(WEAPON_INFO[w], COMBO_INFO_W).slice(0, 2).forEach((l, n) => drawStyled(ctx, l, 398, y + 14 + n * 8, 'small', on ? 'text' : 'hint'));
    hit(a, 316, y - 2, 314, 32, { a: 'select', i: ri, then: null });
    hit(a, 354, y - 2, 18, 18, { a: 'select', i: ri, then: 'left' });
    hit(a, 606, y - 2, 20, 18, { a: 'select', i: ri, then: 'right' });
  });
  drawIcon(ctx, 'nitro', 324, 222, 1);
  drawStyled(ctx, 'E NITRO X3   CHARGES REFILL EVERY LAP', 338, 224, 'small', 'text');

  // the ride strip: two rows of names
  box(ctx, 10, 240, 620, 30);
  list.forEach((k, i) => {
    const col = i % 8, r = Math.floor(i / 8), x = 12 + col * 77, y = 242 + r * 13, on = i === sel.vehicleIdx;
    if (on) { ctx.fillStyle = COLOR.rowHi; ctx.fillRect(x, y, 76, 12); }
    drawStyled(ctx, vehicleStats(k).name, x + 38, y + 3, 'small', on ? 'gold' : 'muted', { align: 'center' });
    hit(a, x, y, 76, 12, { a: 'vehicle', i, then: null });
  });

  button(ctx, a, s, 10, 276, 140, 48, 'BACK', row === 'back', { a: 'select', i: RIDE_ROWS.indexOf('back') }, 'heading');
  button(ctx, a, s, 428, 276, 202, 48, s.mode === 'series' && !s.online ? 'START SERIES' : 'GO TO RACE', row === 'go', { a: 'select', i: RIDE_ROWS.indexOf('go') }, 'heading');
  const help = { vehicle: 'LEFT/RIGHT CHANGE RIDE', forward: 'LEFT/RIGHT CHANGE GUN', drop: 'LEFT/RIGHT CHANGE DROP', go: 'ENTER TO RACE', back: 'ENTER TO CHANGE DRIVER' }[row];
  if (!s.touch) drawStyled(ctx, help, 289, 296, 'small', 'text', { align: 'center' });
  footer(ctx, s, 'UP/DOWN CHOOSE   LEFT/RIGHT CHANGE   ENTER CONFIRM   ESC CHANGE DRIVER');
}

function drawSelect(ctx, s, a, dt) {
  if (s.select.step === 'ride') drawRidePhase(ctx, s, a, dt); else drawDriverPhase(ctx, s, a);
}

function card(ctx, a, combo, x, y, t, label, i) {
  box(ctx, x, y, 190, 70, COLOR.panelStrong, label === 'YOU' ? COLOR.gold : COLOR.danger);
  portrait(ctx, a, combo.driver, x + 34, y + 66, t, i);
  drawStyled(ctx, label, x + 70, y + 8, 'body', label === 'YOU' ? 'gold' : 'danger');
  drawStyled(ctx, driverDef(combo.driver).short, x + 70, y + 28, 'small', 'text');
  drawStyled(ctx, vehicleStats(combo.vehicle).name, x + 70, y + 40, 'small', 'muted');
  if (driverDef(combo.driver).fav === combo.vehicle) drawStyled(ctx, 'FAVORITE RIDE', x + 70, y + 54, 'small', 'amber');
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
  drawStyled(ctx, 'SLAG PIT SPEEDWAY', 300, 222, 'body', 'text', { align: 'center' });
  if (blink(s.t, 3)) drawStyled(ctx, 'GET READY TO GET WRECKED', 300, 244, 'small', 'gold', { align: 'center' });
  hit(a, 0, 0, W, H, { a: 'ok' }); // a click skips
}

// A row of letter boxes for typing (name, room code), with a blinking cursor in the next box.
function letterBoxes(ctx, text, slots, cx, y, t, scale = 4) {
  const cell = 5 * scale + 10, x0 = Math.round(cx - (slots * cell) / 2);
  for (let i = 0; i < slots; i++) {
    const x = x0 + i * cell;
    box(ctx, x, y, cell - 4, 5 * scale + 12, COLOR.panelStrong, i === text.length ? (blink(t, 2) ? COLOR.gold : COLOR.dim) : COLOR.panelEdge);
    if (text[i]) drawStyled(ctx, text[i], x + (cell - 4 - textWidth(text[i], scale)) / 2, y + 6, 'small', 'gold', { scale: scale });
  }
}

function drawName(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'WHO ARE YOU?', W / 2, 50, 6, s.t);
  drawStyled(ctx, 'TYPE YOUR NAME. YOUR FRIENDS WILL SEE IT IN THE LOBBY.', W / 2, 108, 'small', 'text', { align: 'center' });
  letterBoxes(ctx, s.nameInput, 10, W / 2, 140, s.t, 3);
  footer(ctx, s, 'ENTER TO CONTINUE   BACKSPACE TO FIX   ESC BACK');
  hit(a, W / 2 - 160, 140, 320, 40, { a: 'ok' });
}

function drawJoin(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'JOIN ONLINE', W / 2, 40, 6, s.t);
  drawStyled(ctx, 'TYPE THE 4-LETTER ROOM CODE YOUR FRIEND SEES ON THEIR SCREEN', W / 2, 100, 'small', 'text', { align: 'center' });
  letterBoxes(ctx, s.joinCode, 4, W / 2, 128, s.t, 6);
  if (s.joinStatus === 'connecting') drawStyled(ctx, `CONNECTING${'.'.repeat(1 + (Math.floor(s.t * 3) % 3))}`, W / 2, 210, 'body', 'cyan', { align: 'center' });
  if (s.joinError) {
    const lines = wrap(s.joinError, 520, 2);
    lines.forEach((l, i) => drawStyled(ctx, l, W / 2, 210 + i * 16, 'body', 'danger', { align: 'center' }));
  }
  footer(ctx, s, 'ENTER TO JOIN   BACKSPACE TO FIX   ESC BACK');
  hit(a, W / 2 - 160, 128, 320, 60, { a: 'ok' });
}

const LOBBY_LABEL = { pick: 'PICK YOUR COMBO', start: 'GO TO RACE', leave: 'LEAVE' };
function drawLobby(ctx, s, a) {
  a.lava.draw(ctx, s.t, 1);
  const lb = s.lobby;
  flameText(ctx, lb.role === 'host' ? 'YOUR RACE' : 'LOBBY', W / 2, 10, 4, s.t);
  box(ctx, 160, 40, 320, 50);
  drawStyled(ctx, 'ROOM CODE', W / 2, 46, 'small', 'muted', { align: 'center' });
  drawStyled(ctx, lb.code, W / 2, 56, 'display', 'gold', { align: 'center' });
  if (lb.role === 'host') drawStyled(ctx, 'FRIENDS: PRESS JOIN ONLINE AND TYPE THIS CODE', W / 2, 94, 'small', 'text', { align: 'center' });
  for (let i = 0; i < 4; i++) {
    const seat = lb.seats[i], y = 108 + i * 36;
    box(ctx, 40, y, 560, 32, seat ? COLOR.panelStrong : COLOR.panelSoft, seat?.ready ? COLOR.ok : COLOR.panelEdge);
    if (!seat) { drawStyled(ctx, `SEAT ${i + 1}: OPEN (A CPU DRIVES IF NOBODY JOINS)`, 52, y + 12, 'small', 'dim'); continue; }
    if (seat.driver) { const p = a.portrait(seat.driver, 0); ctx.drawImage(p.canvas, 46, y + 31 - Math.min(30, p.canvas.height), Math.round(p.canvas.width * (30 / p.canvas.height)), 30); }
    drawStyled(ctx, `${seat.name}${seat.host ? ' (HOST)' : ''}`, 90, y + 6, 'body', seat.connected === false ? 'dim' : 'gold');
    drawStyled(ctx, seat.driver ? `${driverDef(seat.driver)?.short ?? ''} IN THE ${vehicleStats(seat.vehicle)?.name ?? ''}` : 'PICKING A COMBO...', 90, y + 22, 'small', 'muted');
    drawStyled(ctx, seat.connected === false ? 'LEFT' : seat.ready ? 'READY' : 'NOT READY', 520, y + 12, 'small', seat.connected === false ? 'dim' : seat.ready ? 'ok' : 'salmon');
  }
  lb.items.forEach((item, i) => {
    const x = 120 + i * 140, on = i === lb.idx, w = 130;
    box(ctx, x, 256, w, 26, on ? (blink(s.t, 3) ? COLOR.ember : COLOR.emberDim) : COLOR.panel, on ? COLOR.gold : COLOR.panelEdge);
    drawStyled(ctx, LOBBY_LABEL[item], x + w / 2, 265, 'small', on ? 'gold' : 'muted', { align: 'center' });
    hit(a, x, 256, w, 26, { a: 'select', i });
  });
  drawStyled(ctx, lb.role === 'host' ? 'GO TO RACE STARTS WHEN YOU ARE READY. ANYONE NOT READY IS DRIVEN BY THE CPU' : 'THE HOST STARTS THE RACE. PICK YOUR COMBO TO GET READY', W / 2, 296, 'small', 'text', { align: 'center' });
  footer(ctx, s, 'LEFT/RIGHT OR UP/DOWN CHOOSE   ENTER PICK   ESC LEAVE');
}

// ---------- the series, between races ----------
const SERIES_LABEL = { next: 'NEXT RACE', quit: 'QUIT', done: 'CONTINUE', retry: 'RETRY FINALE' };
const PLACE = ['1ST', '2ND', '3RD', '4TH'];
function seriesButtons(ctx, s, a, y) {
  const items = SERIES_ITEMS[s.screen], w = 150, x0 = W / 2 - (items.length * (w + 10) - 10) / 2;
  items.forEach((item, i) => {
    const x = x0 + i * (w + 10), on = i === s.seriesIdx, wpn = item === 'forward' || item === 'drop';
    if (!wpn) { button(ctx, a, s, x, y, w, 28, SERIES_LABEL[item], on, { a: 'select', i }); return; }
    // a weapon picker, like the ride step's: a tap cycles it, the arrows go either way
    button(ctx, a, s, x, y, w, 28, `${item === 'forward' ? 'GUN' : 'DROP'} < ${WEAPONS[s.loadout[item]].name} >`, on, { a: 'select', i }, 'small');
    hit(a, x, y, 24, 28, { a: 'select', i, then: 'left' });
    hit(a, x + w - 24, y, 24, 28, { a: 'select', i, then: 'right' });
  });
}

// QUIT THE SERIES? over the page; a click anywhere else (or Esc) answers NO.
function quitAsk(ctx, s, a) {
  if (!s.quitAsk) return;
  const P = LAYOUT.pause;
  ctx.fillStyle = COLOR.pauseVeil; ctx.fillRect(0, 0, W, H);
  hit(a, 0, 0, W, H, { a: 'back' });
  drawStyled(ctx, 'QUIT THE SERIES?', W / 2, P.menuTitleY, 'title', 'gold', { align: 'center' });
  ['YES', 'NO'].forEach((label, i) => button(ctx, a, s, (W - P.btnW) / 2, P.btnY + i * (P.btnH + P.btnGap), P.btnW, P.btnH, label, i === s.quitAsk.idx, { a: 'select', i }));
}

function drawStandings(ctx, s, a) {
  a.lava.draw(ctx, s.t, 1);
  const v = s.series ?? { table: [], result: [], race: 0, total: 4, caption: '' };
  if (!s.captionOn) flameText(ctx, 'STANDINGS', W / 2, 8, 4, s.t);
  drawStyled(ctx, `RACE ${v.race} OF ${v.total}`, W / 2, 44, 'body', 'text', { align: 'center' });
  box(ctx, 20, 64, 280, 196);
  drawStyled(ctx, 'RACE RESULT', 30, 72, 'small', 'muted');
  v.result.forEach((r, i) => drawStyled(ctx, `${PLACE[i]}  ${r.name}`, 30, 90 + i * 22, 'body', r.isPlayer ? 'gold' : r.isBoss ? 'danger' : 'text'));
  box(ctx, 320, 64, 300, 196);
  drawStyled(ctx, 'POINTS', 330, 72, 'small', 'muted');
  v.table.forEach((r, i) => {
    const y = 90 + i * 30, col = r.out ? 'dim' : r.isPlayer ? 'gold' : r.isBoss ? 'danger' : 'text';
    drawStyled(ctx, r.name, 330, y, 'body', col);
    drawStyled(ctx, r.out ? `${r.car}   OUT FOR THE FINALE` : r.car, 330, y + 14, 'small', r.out ? 'dim' : 'muted');
    drawStyled(ctx, String(r.points), 610, y, 'body', col, { align: 'right' });
  });
  if (v.caption) drawStyled(ctx, v.caption, W / 2, 270, 'small', 'gold', { align: 'center' });
  seriesButtons(ctx, s, a, 290);
  footer(ctx, s, 'UP/DOWN CHOOSE   LEFT/RIGHT CHANGE WEAPON   ENTER PICK   ESC QUIT');
  quitAsk(ctx, s, a);
}

function drawChampion(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'SERIES CHAMPION', W / 2, 24, 6, s.t);
  box(ctx, 120, 80, 400, 64);
  drawStyled(ctx, 'UNLOCKED', W / 2, 88, 'small', 'muted', { align: 'center' });
  drawStyled(ctx, 'KING CINDER AND THE SLAGHOG', W / 2, 102, 'body', 'gold', { align: 'center' });
  drawStyled(ctx, 'ARE ON YOUR SELECT SCREENS', W / 2, 122, 'small', 'text', { align: 'center' });
  box(ctx, 220, 152, 200, 120, COLOR.portraitBack, COLOR.panelEdge); // the next boss, in silhouette
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath(); ctx.ellipse(320, 196, 34, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(278, 222, 84, 46);
  drawStyled(ctx, '?', 320, 186, 'heading', 'dim', { align: 'center' });
  drawStyled(ctx, 'NEXT SERIES - COMING SOON', W / 2, 278, 'small', 'amber', { align: 'center' });
  seriesButtons(ctx, s, a, 296);
}

function drawBeaten(ctx, s, a) {
  a.lava.draw(ctx, s.t, 2);
  flameText(ctx, 'KING CINDER WINS', W / 2, 20, 5, s.t);
  const talk = Math.floor(s.t * 4.5) % 2, p = a.portrait('kingCinder', blink(s.t, 0.5) ? 2 + talk : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.canvas, Math.round(W / 2 - p.canvas.width), Math.round(232 - p.canvas.height * 2), p.canvas.width * 2, p.canvas.height * 2);
  drawStyled(ctx, 'YOU FINISHED BEHIND THE KING', W / 2, 246, 'body', 'text', { align: 'center' });
  drawStyled(ctx, 'RETRY FINALE: SAME PICKS, STRAIGHT BACK TO THE CRUCIBLE', W / 2, 266, 'small', 'muted', { align: 'center' });
  seriesButtons(ctx, s, a, 290);
  quitAsk(ctx, s, a);
}

export function drawScreen(ctx, s, assets, dt = 1 / 60) {
  if (s.screen === 'gate') drawGate(ctx, s, assets);
  else if (s.screen === 'intro') { ctx.fillStyle = COLOR.introBg; ctx.fillRect(0, 0, W, H); assets.introPlayer?.draw(ctx, s.intro, s.t); hit(assets, 0, 0, W, H, { a: 'ok' }); }
  else if (s.screen === 'title') drawTitle(ctx, s, assets);
  else if (s.screen === 'options') drawOptions(ctx, s, assets);
  else if (s.screen === 'name') drawName(ctx, s, assets);
  else if (s.screen === 'join') drawJoin(ctx, s, assets);
  else if (s.screen === 'lobby') drawLobby(ctx, s, assets);
  else if (s.screen === 'select') drawSelect(ctx, s, assets, dt);
  else if (s.screen === 'vs' || s.screen === 'race') drawVs(ctx, s, assets);
  else if (s.screen === 'standings') drawStandings(ctx, s, assets);
  else if (s.screen === 'champion') drawChampion(ctx, s, assets);
  else if (s.screen === 'beaten') drawBeaten(ctx, s, assets);
  if (s.flash) {
    const w = styledWidth(s.flash.text, 'body') + 16;
    box(ctx, (W - w) / 2, LAYOUT.toast.y, w, LAYOUT.toast.h, COLOR.toast, COLOR.accent);
    drawStyled(ctx, s.flash.text, W / 2, LAYOUT.toast.y + 6, 'body', 'gold', { align: 'center' });
  }
}

// The caption strip for whatever the announcer is saying, word-wrapped. x/w place it (the race keeps it clear
// of the HUD in the bottom-left corner).
export function drawCaption(ctx, text, alpha = 1, { x = LAYOUT.caption.x, w = LAYOUT.caption.w, top = null } = {}) {
  if (!text) return;
  const words = text.toUpperCase().split(' '), lines = [''];
  for (const wd of words) { const cur = lines[lines.length - 1]; if (styledWidth(`${cur} ${wd}`, 'small') > w - 46 && cur) lines.push(wd); else lines[lines.length - 1] = cur ? `${cur} ${wd}` : wd; }
  const h = 8 + lines.length * 10, y = top ?? H - LAYOUT.caption.bottomGap - h;
  ctx.globalAlpha = alpha;
  box(ctx, x, y, w, h, tint('black', 0.8), COLOR.amber);
  drawStyled(ctx, 'MEL:', x + 6, y + 5, 'small', 'amber', { shadow: null });
  lines.forEach((l, i) => drawStyled(ctx, l, x + 34, y + 5 + i * 10, 'small', 'white'));
  ctx.globalAlpha = 1;
}
