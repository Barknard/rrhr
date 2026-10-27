import { shade, mix, abgr } from './color.js';

// Bakes a voxel model into HD pixel frames at evenly spaced headings. Pure (no DOM).
// Each voxel is a 2x2 block (top row = top face, bottom row = left/right faces). Shading adds crease
// shadows where a nearer surface overlaps, a rim light on the top silhouette, glossy glass streaks,
// banded chrome, unshaded emissive lights and a tinted outline.
// Every pixel also keeps its depth toward the camera (rx + ry + z, in voxels) so separately baked parts
// can be z-buffered together (see compose.js).
const MAT = { glass: 1, chrome: 2, emit: 3 };

export function bakeModel(model, headings = 32) {
  const [sx, sy] = model.size, cx = (sx - 1) / 2, cy = (sy - 1) / 2;
  const filled = new Set(model.voxels.map(v => `${v.x},${v.y},${v.z}`));
  const frames = [];
  for (let k = 0; k < headings; k++) {
    const a = (k * 2 * Math.PI) / headings, ca = Math.cos(a), sa = Math.sin(a);
    const pts = model.voxels.map(v => {
      const dx = v.x - cx, dy = v.y - cy, rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
      return { px: Math.round(rx - ry), py: Math.round((rx + ry) / 2 - v.z), depth: rx + ry, v };
    });
    pts.sort((p, q) => p.depth - q.depth || p.v.z - q.v.z);
    let minX = 0, maxX = 0, minY = 0, maxY = 0; // the anchor (0,0) is always inside
    for (const p of pts) { minX = Math.min(minX, p.px); maxX = Math.max(maxX, p.px + 1); minY = Math.min(minY, p.py); maxY = Math.max(maxY, p.py + 1); }
    const pad = 2, w = maxX - minX + 1 + pad * 2, h = maxY - minY + 1 + pad * 2;
    const col = new Int32Array(w * h).fill(-1), dep = new Float32Array(w * h), mat = new Uint8Array(w * h);
    const zb = new Float32Array(w * h).fill(-1e9);
    const put = (x, y, c, d, m, z) => { const i = y * w + x; col[i] = c; dep[i] = d; mat[i] = m; zb[i] = z; };
    for (const p of pts) {
      const x = p.px - minX + pad, y = p.py - minY + pad, v = p.v, z = p.depth + v.z;
      const m = MAT[v.m] ?? 0;
      const exposed = !filled.has(`${v.x},${v.y},${v.z + 1}`);
      const top = m === 3 ? v.c : exposed ? shade(v.c, 1.14) : v.c;
      const L = m === 3 ? v.c : shade(v.c, 0.84), R = m === 3 ? v.c : shade(v.c, 0.62);
      put(x, y, top, p.depth, m, z + 0.5); put(x + 1, y, top, p.depth, m, z + 0.5);
      put(x, y + 1, L, p.depth, m, z); put(x + 1, y + 1, R, p.depth, m, z);
    }
    const px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (col[i] < 0) {
        let j = -1;
        if (x > 0 && col[i - 1] >= 0) j = i - 1; else if (x < w - 1 && col[i + 1] >= 0) j = i + 1;
        else if (y > 0 && col[i - w] >= 0) j = i - w; else if (y < h - 1 && col[i + w] >= 0) j = i + w;
        if (j >= 0) { px[i] = abgr(mix(0x0c0910, col[j], 0.16)); zb[i] = zb[j] - 0.75; } // outlines sit just behind
        continue;
      }
      let c = col[i];
      const m = mat[i];
      if (m !== 3) {
        const d = dep[i];
        const nearer = j => col[j] >= 0 && dep[j] > d + 2.5;
        if ((x > 0 && nearer(i - 1)) || (x < w - 1 && nearer(i + 1)) || (y > 0 && nearer(i - w)) || (y < h - 1 && nearer(i + w))) c = shade(c, 0.74);
        if (y > 0 && col[i - w] < 0) c = shade(c, 1.16);
        if (m === 1 && (x - y + 66) % 11 < 2) c = mix(c, 0xffffff, 0.55);
        if (m === 2) c = shade(c, [1.28, 1.05, 0.8, 0.98][y & 3]);
      }
      px[i] = abgr(c);
    }
    frames.push({ w, h, ox: -minX + pad, oy: -minY + pad, px, zb });
  }
  return frames;
}
