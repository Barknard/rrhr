import { hash } from '../core/iso.js';
import { abgr, shade } from '../render/voxel/color.js';

// A full-screen field of slowly flowing lava for the menus: two scrolling tileable noise layers through a
// threshold palette with ordered dithering, the same recipe as the in-game lava. dim darkens it behind panels.
// It is computed at half resolution and scaled up 2x (a quarter of the per-pixel work), which suits the chunky look.
const N = 128;
function makeNoise(seed) {
  const T = new Float32Array(N * N);
  let amp = 0.5, total = 0;
  for (const cells of [4, 8, 16, 32]) {
    const step = N / cells;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / step, fy = y / step, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (a, b) => hash(a % cells, b % cells, seed + cells);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      T[y * N + x] += amp * (top + (bot - top) * sy);
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < T.length; i++) T[i] /= total;
  return T;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LAVA_T = [0.34, 0.40, 0.445, 0.47, 0.52, 0.58, 0.65, 0.72];
const LAVA_RGB = [0x1c0808, 0x32100b, 0x55190d, 0xffa437, 0xa81e0c, 0xd83c16, 0xf86a1e, 0xffa232, 0xffe07a];

export function createLavaBackdrop(W = 640, H = 360, makeCanvas = () => document.createElement('canvas')) {
  const A = makeNoise(3), B = makeNoise(11);
  const palettes = [1, 0.55, 0.3].map(f => LAVA_RGB.map(c => abgr(shade(c, f))));
  const w = W >> 1, h = H >> 1;
  let small = null, g = null, img = null, buf = null;
  return {
    // dim: 0 bright (title), 1 darker (select), 2 darkest (behind text-heavy screens)
    draw(ctx, t, dim = 0) {
      if (!img) {
        small = makeCanvas(); small.width = w; small.height = h;
        g = small.getContext('2d'); img = g.createImageData(w, h); buf = new Uint32Array(img.data.buffer);
      }
      const pal = palettes[dim];
      let o = 0;
      for (let y = 0; y < h; y++) {
        const by = (y & 3) << 2, v1 = ((y * 0.7 - t * 6) | 0) & (N - 1), v2 = ((y * 0.44 + t * 9) | 0) & (N - 1);
        const wave = t * 1.7 + y * 0.026;
        for (let x = 0; x < w; x++) {
          const u1 = ((x * 0.7 + t * 14) | 0) & (N - 1), u2 = ((x * 0.44 - t * 7) | 0) & (N - 1);
          let v = A[(v1 << 7) | u1] * 0.55 + B[(v2 << 7) | u2] * 0.45;
          v += 0.035 * Math.sin(wave + x * 0.04) + (BAYER[by | (x & 3)] / 16 - 0.47) * 0.045;
          let k = 0;
          while (k < 8 && v > LAVA_T[k]) k++;
          buf[o++] = pal[k];
        }
      }
      g.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, W, H);
    },
  };
}
