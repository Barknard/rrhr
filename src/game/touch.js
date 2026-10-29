// Mobile soft buttons. Pure layout and mapping first, then the DOM wiring.
export const MIN_BTN = 44;
const BAR_MIN = 60; // side bars at least this wide hold the buttons; otherwise they float over the screen

export function isPortrait(w, h) { return h > w; }

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function softLayout(viewW, viewH) {
  const gw = Math.min(viewW, viewH * 16 / 9), gh = gw * 9 / 16;
  const game = { x: (viewW - gw) / 2, y: (viewH - gh) / 2, w: gw, h: gh };
  const bar = game.x, m = 8, g = 8, buttons = [];
  const put = (id, x, y, w, h) => buttons.push({ id, rect: { x, y, w, h } });
  if (bar >= BAR_MIN) {
    const s = Math.min(bar - 2 * m, 84), lx = (bar - s) / 2, rx = viewW - bar + lx;
    const h = Math.max(MIN_BTN, Math.min(s, (viewH - 2 * m - 2 * g) / 3));
    // left thumb: steer left, steer right, brake below them
    put('left', lx, m, s, h); put('right', lx, m + h + g, s, h); put('brake', lx, m + 2 * (h + g), s, h);
    // right thumb: big gas, then fire, drop, nitro
    const gasH = Math.max(MIN_BTN, Math.min(s * 1.5, viewH * 0.3));
    const sh = Math.max(MIN_BTN, Math.min(s, (viewH - 2 * m - 3 * g - gasH) / 3));
    put('gas', rx, m, s, gasH);
    put('fire', rx, m + gasH + g, s, sh);
    put('drop', rx, m + gasH + g + sh + g, s, sh);
    put('nitro', rx, m + gasH + 2 * (g + sh), s, sh);
  } else {
    const s = Math.max(MIN_BTN, Math.min(72, viewH * 0.16)), base = viewH - m - s;
    const gasS = s * 1.3, top = base - (gasS - s) - g - s;
    put('left', m, base, s, s); put('right', m + s + g, base, s, s); put('brake', m, base - s - g, s, s);
    put('gas', viewW - m - gasS, base - (gasS - s), gasS, gasS);
    put('fire', viewW - m - s, top, s, s);
    put('drop', viewW - m - 2 * s - g, top, s, s);
    put('nitro', viewW - m - s, top - s - g, s, s);
  }
  return { game, buttons };
}

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
  for (const t of touches) for (const b of buttons) if (inRect(b.rect, t.x, t.y)) ids.add(b.id);
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

const LABELS = { left: '<', right: '>', brake: 'BRK', gas: 'GAS', fire: 'FIRE', drop: 'DROP', nitro: 'NOS' };

// Browser only. Renders DOM buttons in root and feeds input.touchDown(id) / input.touchUp(id).
export function createTouchControls(root, input, win = window) {
  const doc = root.ownerDocument, els = new Map(), owner = new Map(); // pointerId -> button id
  const wrap = doc.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;z-index:20';
  root.appendChild(wrap);
  for (const id of Object.keys(LABELS)) {
    const el = doc.createElement('div');
    el.textContent = LABELS[id];
    el.style.cssText = 'position:absolute;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.6);border-radius:12px;background:rgba(0,0,0,.35);color:#fff;font:bold 14px monospace;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none';
    wrap.appendChild(el); els.set(id, el);
    const down = e => { e.preventDefault(); owner.set(e.pointerId, id); input.touchDown(id); el.style.background = 'rgba(255,255,255,.35)'; };
    const up = e => {
      if (owner.get(e.pointerId) !== id) return;
      owner.delete(e.pointerId);
      if (![...owner.values()].includes(id)) { input.touchUp(id); el.style.background = 'rgba(0,0,0,.35)'; }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  const layout = () => {
    const { buttons } = softLayout(win.innerWidth, win.innerHeight);
    for (const b of buttons) {
      const s = els.get(b.id).style;
      s.left = b.rect.x + 'px'; s.top = b.rect.y + 'px'; s.width = b.rect.w + 'px'; s.height = b.rect.h + 'px';
    }
  };
  layout();
  win.addEventListener('resize', layout);
  return {
    layout,
    show(v) { wrap.style.display = v ? '' : 'none'; },
    destroy() { win.removeEventListener('resize', layout); wrap.remove(); },
  };
}
