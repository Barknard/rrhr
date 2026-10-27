// A small z-buffer for one vehicle. Baked frames (see bake.js) are written pixel by pixel and the one
// nearest the camera wins, so a wheel under a fender or a leg behind the hull is hidden exactly where
// it should be, at every heading and in any draw order. The buffer's anchor is the vehicle's ground point.
export function createCompositor(size = 224) {
  const n = size * size, anchor = size >> 1;
  const comp = {
    size, anchor, px: new Uint32Array(n), zb: new Float32Array(n),
    begin() { comp.px.fill(0); comp.zb.fill(-1e9); },
    // dx, dy: screen offset of the frame's anchor from the buffer anchor; dz: depth added to the frame's
    put(f, dx, dy, dz) {
      const x0 = anchor + Math.round(dx) - f.ox, y0 = anchor + Math.round(dy) - f.oy;
      const xa = Math.max(0, -x0), xb = Math.min(f.w, size - x0);
      for (let y = Math.max(0, -y0), yb = Math.min(f.h, size - y0); y < yb; y++) {
        const row = (y0 + y) * size + x0, src = y * f.w;
        for (let x = xa; x < xb; x++) {
          const c = f.px[src + x];
          if (!c) continue;
          const z = f.zb[src + x] + dz, i = row + x;
          if (z > comp.zb[i]) { comp.zb[i] = z; comp.px[i] = c; }
        }
      }
    },
  };
  comp.begin();
  return comp;
}
