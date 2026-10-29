// Screen transitions: one short effect from a snapshot of the outgoing frame to the live incoming screen.
// Pure visuals; deterministic (no Math.random), no audio.

import { TIMING } from './theme.js';

export const TRANSITION_TIMES = { slam: TIMING.trSlam, flame: TIMING.trFlame, whip: TIMING.trWhip, shutter: TIMING.trShutter, static: TIMING.trStatic };
export const LOCK = TIMING.trLock;

const W = 640, H = 360;

export function transitionFor(from, to) {
  if (from === 'gate' && to === 'title') return 'slam';
  if (from === 'title' && to === 'driver') return 'flame';
  if ((from === 'driver' && to === 'ride') || (from === 'ride' && to === 'driver')) return 'whip';
  if ((from === 'ride' && to === 'vs') || (from === 'vs' && to === 'race')) return 'shutter';
  if (from === 'results' && to === 'standings') return 'flame';
  if (from === 'transmission' || to === 'transmission') return 'static';
  return 'flame';
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Cheap deterministic hash noise in [0,1).
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function snap(ctx, img, dx = 0, dy = 0, w = W, h = H) {
  if (img) ctx.drawImage(img, dx, dy, w, h);
}

const DRAW = {
  // Outgoing frame punches out: scales up, flashes white and shakes, fading to reveal the new screen.
  slam(ctx, img, p) {
    const k = 1 + p * 0.35;
    const sx = Math.round((hash(Math.floor(p * 30)) - 0.5) * 8 * (1 - p));
    const sy = Math.round((hash(Math.floor(p * 30) + 9) - 0.5) * 8 * (1 - p));
    ctx.save();
    ctx.globalAlpha = 1 - p;
    snap(ctx, img, (W - W * k) / 2 + sx, (H - H * k) / 2 + sy, W * k, H * k);
    ctx.restore();
    if (p < 0.3) { ctx.save(); ctx.globalAlpha = (1 - p / 0.3) * 0.8; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
  // A band of fire sweeps left to right; the old frame remains to the right of it.
  flame(ctx, img, p) {
    const band = 90;
    const x = -band + p * (W + band * 2);
    if (img && x < W) {
      ctx.save();
      ctx.beginPath(); ctx.rect(Math.max(0, x), 0, W, H); ctx.clip();
      snap(ctx, img);
      ctx.restore();
    }
    const cols = ['#ffe9a0', '#ffb000', '#ff5a00', '#a01800'];
    for (let i = 0; i < cols.length; i++) {
      const bx = x - i * (band / cols.length);
      ctx.fillStyle = cols[i];
      for (let y = 0; y < H; y += 8) {
        const wob = Math.round((hash(y * 0.37 + i * 5 + Math.floor(p * 24)) - 0.3) * 30);
        const w = band / cols.length + 6;
        ctx.fillRect(bx + wob, y, w, 8);
      }
    }
  },
  // The old frame slides off left with motion streaks.
  whip(ctx, img, p) {
    const e = p * p * (3 - 2 * p);
    const off = -e * W;
    snap(ctx, img, off, 0);
    ctx.save();
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.6;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 14; i++) {
      const y = Math.floor(hash(i + 1) * H);
      const len = 80 + hash(i + 40) * 200;
      ctx.fillRect(W + off - len * 0.3, y, len, 2);
    }
    ctx.restore();
  },
  // Black bars close over the old frame, then open on the new screen with a flash.
  shutter(ctx, img, p) {
    if (p < 0.5) {
      const c = p / 0.5;
      snap(ctx, img);
      ctx.fillStyle = '#000';
      const bh = (H / 2) * c;
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
    } else {
      const o = (p - 0.5) / 0.5;
      ctx.fillStyle = '#000';
      const bh = (H / 2) * (1 - o);
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
      if (o > 0.7) { ctx.save(); ctx.globalAlpha = (1 - (o - 0.7) / 0.3) * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
  },
  // CRT static: noise blocks over a tearing, fading old frame.
  static(ctx, img, p) {
    const f = Math.floor(p * 20);
    if (img && p < 0.5) {
      for (let y = 0; y < H; y += 12) {
        const dx = Math.round((hash(y + f * 13) - 0.5) * 24 * p);
        ctx.drawImage(img, 0, y, W, 12, dx, y, W, 12);
      }
    }
    const a = Math.sin(p * Math.PI);
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const v = hash(x * 0.13 + y * 7.7 + f * 101);
        ctx.fillStyle = v > 0.5 ? '#ddd' : '#222';
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.restore();
  },
};

export function createTransitioner() {
  const tr = {
    active: false, locked: false, kind: null, t: 0, dur: 0, img: null,
    start(kind, snapshotCanvas) {
      if (!DRAW[kind]) kind = 'flame';
      tr.kind = kind; tr.dur = TRANSITION_TIMES[kind]; tr.t = 0; tr.img = snapshotCanvas || null;
      tr.active = true; tr.locked = true;
    },
    step(dt) {
      if (!tr.active) return;
      tr.t += dt;
      if (tr.t >= LOCK) tr.locked = false;
      if (tr.t >= tr.dur) { tr.active = false; tr.locked = false; tr.img = null; }
    },
    draw(ctx) {
      if (!tr.active) return;
      DRAW[tr.kind](ctx, tr.img, clamp01(tr.t / tr.dur));
    },
  };
  return tr;
}
