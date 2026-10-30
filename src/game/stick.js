import { TILE_W, TILE_H } from '../core/iso.js';

// The phone's thumb stick: drag toward where the car should go on screen and it steers to face that way, the
// further the drag the more gas. Pure maths here; the stick itself lives in touch.js.
const A = TILE_W / 2, B = TILE_H / 2;
const DEAD = 0.12;          // the middle of the stick does nothing (12%: thumb jitter there would swing the aim)
const FULL_GAS = 0.55;      // full throttle from just past halfway, so the thumb never has to hold a precise distance
const FULL_STEER = 0.6;     // radians off the aim at which steering is full lock; less than that steers less
const ON_COURSE = 0.05;     // this close to the aim the wheel stays straight: no twitching left-right that scrubs speed
const REVERSE_ANGLE = 2.1;  // aiming this far behind the nose...
const REVERSE_SPEED = 2;    // ...while (nearly) stopped backs out instead of grinding into a wall
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Track heading <-> the screen direction it looks like in the isometric view (gridToScreen in core/iso.js).
export const headingToScreen = h => ({ x: (Math.cos(h) - Math.sin(h)) * A, y: (Math.cos(h) + Math.sin(h)) * B });
export function screenToHeading(sx, sy) {
  const u = sx / A, v = sy / B; // u = gx - gy, v = gx + gy
  return Math.atan2((v - u) / 2, (u + v) / 2);
}

// The thumb's offset (CSS pixels, y down) from where it landed -> { x, y, mag }, each -1..1, clamped to the rim.
export function stickVector(dx, dy, radius) {
  const d = Math.hypot(dx, dy);
  if (!d) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, d / radius);
  return { x: (dx / d) * mag, y: (dy / d) * mag, mag };
}

// stick { x, y, mag } + the car -> { throttle, steer } for this step.
export function stickDrive(stick, car) {
  if (!stick || stick.mag < DEAD) return { throttle: 0, steer: 0 };
  const push = Math.min(1, (stick.mag - DEAD) / (FULL_GAS - DEAD));
  const diff = wrap(screenToHeading(stick.x, stick.y) - car.heading);
  const fwd = (car.vx ?? 0) * Math.cos(car.heading) + (car.vy ?? 0) * Math.sin(car.heading);
  if (Math.abs(diff) > REVERSE_ANGLE && fwd < REVERSE_SPEED) return { throttle: -push, steer: -Math.sign(diff) }; // backing up turns the nose the other way
  if (Math.abs(diff) < ON_COURSE) return { throttle: push, steer: 0 };
  return { throttle: push, steer: Math.max(-1, Math.min(1, diff / FULL_STEER)) };
}
