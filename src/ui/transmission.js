// The C&C-style transmission: King Cinder's briefing, played as pre-rendered "video" on a CRT. The timelines and
// transmissionAt are pure; drawTransmission is the browser side. The integrator supplies the pictures:
//   assets.flyover(ctx, secs)       draws the Slag Pit flyover (640x360) for the title card
//   assets.ride(ctx, secs)          draws the Slaghog turntable (640x360)
//   assets.portrait(key, frame)     a baked portrait: a canvas, or { canvas, ox, oy }. kingCinder frames 0/1 idle, 2/3 talk
//   assets.name                     the player's driver, for {name}
//   assets.makeCanvas(w, h)         optional; defaults to document.createElement('canvas')
// Purely visual: Math.random is never used, the noise is a hash of the time, so the race stays deterministic.
import { LINES } from '../audio/lines.js';
import { drawText, textWidth } from './uiFont.js';
import { TEXT, COLOR, rgba, tint } from './theme.js';

const W = 640, H = 360, BAR = 24; // the letterbox: black bars top and bottom
const LO_W = W / 2, LO_H = H / 2; // the "video" resolution: posterised and dithered, then doubled
const TYPE_CPS = 30, JAW_HZ = 9; // typewriter speed; the jaw flaps at JAW_HZ / 2 open-shut cycles a second
const BOOT_STATIC = 0.5, CUT_STATIC = 0.12; // the static burst at the start, and the flicker at each shot change
const LEVELS = 6; // colour levels per channel after posterising

const say = line => line.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim(); // drop the ElevenLabs tags

export const TRANSMISSIONS = {
  seriesIntro: [
    { at: 0, shot: 'boot', text: 'INCOMING TRANSMISSION...' },
    { at: 1.4, shot: 'boot', text: 'SIGNAL ACQUIRED' },
    { at: 2.4, shot: 'title', text: 'THE SLAG CIRCUIT' },
    { at: 6.4, shot: 'head', text: say(LINES.cinder_intro[0]) },
    { at: 10.6, shot: 'head', text: say(LINES.cinder_intro[5]) },
    { at: 14.8, shot: 'ride', text: 'THREAT LEVEL: MOLTEN' },
    { at: 18.4, shot: 'end', text: 'TRANSMISSION ENDS' },
    { at: 20, shot: 'end' }, // the static cut; the transmission is over
  ],
  finaleTaunt: [
    { at: 0, shot: 'boot', text: 'INCOMING TRANSMISSION...' },
    { at: 0.8, shot: 'head', text: say(LINES.cinder_taunt[0]) },
    { at: 4.6, shot: 'ride', text: 'THREAT LEVEL: MOLTEN' },
    { at: 6.8, shot: 'end', text: 'TRANSMISSION ENDS' },
    { at: 8, shot: 'end' },
  ],
};

// Where a transmission is at time t (seconds): the shot, its full text ({name} filled in), the part typed so far,
// whether King Cinder's jaw is open, the seconds into this beat, and whether it has finished.
export function transmissionAt(script, t, name = 'DRIVER') {
  let i = 0;
  while (i + 1 < script.length && script[i + 1].at <= t) i++;
  const beat = script[i], since = Math.max(0, t - beat.at);
  const text = (beat.text ?? '').replaceAll('{name}', name);
  const typed = text.slice(0, Math.floor(since * TYPE_CPS));
  const typing = typed.length < text.length;
  const jawOpen = beat.shot === 'head' && typing && Math.floor(since * JAW_HZ) % 2 === 0;
  return { shot: beat.shot, text, typed, jawOpen, since, index: i, done: i === script.length - 1 && t >= beat.at };
}

// ---- drawing ----

let buf = null;
function buffers(assets) {
  if (buf) return buf;
  const make = assets.makeCanvas ?? ((w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const src = make(W, H), lo = make(LO_W, LO_H), fringe = make(LO_W, LO_H);
  buf = { src, sctx: src.getContext('2d'), lo, lctx: lo.getContext('2d', { willReadFrequently: true }), fringe, fctx: fringe.getContext('2d') };
  return buf;
}

const hash = (x, y, f) => { // 0..1, stable for a given pixel and frame
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(f, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);

function staticAmount(script, s) {
  if (s.done) return 1;
  if (s.index === 0 && s.since < BOOT_STATIC) return 1 - (s.since / BOOT_STATIC) * 0.7;
  if (s.since < CUT_STATIC) return 0.6;
  return s.shot === 'boot' || s.shot === 'end' ? 0.12 : 0.03;
}

function drawHead(c, s, t, assets) {
  const g = c.createLinearGradient ? c.createLinearGradient(0, 0, 0, H) : null;
  if (g) { g.addColorStop(0, '#1a0806'); g.addColorStop(1, '#4a1408'); c.fillStyle = g; } else c.fillStyle = '#2a0c06';
  c.fillRect(0, 0, W, H);
  const pulse = Math.floor(t * 2.5) % 2; // frames 0/1 (and 2/3) pulse the seams and eyes
  const p = assets.portrait?.('kingCinder', (s.jawOpen ? 2 : 0) + pulse);
  if (!p) return;
  const img = p.canvas ?? p, pw = img.width, ph = img.height, S = 3;
  const x0 = Math.round((W - pw * S) / 2), y0 = Math.round(H - BAR - 40 - ph * S + 20);
  c.imageSmoothingEnabled = false;
  for (let row = 0; row < ph; row += 2) { // heat haze: each strip wobbles sideways a pixel
    const dx = Math.round(Math.sin(t * 5 + row * 0.35)) * S;
    c.drawImage(img, 0, row, pw, 2, x0 + dx, y0 + row * S, pw * S, 2 * S);
  }
  for (let d = 0; d < 6; d++) { // lava drips falling off the jaw and shoulders
    const fall = (t * 0.7 + d * 0.37) % 1, x = x0 + Math.round(pw * S * (0.2 + 0.12 * d));
    c.fillStyle = fall < 0.8 ? COLOR.accent : COLOR.gold;
    c.fillRect(x, y0 + ph * S * 0.55 + fall * ph * S * 0.5, S, S * 2);
  }
  c.fillStyle = rgba(255, 90, 20, 0.05 + 0.04 * pulse); // the glow he gives off
  c.fillRect(0, 0, W, H);
}

function drawScene(c, s, t, assets) {
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  if (s.shot === 'title') assets.flyover?.(c, s.since);
  else if (s.shot === 'ride') { c.fillStyle = '#120808'; c.fillRect(0, 0, W, H); assets.ride?.(c, s.since); }
  else if (s.shot === 'head') drawHead(c, s, t, assets);
}

// Posterise and dither the half-res frame, mixing in static.
function filterVideo(lctx, amount, frame) {
  const img = lctx.getImageData(0, 0, LO_W, LO_H), d = img.data, step = 255 / (LEVELS - 1);
  for (let y = 0, i = 0; y < LO_H; y++) for (let x = 0; x < LO_W; x++, i += 4) {
    const b = BAYER[(y & 3) * 4 + (x & 3)] * step, n = hash(x, y, frame) * 255;
    for (let k = 0; k < 3; k++) {
      const v = d[i + k] + (n - d[i + k]) * amount;
      d[i + k] = Math.round((v + b) / step) * step;
    }
    d[i + 3] = 255;
  }
  lctx.putImageData(img, 0, 0);
}

function wrapWords(text, width, scale) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, scale) > width) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawOverlay(ctx, s, t) {
  const blink = Math.floor(t * 3) % 2 === 0, cursor = s.typed.length < s.text.length || blink ? '_' : '';
  if (s.shot === 'boot' || (s.shot === 'end' && s.text)) {
    const sc = TEXT.heading.scale, x = (W - textWidth(s.text, sc)) / 2;
    drawText(ctx, s.typed + cursor, x, H / 2 - 8, COLOR.amber, COLOR.shadow, sc);
  } else if (s.shot === 'title') {
    const sc = TEXT.display.scale, x = (W - textWidth(s.text, sc)) / 2;
    drawText(ctx, s.typed, x, 120, COLOR.gold, COLOR.outline, sc);
    if (s.typed === s.text) drawText(ctx, 'SERIES 1   FOUR RACES   ONE KING', (W - textWidth('SERIES 1   FOUR RACES   ONE KING', 2)) / 2, 160, COLOR.text, COLOR.shadow, TEXT.body.scale);
  } else if (s.shot === 'head') {
    const sc = TEXT.body.scale, lines = wrapWords(s.text.toUpperCase(), W - 80, sc);
    const y0 = H - BAR - 14 - lines.length * 13;
    ctx.fillStyle = tint('black', 0.55);
    ctx.fillRect(30, y0 - 18, W - 60, lines.length * 13 + 24);
    drawText(ctx, 'KING CINDER', 40, y0 - 13, COLOR.accent, COLOR.shadow, 1);
    let left = s.typed.length;
    lines.forEach((l, i) => {
      const shown = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      if (shown) drawText(ctx, shown, 40, y0 + i * 13, COLOR.text, COLOR.shadow, sc);
    });
  } else if (s.shot === 'ride' && s.since > 0.6) { // the stamp slams down
    const k = Math.min(1, (s.since - 0.6) / 0.15), sc = TEXT.title.scale, tw = textWidth(s.text, sc);
    ctx.save();
    ctx.translate(W / 2, H - BAR - 60);
    ctx.rotate(-0.1);
    ctx.scale(1.8 - 0.8 * k, 1.8 - 0.8 * k);
    ctx.globalAlpha = k;
    ctx.strokeStyle = COLOR.danger;
    ctx.lineWidth = 3;
    ctx.strokeRect(-tw / 2 - 10, -14, tw + 20, 34);
    drawText(ctx, s.text, -tw / 2, -6, COLOR.danger, COLOR.outline, sc);
    ctx.restore();
  }
}

// The CRT over the monitor area: colour fringe, scanlines, a rolling bar and grain.
function crt(ctx, b, t, frame) {
  const { fringe, fctx, lo } = b;
  for (const [dx, col] of [[2, '#f00'], [-2, '#0ff']]) { // colour fringe: a red copy right, a cyan copy left
    fctx.globalCompositeOperation = 'copy';
    fctx.drawImage(lo, 0, 0);
    fctx.globalCompositeOperation = 'multiply';
    fctx.fillStyle = col;
    fctx.fillRect(0, 0, LO_W, LO_H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(fringe, dx, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = tint('black', 0.3);
  for (let y = BAR; y < H - BAR; y += 2) ctx.fillRect(0, y, W, 1);
  const span = H - 2 * BAR + 60, barY = BAR - 60 + ((t * 45) % span);
  ctx.fillStyle = rgba(255, 255, 255, 0.05);
  ctx.fillRect(0, barY, W, 40);
  for (let i = 0; i < 300; i++) {
    const r = hash(i, 7, frame);
    ctx.fillStyle = r < 0.5 ? rgba(255, 255, 255, 0.14) : tint('black', 0.2);
    ctx.fillRect(Math.floor(hash(i, 1, frame) * W), BAR + Math.floor(hash(i, 2, frame) * (H - 2 * BAR)), 2, 2);
  }
}

export function drawTransmission(ctx, script, t, assets = {}) {
  const s = transmissionAt(script, t, assets.name), b = buffers(assets), frame = Math.floor(t * 24);
  drawScene(b.sctx, s, t, assets);
  b.lctx.imageSmoothingEnabled = true; // average down, so the dither has something to work with
  b.lctx.drawImage(b.src, 0, 0, LO_W, LO_H);
  const amount = staticAmount(script, s);
  filterVideo(b.lctx, amount, frame);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(b.lo, 0, 0, W, H);
  if (amount < 1) drawOverlay(ctx, s, t);
  crt(ctx, b, t, frame);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, BAR);
  ctx.fillRect(0, H - BAR, W, BAR);
  ctx.restore();
}
