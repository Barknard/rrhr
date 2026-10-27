import { KIND } from './bakeWorld.js';
import { NOISE, NOISE2 } from './noise.js';
import { abgr } from '../voxel/color.js';

// Per-frame world compositing: copies the visible part of the baked layer into `out` (ABGR), computing
// flowing lava per pixel (two scrolling noise layers through a threshold palette with 4×4 Bayer dither)
// and flickering the hot rock. Outside the baked layer is open lava sea. Pure: the browser blits `out`.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LAVA_T = [0.34, 0.40, 0.445, 0.47, 0.52, 0.58, 0.65, 0.72];
const LAVA_C = [0x1c0808, 0x32100b, 0x55190d, 0xffa437, 0xa81e0c, 0xd83c16, 0xf86a1e, 0xffa232, 0xffe07a].map(abgr);
export const LAVA_PALETTE = LAVA_C;

// palette index by brightness, at 1/1024 steps (replaces a threshold search per pixel)
const LUT = new Uint8Array(1024).map((_, k) => { let i = 0; while (i < 8 && k / 1024 > LAVA_T[i]) i++; return i; });
const lutIndex = v => LUT[Math.max(0, Math.min(1023, (v * 1024) | 0))];

// one lava pixel; `wave` is the slow swell sin(t*1.7 + gx*0.8 + gy*0.3), stepped along the row by the caller
function lava(gx, gy, t, b, wave) {
  const u1 = (gx * 14 + t * 1.3 + 4096) | 0, v1 = (gy * 14 - t * 0.5 + 4096) | 0;
  const u2 = (gx * 9 - t * 0.8 + 4196) | 0, v2 = (gy * 9 + t * 1.0 + 4096) | 0;
  const v = NOISE[((v1 & 255) << 8) | (u1 & 255)] * 0.55 + NOISE2[((v2 & 255) << 8) | (u2 & 255)] * 0.45 + 0.035 * wave + (b - 0.47) * 0.045;
  return LAVA_C[lutIndex(v)];
}
const HX = 28, HY = 14;

export function composite(world, camX, camY, t, out, W = 640, H = 360) {
  const { W: WW, H: WH, base, hot, kind, heat, origin } = world;
  camX = Math.round(camX); camY = Math.round(camY);
  const step = 1 / (2 * HX);
  // Both waves are sines of an angle that grows by a fixed amount per pixel along a row, so each row
  // steps them with a rotation instead of calling Math.sin per pixel.
  const dA = (0.8 - 0.3) * step, cA = Math.cos(dA), sA = Math.sin(dA); // lava swell
  const dB = (1.9 - 1.3) * step, cB = Math.cos(dB), sB = Math.sin(dB); // hot-rock flicker
  let o = 0;
  for (let sy = 0; sy < H; sy++) {
    const py = sy + camY, by = (sy & 3) << 2, rowIn = py >= 0 && py < WH;
    const row = py * WW;
    let px = camX;
    let gx = ((px - origin.x) / HX + (py - origin.y) / HY) / 2, gy = ((py - origin.y) / HY - (px - origin.x) / HX) / 2;
    let a = t * 1.7 + gx * 0.8 + gy * 0.3, sa = Math.sin(a), ca = Math.cos(a);
    let bb = t * 3.7 + gx * 1.9 + gy * 1.3, sb = Math.sin(bb), cb = Math.cos(bb);
    for (let sx = 0; sx < W; sx++, px++, gx += step, gy -= step) {
      const b = BAYER[by | (sx & 3)] / 16;
      if (!rowIn || px < 0 || px >= WW) out[o++] = lava(gx, gy, t, b, sa);
      else {
        const i = row + px, k = kind[i];
        if (k === KIND.LAVA) out[o++] = lava(gx, gy, t, b, sa);
        else if (k === KIND.HOT) out[o++] = (heat[i] / 255) * (0.6 + 0.4 * sb) > b ? hot[i] : base[i];
        else out[o++] = base[i];
      }
      const na = sa * cA + ca * sA; ca = ca * cA - sa * sA; sa = na;
      const nb = sb * cB + cb * sB; cb = cb * cB - sb * sB; sb = nb;
    }
  }
  return out;
}

const darken = (v, f) => ((v & 0xff000000) | (Math.round(((v >> 16) & 255) * f) << 16) | (Math.round(((v >> 8) & 255) * f) << 8) | Math.round((v & 255) * f)) >>> 0;
const MAX_STAIN = 0.7; // marks never take a pixel below 30% of its original brightness

// Stamps a skid mark or a scorch into the layer at layer pixel (x, y): an ellipse r wide, r/2 tall.
// Scorches are dark with ragged edges; skids are a light darkening. Lava is never stamped. Each stained
// pixel remembers its original colours (world.stains), so marks stop at a floor and resetStamps()
// wipes the track clean for the next race.
export function stamp(world, x, y, r, type, strength = 1) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(r > 0)) return;
  const { W, H, base, hot, kind } = world, ry = Math.max(1, r / 2);
  const stains = (world.stains ??= new Map());
  x = Math.round(x); y = Math.round(y);
  for (let dy = -Math.ceil(ry); dy <= ry; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= H) continue;
    for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= W) continue;
      const d = Math.hypot(dx / r, dy / ry);
      if (d > 1) continue;
      const i = yy * W + xx;
      if (kind[i] !== KIND.SOLID && kind[i] !== KIND.HOT) continue;
      let add;
      if (type === 'scorch') {
        if (d > 0.7 && ((xx * 7 + yy * 13) % 5) < 2) continue; // ragged edge
        add = 0.6 * strength * (1 - d * 0.6);
      } else add = 0.16 * strength;
      let st = stains.get(i);
      if (!st) stains.set(i, (st = { base: base[i], hot: hot[i], dark: 0 }));
      st.dark = Math.min(MAX_STAIN, 1 - (1 - st.dark) * (1 - add));
      base[i] = darken(st.base, 1 - st.dark);
      if (st.hot) hot[i] = darken(st.hot, 1 - st.dark);
    }
  }
}

// Puts every stamped pixel back the way the bake left it.
export function resetStamps(world) {
  if (!world.stains) return;
  for (const [i, st] of world.stains) { world.base[i] = st.base; world.hot[i] = st.hot; }
  world.stains.clear();
}
