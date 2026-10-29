// Mobile soft controls. Pure layout and mapping first, then the DOM wiring.
export const MIN_BTN = 44;
const BAR_MIN = 60; // a side bar at least this wide holds the PAUSE button; otherwise it floats in the corner

export function isPortrait(w, h) { return h > w; }

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// See-through controls floating over the corners: a plus d-pad bottom left (up is gas, down is brake), FIRE big in
// the bottom-right corner with BOOST (nitro) beside it and DROP above it. PAUSE sits top left.
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
  return { game, buttons, pause };
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
// The plus's arms in a 3x3 grid of thirds; the open side of each arm faces the middle.
const ARMS = {
  gas: { cell: [1, 0], open: 'bottom', round: '10px 10px 0 0' },
  brake: { cell: [1, 2], open: 'top', round: '0 0 10px 10px' },
  left: { cell: [0, 1], open: 'right', round: '10px 0 0 10px' },
  right: { cell: [2, 1], open: 'left', round: '0 10px 10px 0' },
};

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

  // The plus: one element for the whole pad, so the thumb can roll from arm to arm; the arms are drawn inside it.
  const pad = doc.createElement('div');
  pad.style.cssText = `${base};display:block`;
  const arms = new Map();
  for (const [id, arm] of [...Object.entries(ARMS), ['mid', { cell: [1, 1] }]]) {
    const el = doc.createElement('div');
    el.style.cssText = `position:absolute;left:${arm.cell[0] * 33.33}%;top:${arm.cell[1] * 33.33}%;width:33.34%;height:33.34%;box-sizing:border-box;pointer-events:none;background:${GLASS}`;
    if (arm.open) Object.assign(el.style, { border: EDGE, [`border-${arm.open}`]: 'none', borderRadius: arm.round });
    pad.appendChild(el); arms.set(id, el);
  }
  wrap.appendChild(pad);
  const held = new Map(); // pointerId -> the ids that thumb holds on the pad
  const padIds = () => new Set([...held.values()].flatMap(set => [...set]));
  const setPad = (pointerId, next) => {
    const before = padIds();
    if (next) held.set(pointerId, next); else held.delete(pointerId);
    const after = padIds();
    for (const id of after) if (!before.has(id)) input.touchDown(id);
    for (const id of before) if (!after.has(id)) input.touchUp(id);
    for (const [id, el] of arms) if (id !== 'mid') el.style.background = after.has(id) ? GLASS_ON : GLASS;
  };
  const padAt = e => { const r = pad.getBoundingClientRect(); return dpadIds(...dpadOffset({ x: r.left, y: r.top, w: r.width, h: r.height }, e.clientX, e.clientY)); };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch { /* no capture: the pad still works while the thumb stays on it */ }
    setPad(e.pointerId, padAt(e));
  });
  pad.addEventListener('pointermove', e => { if (held.has(e.pointerId)) setPad(e.pointerId, padAt(e)); });
  for (const k of ['pointerup', 'pointercancel']) pad.addEventListener(k, e => { if (held.has(e.pointerId)) setPad(e.pointerId, null); });
  pad.addEventListener('contextmenu', e => e.preventDefault());

  const pauseEl = doc.createElement('div');
  pauseEl.textContent = 'PAUSE';
  pauseEl.style.cssText = `${base};border:${EDGE};border-radius:12px;background:${GLASS};font-size:11px`;
  pauseEl.addEventListener('pointerdown', e => { e.preventDefault(); onPause(); });
  pauseEl.addEventListener('contextmenu', e => e.preventDefault());
  wrap.appendChild(pauseEl);
  const place = (el, r) => Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  const layout = () => {
    const { buttons, pause } = softLayout(win.innerWidth, win.innerHeight);
    place(pauseEl, pause);
    for (const b of buttons) place(b.id === 'dpad' ? pad : els.get(b.id), b.rect);
  };
  layout();
  win.addEventListener('resize', layout);
  return {
    layout,
    show(v) { wrap.style.display = v ? '' : 'none'; if (!v) for (const id of [...held.keys()]) setPad(id, null); },
    destroy() { win.removeEventListener('resize', layout); wrap.remove(); },
  };
}
