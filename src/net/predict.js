import { stepCar } from '../physics/carPhysics.js';
import { NITRO_SPEED, NITRO_ACCEL } from '../combat/damage.js';

// Guest-side smoothing. The guest's own car is predicted: driven locally through the real car physics with the
// guest's own inputs, so it answers the keys on the very next frame. When the host's version arrives, the car is
// reset to it and the inputs the host hasn't used yet are replayed on top. A big disagreement (a wreck, a
// harpoon) is shown at once; a small one is blended away over BLEND_TIME so it never jerks.
// Everyone else is drawn INTERP_DELAY in the past, between the two snapshots around that moment.
export const SNAP_DISTANCE = 1.5; // tiles
export const BLEND_TIME = 0.1;    // s
export const INTERP_DELAY = 0.1;  // s

const STATE = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'heading', 'grounded'];

export function createPredictor(track, stats) {
  const sim = { stats, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, fallen: false, respawnTimer: 0, flying: null, speedMul: 1, accelMul: 1 };
  const pending = [], offset = { x: 0, y: 0, z: 0, heading: 0 };
  let blendLeft = 0; // s left to fade the current correction out (linearly, so it is gone after BLEND_TIME)
  let following = true; // no prediction until the first host state, or while wrecked / in the pit / flying off

  const step = (p, dt) => stepCar(sim, { throttle: p.throttle, steer: p.steer }, dt, track);
  const shown = () => ({ x: sim.x + offset.x, y: sim.y + offset.y, z: sim.z + offset.z, heading: sim.heading + offset.heading });

  return {
    sim, pending,
    get active() { return !following; },
    // One local frame with this packet (also kept for replay until the host acknowledges it).
    input(packet, dt) {
      if (following) return;
      step(packet, dt);
      pending.push({ seq: packet.seq, throttle: packet.throttle, steer: packet.steer, dt });
      const k = blendLeft > dt ? (blendLeft - dt) / blendLeft : 0;
      for (const f of Object.keys(offset)) offset[f] *= k;
      blendLeft = Math.max(0, blendLeft - dt);
    },
    // state: the host's version of this car; ack: the last input sequence the host has used.
    reconcile(state, ack) {
      while (pending.length && pending[0].seq <= ack) pending.shift();
      const before = shown();
      for (const f of STATE) sim[f] = state[f];
      Object.assign(sim, { flying: null, flyoffS: null, fallen: false }); // the host decides falls and fly-offs; a predicted one is replayed from here
      const boosting = state.boostTimer > 0;
      sim.speedMul = boosting ? NITRO_SPEED : 1; sim.accelMul = boosting ? NITRO_ACCEL : 1;
      if (state.wrecked || state.fallen || state.flying) { following = true; pending.length = 0; Object.assign(offset, { x: 0, y: 0, z: 0, heading: 0 }); return; }
      const wasFollowing = following;
      following = false;
      for (const p of pending) step(p, p.dt);
      const err = { x: before.x - sim.x, y: before.y - sim.y, z: before.z - sim.z, heading: Math.atan2(Math.sin(before.heading - sim.heading), Math.cos(before.heading - sim.heading)) };
      if (wasFollowing || Math.hypot(err.x, err.y) > SNAP_DISTANCE) Object.assign(offset, { x: 0, y: 0, z: 0, heading: 0 });
      else { Object.assign(offset, err); blendLeft = BLEND_TIME; } // keep showing where it was, then blend toward the corrected car
    },
    displayed: shown,
  };
}

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// history: [{ time, cars: [{x, y, z, h}] }] in time order (host race time). Returns one {x, y, z, heading} per car.
export function interpolate(history, renderTime) {
  if (!history.length) return null;
  let a = history[0], b = history[0];
  if (renderTime >= history[history.length - 1].time) a = b = history[history.length - 1];
  else for (let i = 0; i < history.length - 1; i++) {
    if (history[i + 1].time > renderTime) { a = history[i]; b = history[i + 1]; break; }
  }
  const t = b.time > a.time ? Math.max(0, Math.min(1, (renderTime - a.time) / (b.time - a.time))) : 0;
  return a.cars.map((p, i) => {
    const q = b.cars[i];
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t, heading: lerpAngle(p.h, q.h, t) };
  });
}
