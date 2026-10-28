import { createCompositor } from './voxel/compose.js';
import { composeParts } from '../cars/rigs/rig.js';

// Draws posed vehicle parts on the canvas through one shared z-buffer: compose, copy into an ImageData,
// blit it with its anchor (the vehicle's ground point) at (x, y). Browser only.
// tumble: { spin (rad, a roll in the screen plane), scale } for a car flying off the track, turned about its body.
export function createVehicleDrawer(size = 224) {
  const comp = createCompositor(size);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), u32 = new Uint32Array(img.data.buffer);
  return {
    blit(ctx, baked, items, heading, x, y, tumble = null) {
      comp.begin();
      composeParts(comp, baked, items, heading);
      u32.set(comp.px);
      g.putImageData(img, 0, 0);
      if (!tumble) { ctx.drawImage(cv, Math.round(x) - comp.anchor, Math.round(y) - comp.anchor); return; }
      const BODY = 10; // px above the ground point: roughly the middle of a vehicle
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(x), Math.round(y) - BODY);
      ctx.rotate(tumble.spin);
      ctx.scale(tumble.scale, tumble.scale);
      ctx.drawImage(cv, -comp.anchor, -comp.anchor + BODY);
      ctx.restore();
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
