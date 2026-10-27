// Isometric projection. Grid units on x/y (1 = one tile), sim pixels on z (height).
// Sim heights keep their original 16-px-tile units; the HD view scales them by Z_SCALE.
export const TILE_W = 56;
export const TILE_H = 28;
export const Z_SCALE = 1.75;
export const VOX = 28; // voxels per tile in vehicle models

export function gridToScreen(gx, gy, gz) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) - gz * Z_SCALE };
}

// Deterministic 0..1 hash used for tile texture and scenery placement.
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
