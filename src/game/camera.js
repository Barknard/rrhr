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

// The race-start flyover: through the countdown the camera sweeps back down the track from INTRO_FLY tiles ahead,
// easing in, and settles on your car with a fifth of the countdown to spare. Returns something camera.update follows.
export const INTRO_FLY = 36; // tiles
export function introFocus(track, car, countdown, total) {
  const u = Math.min(1, Math.max(0, (total - countdown) / (total * 0.8)));
  const e = 1 - (1 - u) ** 3;
  if (e >= 1) return { x: car.x, y: car.y, z: car.z, vx: 0, vy: 0 };
  const p = track.pointAt(track.project(car.x, car.y).s + INTRO_FLY * (1 - e));
  const k = Math.max(0, (e - 0.85) / 0.15); // the last stretch slides off the centre line onto the car itself
  return { x: p.x + (car.x - p.x) * k, y: p.y + (car.y - p.y) * k, z: p.h + (car.z - p.h) * k, vx: 0, vy: 0 };
}
