import { gridToScreen } from '../core/iso.js';

export const VIEW_W = 640;
export const VIEW_H = 360;
export const LOOK_AHEAD_SECS = 0.45;
export const LOOK_AHEAD_MAX = 120; // px
const FOLLOW_RATE = 6;

// Biggest whole number of *device* pixels per game pixel that fits the window (never below 1),
// so pixels stay crisp under Windows display scaling. CSS size = VIEW_W * scale / dpr.
export function scaleForWindow(w, h, dpr = 1) {
  return Math.max(1, Math.floor(Math.min((w * dpr) / VIEW_W, (h * dpr) / VIEW_H)));
}

// Follows a car in world-screen space, leading toward where it's heading.
export function createCamera() {
  const cam = {
    x: 0, y: 0, ready: false,
    update(car, dt) {
      const p = gridToScreen(car.x, car.y, car.z);
      const v = gridToScreen(car.vx, car.vy, 0);
      let lx = v.x * LOOK_AHEAD_SECS, ly = v.y * LOOK_AHEAD_SECS;
      const len = Math.hypot(lx, ly);
      if (len > LOOK_AHEAD_MAX) { lx *= LOOK_AHEAD_MAX / len; ly *= LOOK_AHEAD_MAX / len; }
      if (!cam.ready) { cam.x = p.x; cam.y = p.y; cam.ready = true; return; }
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      cam.x += (p.x + lx - cam.x) * k;
      cam.y += (p.y + ly - cam.y) * k;
    },
  };
  return cam;
}
