// Mobile soft controls. Pure layout and mapping first, then the DOM wiring.
import { stickVector } from './stick.js';
export const MIN_BTN = 44;
const BAR_MIN = 60; // a side bar at least this wide holds the PAUSE button; otherwise it floats in the corner

export function isPortrait(w, h) { return h > w; }

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// See-through controls floating over the corners: the thumb stick bottom left ('dpad' is where it rests; a thumb
// anywhere in stickZone picks it up there), FIRE big in the bottom-right corner with BOOST (nitro) beside it and
// DROP above it. PAUSE sits top left.
export function softLayout(viewW, viewH) {
  const gw = Math.min(viewW, viewH * 16 / 9), gh = gw * 9 / 16;
  const game = { x: (viewW - gw) / 2, y: (viewH - gh) / 2, w: gw, h: gh };
  const bar = game.x, m = 10, g = 8, buttons = [];
  const put = (id, x, y, w, h) => buttons.push({ id, rect: { x: Math.round(x), y: Math.round(y), w, h } });
  const pw = Math.min(bar - 16, 84);
  const pause = bar >= BAR_MIN ? { x: (bar - pw) / 2, y: 8, w: pw, h: MIN_BTN } : { x: 8, y: 8, w: 64, h: MIN_BTN };
  const D = Math.round(clamp(viewH * 0.44, 120, 200));
  put('dpad', m, viewH - m - D, D, D);
  const F = Math.round(clamp(viewH * 0.26, 64, 110)), B = Math.round(F * 0.8), S = Math.max(MIN_BTN, Math.round(F * 0.6));
  const fx = viewW - m - F, fy = viewH - m - F;
  put('fire', fx, fy, F, F);
  put('nitro', fx - g - B, viewH - m - B - F * 0.35, B, B);
  put('drop', fx + (F - S) / 2, fy - g - S, S, S);
  const top = pause.y + pause.h + g;
  const stickZone = { x: 0, y: top, w: Math.round(viewW * 0.45), h: viewH - top };
  return { game, buttons, pause, stickZone };
}

// A thumb on the d-pad, as an offset from its centre in radii (-1..1 each way) -> the held ids. Each arm covers
// 135 degrees, so the gaps between arms give both (gas and steer at once); the middle is neutral.
export function dpadIds(dx, dy) {
  const ids = new Set();
  if (Math.hypot(dx, dy) < 0.2) return ids;
  const ax = Math.abs(dx), ay = Math.abs(dy), k = Math.tan(Math.PI / 8);
  if (ax > ay * k) ids.add(dx < 0 ? 'left' : 'right');
  if (ay > ax * k) ids.add(dy < 0 ? 'gas' : 'brake');
  return ids;
}
// Where the HUD's bottom-left panel (armor, weapons, driver) should start, in 640-wide game pixels, so the d-pad
// floating over that corner never covers it.
export function padClearX(viewW, viewH) {
  const { game, buttons } = softLayout(viewW, viewH), d = buttons.find(b => b.id === 'dpad').rect;
  return Math.max(4, Math.ceil((d.x + d.w - game.x) * 640 / game.w) + 6);
}
const dpadOffset = (r, x, y) => [(x - (r.x + r.w / 2)) / (r.w / 2), (y - (r.y + r.h / 2)) / (r.h / 2)];

// Button ids held -> input state.
export function idsToInput(ids) {
  const has = id => ids.has(id);
  return {
    throttle: (has('gas') ? 1 : 0) - (has('brake') ? 1 : 0),
    steer: (has('right') ? 1 : 0) - (has('left') ? 1 : 0),
    fire: has('fire'), drop: has('drop'), nitro: has('nitro'),
  };
}

// touches: [{x, y}] in the same coordinates as the button rects.
export function touchToInput(touches, buttons) {
  const ids = new Set();
  for (const t of touches) for (const b of buttons) {
    if (!inRect(b.rect, t.x, t.y)) continue;
    if (b.id === 'dpad') for (const id of dpadIds(...dpadOffset(b.rect, t.x, t.y))) ids.add(id);
    else ids.add(b.id);
  }
  return idsToInput(ids);
}

// Fullscreen and a landscape lock, asked from a tap (touchend or click: touchstart is not a user activation).
// A refusal is asked again on the next tap; once granted, it stops asking.
export function createFullscreenAsker(doc, scr) {
  let done = false, busy = false;
  return async function ask() {
    if (done || busy || !doc.documentElement.requestFullscreen) return;
    busy = true;
    try {
      await doc.documentElement.requestFullscreen();
      done = true;
      await scr?.orientation?.lock?.('landscape');
    } catch { /* refused or not allowed: try again next tap */ } finally { busy = false; }
  };
}

const LABELS = { fire: 'FIRE', nitro: 'BOOST', drop: 'DROP' };
const GLASS = 'rgba(255,255,255,.16)', GLASS_ON = 'rgba(255,255,255,.42)', EDGE = '2px solid rgba(255,255,255,.5)';
// Browser only. Renders DOM controls in root and feeds input.touchDown(id) / input.touchUp(id).
export function createTouchControls(root, input, win = window, onPause = () => {}) {
  const doc = root.ownerDocument, els = new Map(), owner = new Map(); // pointerId -> button id
  const wrap = doc.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;z-index:20';
  root.appendChild(wrap);
  const base = 'position:absolute;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font:bold 14px monospace;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none';
  for (const id of Object.keys(LABELS)) {
    const el = doc.createElement('div');
    el.textContent = LABELS[id];
    el.style.cssText = `${base};border:${EDGE};border-radius:50%;background:${GLASS}`;
    wrap.appendChild(el); els.set(id, el);
    const down = e => { e.preventDefault(); owner.set(e.pointerId, id); input.touchDown(id); el.style.background = GLASS_ON; };
    const up = e => {
      if (owner.get(e.pointerId) !== id) return;
      owner.delete(e.pointerId);
      if (![...owner.values()].includes(id)) { input.touchUp(id); el.style.background = GLASS; }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  // The thumb stick: fixed at its spot bottom left. A thumb anywhere in the zone steers from that fixed centre, so
  // landing out by the rim is full gas at once (stick.js turns the offset into steering and gas).
  const zone = doc.createElement('div'), ring = doc.createElement('div'), knob = doc.createElement('div');
  zone.style.cssText = `${base};display:block`;
  ring.style.cssText = `position:absolute;box-sizing:border-box;border:${EDGE};border-radius:50%;background:${GLASS};pointer-events:none`;
  knob.style.cssText = `position:absolute;border-radius:50%;background:${GLASS_ON};pointer-events:none`;
  zone.append(ring, knob); wrap.appendChild(zone);
  let home = { x: 0, y: 0 }, R = 60, thumb = null;
  const disc = (el, cx, cy, r) => Object.assign(el.style, { left: `${cx - r}px`, top: `${cy - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
  const rest = () => { disc(ring, home.x, home.y, R); disc(knob, home.x, home.y, R * 0.42); };
  const local = e => { const r = zone.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const aim = e => {
    const p = local(e), v = stickVector(p.x - home.x, p.y - home.y, R);
    disc(knob, home.x + v.x * R, home.y + v.y * R, R * 0.42);
    input.setStick(v);
  };
  zone.addEventListener('pointerdown', e => {
    if (thumb !== null) return;
    e.preventDefault();
    thumb = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch { /* no capture: it still works while the thumb stays in the zone */ }
    aim(e);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === thumb) aim(e); });
  const lift = e => { if (e.pointerId !== thumb) return; thumb = null; input.setStick(null); rest(); };
  zone.addEventListener('pointerup', lift);
  zone.addEventListener('pointercancel', lift);
  zone.addEventListener('contextmenu', e => e.preventDefault());

  const pauseEl = doc.createElement('div');
  pauseEl.textContent = 'PAUSE';
  pauseEl.style.cssText = `${base};border:${EDGE};border-radius:12px;background:${GLASS};font-size:11px`;
  pauseEl.addEventListener('pointerdown', e => { e.preventDefault(); onPause(); });
  pauseEl.addEventListener('contextmenu', e => e.preventDefault());
  wrap.appendChild(pauseEl);
  const place = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  const layout = () => {
    const { buttons, pause, stickZone: z } = softLayout(win.innerWidth, win.innerHeight);
    place(pauseEl, pause);
    place(zone, z);
    for (const b of buttons) {
      if (b.id !== 'dpad') { place(els.get(b.id), b.rect); continue; }
      home = { x: b.rect.x + b.rect.w / 2 - z.x, y: b.rect.y + b.rect.h / 2 - z.y }; R = b.rect.w * 0.4;
      if (thumb === null) rest();
    }
  };
  layout();
  win.addEventListener('resize', layout);
  return {
    layout,
    show(v) { wrap.style.display = v ? '' : 'none'; if (!v && thumb !== null) { thumb = null; input.setStick(null); rest(); } },
    destroy() { win.removeEventListener('resize', layout); wrap.remove(); },
  };
}
