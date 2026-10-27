import { VOX } from '../core/iso.js';

// Drawing-side animation state for one vehicle, derived each frame from the simulation car.
// It never feeds back into gameplay. Units: roll in voxels of travel, pitch/bob in screen px,
// lean in tiles (vehicle +y), gait in strides.
//   pitch > 0 lifts the nose (throttle squat), < 0 dives it (braking)
//   lean  < 0 leans toward -y: the outside of a turn whose heading is increasing
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fin = v => (Number.isFinite(v) ? v : 0);
const SPRING_K = 140, SPRING_C = 14;

export function createAnim() {
  return {
    t: 0, roll: 0, vF: 0, vL: 0, rate: 0, steer: 0, bob: 0, bobV: 0, pitch: 0, lean: 0, yawRate: 0,
    throttle: 0, lift: false, slip: 0, gait: 0, swing: 0, swingV: 0, airborne: false, scrape: 0,
    prevH: null, prevVz: 0,
  };
}

export function stepAnim(a, car, dt, stride = 1) {
  const h = fin(car.heading), c = Math.cos(h), s = Math.sin(h);
  const vx = fin(car.vx), vy = fin(car.vy);
  const vF = vx * c + vy * s, vL = -vx * s + vy * c;
  let yaw = 0, aF = 0;
  if (a.prevH !== null && dt > 0) {
    yaw = Math.atan2(Math.sin(h - a.prevH), Math.cos(h - a.prevH)) / dt;
    aF = (vF - a.vF) / dt;
  }
  a.prevH = h;
  a.t += dt;
  a.yawRate = yaw;
  a.vF = vF; a.vL = vL;
  a.roll += vF * dt * VOX;
  a.rate = Math.abs(vF) * VOX;
  a.gait += (vF * dt) / stride;
  a.slip = Math.abs(vL);
  a.steer += (clamp(fin(car.prevInput?.steer), -1, 1) - a.steer) * Math.min(1, 8 * dt);

  const k = Math.min(1, 10 * dt);
  a.pitch += (clamp(aF * 0.25, -3, 3) - a.pitch) * k;
  a.lean += (clamp(-vF * yaw * 0.04, -0.09, 0.09) - a.lean) * k;

  const airborne = !car.grounded;
  if (a.airborne && !airborne) a.bobV -= Math.min(60, Math.abs(a.prevVz)) * 0.6; // landing compresses the springs
  a.airborne = airborne;
  a.prevVz = fin(car.vz);
  a.scrape = fin(car.scrape);
  if (a.scrape > 0.5) a.bobV += Math.min(6, a.scrape) * ((Math.floor(a.t * 37) & 1) ? 1 : -1); // kerb rattle
  a.bobV += (-SPRING_K * a.bob - SPRING_C * a.bobV) * dt;
  a.bob = clamp(a.bob + a.bobV * dt, -4, 4);

  a.swingV += (-30 * a.swing - 4 * a.swingV - aF * 0.6) * dt; // cages, coffins, the bike's dangling bits
  a.swing = clamp(a.swing + a.swingV * dt, -1, 1);

  const th = clamp(fin(car.prevInput?.throttle), -1, 1);
  a.lift = a.throttle > 0.5 && th <= 0 && vF > 4;
  a.throttle = th;
  return a;
}
