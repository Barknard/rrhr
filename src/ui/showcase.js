import { RIGS } from '../cars/rigs/index.js';
import { bakeRig, composeParts } from '../cars/rigs/rig.js';
import { createCompositor } from '../render/voxel/compose.js';
import { createAnim, stepAnim } from '../cars/anim.js';
import { bakePortrait } from './portraits.js';

// Browser-side art for the menus: vehicles on a turntable (from the HD rigs) and driver portraits, as canvases.
// A vehicle whose rig hasn't been built yet returns null and the screen shows a placeholder.
const toCanvas = (px, w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  new Uint32Array(img.data.buffer).set(px);
  g.putImageData(img, 0, 0);
  return c;
};

const portraitCache = new Map();
export function portraitCanvas(key, frame) {
  const id = `${key}:${frame}`;
  if (!portraitCache.has(id)) { const f = bakePortrait(key, frame); portraitCache.set(id, { canvas: toCanvas(f.px, f.w, f.h), ox: f.ox, oy: f.oy }); }
  return portraitCache.get(id);
}

export function createShowcase() {
  const comp = createCompositor(256), out = document.createElement('canvas');
  out.width = out.height = comp.size;
  const g = out.getContext('2d'), img = g.createImageData(comp.size, comp.size), buf = new Uint32Array(img.data.buffer);
  const state = new Map();
  return {
    // Bakes on first use (a short hitch), then draws the vehicle idling on a slow turntable.
    vehicle(key, heading, dt) {
      const rig = RIGS[key];
      if (!rig) return null;
      try {
        let s = state.get(key);
        if (!s) { s = { baked: bakeRig(rig, 32), anim: createAnim(), car: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading, grounded: true, prevInput: { steer: 0, throttle: 0.3 }, stats: { maxSpeed: 8 } } }; state.set(key, s); }
        const car = s.car;
        car.heading = heading;
        car.vx = Math.cos(heading) * 1.2; car.vy = Math.sin(heading) * 1.2; // rolling gently so wheels, legs and fans move
        car.prevInput.steer = Math.sin(s.anim.t * 0.9) * 0.6;
        stepAnim(s.anim, car, dt, rig.stride ?? 1);
        comp.begin();
        composeParts(comp, s.baked, rig.pose(s.anim, car, s.anim.t), heading);
        buf.set(comp.px);
        g.putImageData(img, 0, 0);
        return { canvas: out, anchor: comp.anchor };
      } catch {
        return null; // a rig that needs race-only state (trailers, the ball) shows the placeholder until integration
      }
    },
  };
}
