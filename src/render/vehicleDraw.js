import { createCompositor } from './voxel/compose.js';
import { composeParts } from '../cars/rigs/rig.js';

// Draws posed vehicle parts on the canvas through one shared z-buffer: compose, copy into an ImageData,
// blit it with its anchor (the vehicle's ground point) at (x, y). Browser only.
export function createVehicleDrawer(size = 224) {
  const comp = createCompositor(size);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), u32 = new Uint32Array(img.data.buffer);
  return {
    blit(ctx, baked, items, heading, x, y) {
      comp.begin();
      composeParts(comp, baked, items, heading);
      u32.set(comp.px);
      g.putImageData(img, 0, 0);
      ctx.drawImage(cv, Math.round(x) - comp.anchor, Math.round(y) - comp.anchor);
    },
  };
}

// Baked frames (bake.js) as canvases, for sprites drawn whole: props, crates, mines, saws.
export function framesToCanvases(frames) {
  return frames.map(f => {
    const c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    const g = c.getContext('2d'), id = g.createImageData(f.w, f.h);
    new Uint32Array(id.data.buffer).set(f.px);
    g.putImageData(id, 0, 0);
    return { canvas: c, ox: f.ox, oy: f.oy };
  });
}
