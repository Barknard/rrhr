import { hash } from '../../core/iso.js';

// Tileable value-noise fbm on an N×N grid (N a power of two ≥ 64), values 0..1.
export function makeNoise(N, seed) {
  const T = new Float32Array(N * N);
  let amp = 0.5, total = 0;
  for (const cells of [8, 16, 32, 64]) {
    const lat = new Float32Array(cells * cells).map((_, i) => hash(i % cells, (i / cells) | 0, seed + cells));
    const step = N / cells;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / step, fy = y / step, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      const a = lat[y0 * cells + x0], b = lat[y0 * cells + x1], c = lat[y1 * cells + x0], d = lat[y1 * cells + x1];
      const top = a + (b - a) * sx, bot = c + (d - c) * sx;
      T[y * N + x] += amp * (top + (bot - top) * sy);
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < T.length; i++) T[i] /= total;
  T.size = N;
  return T;
}

// Bilinear sample with wrap-around (coordinates in noise cells).
export function sample(T, u, v) {
  const N = T.size ?? Math.round(Math.sqrt(T.length)), m = N - 1;
  const x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0;
  const at = (yy, xx) => T[(yy & m) * N + (xx & m)];
  const top = at(y0, x0) + (at(y0, x0 + 1) - at(y0, x0)) * tx, bot = at(y0 + 1, x0) + (at(y0 + 1, x0 + 1) - at(y0 + 1, x0)) * tx;
  return top + (bot - top) * ty;
}

export const NOISE = makeNoise(256, 3);
export const NOISE2 = makeNoise(256, 11);
