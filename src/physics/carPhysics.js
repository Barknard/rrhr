import { CAR_STATS } from '../cars/carStats.js';

export const GRAVITY = 70;          // px/s²
export const CAR_RADIUS = 0.3;      // tiles
const STEP_HEIGHT = 6;              // px a car can roll up without it being a wall
const MAX_SUBSTEP_DIST = 0.2;       // tiles per substep (no tunneling)
const MAX_GROUND_VZ = 60;           // px/s, caps slope-derived vertical speed
const SLOPE_BEHIND = 0.6;           // tiles, baseline for the slope the car just climbed
const SLOPE_AHEAD = 0.3;            // tiles, look-ahead for ground falling away
const LAUNCH_DV = 12;               // px/s of slope change that throws the car into the air
const FALL_DEPTH = -12;             // px below zero = fell into a pit
const RESPAWN_TIME = 1.5;           // s
const RESPAWN_RUNWAY = 4;           // tiles of plain road a respawned car gets in front of it
const WALL_BOUNCE = 0.3;            // fraction of into-wall speed returned as bounce
const WALL_SCRAPE = 0.04;           // speed lost per tile/s of into-wall impact (capped at 30%)
// Fly-offs: hit the wall hard and square enough and the car vaults it. The arc is scripted, not simulated against
// the terrain: the car keeps its velocity, gets an upward kick, tumbles out over the edge and always ends below
// any road, in the lava, whatever it passes over on the way. Then it counts as a fall.
// FLYOFF_SPEED sits above the hardest wall hit of clean full-throttle driving (6.51, a Skimmer on Slag Pit; see
// flyoff.test.js autopilotNeverFliesOff), so it takes an overcooked corner, a late turn-in or a shove to go over.
export const FLYOFF_SPEED = 6.75;   // tiles/s of into-wall speed (speed x sine of the angle to the wall)
export const FLYOFF_TIME = 0.9;     // s from the barrier to the splash
export const FLYOFF_SINK = -30;     // px: where the arc ends, under the lava's surface and below any pit fall
const FLYOFF_KICK = 100;            // px/s upward as the car clears the barrier (a pad launch is 38)
const FLYOFF_SPIN = 9;              // rad/s the car tumbles (drawn as a roll)
const FLYOFF_YAW = 5;               // rad/s its nose slews round on the way

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = v => (Number.isFinite(v) ? v : 0);

export function createCar(key, spawn) {
  return {
    key, stats: CAR_STATS[key],
    x: spawn.x, y: spawn.y, z: spawn.h,
    vx: 0, vy: 0, vz: 0, heading: spawn.dir,
    grounded: true, fallen: false, respawnTimer: 0, flying: null,
  };
}

// Keep the car inside the road. The wall is the smooth line halfWidth from the centerline,
// so the car glances off it: the into-wall part of its velocity bounces, the along-wall part
// survives (minus a little scrape), and there are no tile corners to snag on.
function constrainToRoad(car, track) {
  const p = track.project(car.x, car.y);
  const limit = track.halfWidth - CAR_RADIUS;
  if (p.dist <= limit) return;
  const nx = (car.x - p.px) / p.dist, ny = (car.y - p.py) / p.dist;
  const vn = car.vx * nx + car.vy * ny; // into-wall speed
  // spider legs grip the barrier; a wreck is out of the race already
  if (vn >= FLYOFF_SPEED && !car.stats.wallCrawler && !car.wrecked) { vault(car, nx, ny, p.s); return; }
  car.scrape = 0.001; // touching the wall (raised below by the into-wall speed); the renderer reads it for sparks
  car.x = p.px + nx * limit;
  car.y = p.py + ny * limit;
  if (vn > 0) {
    car.scrape = Math.max(car.scrape, vn);
    car.vx -= (1 + WALL_BOUNCE) * vn * nx;
    car.vy -= (1 + WALL_BOUNCE) * vn * ny;
    if (!car.stats.wallCrawler) { // spider legs grip the wall instead of grinding on it
      const scrape = 1 - Math.min(0.3, vn * WALL_SCRAPE);
      car.vx *= scrape;
      car.vy *= scrape;
    }
  }
}

// Over the barrier: the flight keeps the velocity it hit the wall with and tumbles away from the road.
function vault(car, nx, ny, s) {
  const turn = car.vx * ny - car.vy * nx >= 0 ? 1 : -1; // which way it rolls: the side the road falls away on
  car.flying = { t: 0, vx: car.vx, vy: car.vy, z0: car.z, turn, spin: 0 };
  car.flyoffS = s; // respawn from where it left the road, not from whatever road it flew over
  car.grounded = false;
  car.scrape = 0;
}

// The scripted arc: z(t) = z0 + KICK t - g t^2 / 2, with g chosen so it reaches FLYOFF_SINK at FLYOFF_TIME.
function fly(car, dt) {
  const f = car.flying, T = FLYOFF_TIME;
  f.t = Math.min(T, f.t + dt);
  const g = (2 * (f.z0 + FLYOFF_KICK * T - FLYOFF_SINK)) / (T * T);
  car.vx = f.vx; car.vy = f.vy;
  car.x += f.vx * dt; car.y += f.vy * dt;
  car.z = f.z0 + FLYOFF_KICK * f.t - (g * f.t * f.t) / 2;
  car.vz = FLYOFF_KICK - g * f.t;
  car.heading += f.turn * FLYOFF_YAW * dt;
  f.spin = f.turn * FLYOFF_SPIN * f.t;
  car.scrape = 0;
  if (f.t >= T - 1e-9) {
    car.z = FLYOFF_SINK;
    car.flying = null;
    car.fallen = true; car.respawnTimer = RESPAWN_TIME;
  }
}

// Put a fallen car back on the centerline, just past whatever hazard it fell into.
export function respawn(car, track) {
  // Find the first spot with RESPAWN_RUNWAY tiles of solid road ahead, so a car restarting
  // from rest never rolls straight into a pit it can't clear.
  const clear = s0 => {
    for (let d = 0; d <= RESPAWN_RUNWAY; d += 0.25) {
      const q = track.pointAt(s0 + d);
      if (track.surfaceAt(q.x, q.y) !== 'road') return false;
    }
    return true;
  };
  let s = car.flyoffS ?? track.project(car.x, car.y).s;
  for (let k = 0; k < 800 && !clear(s); k++) s += 0.25;
  const p = track.pointAt(s);
  Object.assign(car, { x: p.x, y: p.y, z: p.h, vx: 0, vy: 0, vz: 0, heading: p.dir, grounded: true, fallen: false, respawnTimer: 0, flying: null, flyoffS: null });
}

function substep(car, throttle, steer, dt, track) {
  // Anti-gravity floats across pits as if the road were still there.
  const groundAt = car.stats.antigrav ? (x, y) => { const g = track.groundAt(x, y); return g === -Infinity ? track.project(x, y).h : g; } : track.groundAt;
  const s = car.stats;
  if (car.grounded) {
    const c = Math.cos(car.heading), sn = Math.sin(car.heading);
    let fwd = car.vx * c + car.vy * sn;
    let lat = -car.vx * sn + car.vy * c;
    const maxSpeed = s.maxSpeed * (car.speedMul ?? 1), accel = s.accel * (car.accelMul ?? 1);
    if (fwd > maxSpeed) fwd -= (fwd - maxSpeed) * Math.min(1, 3 * dt); // settle back after a boost
    if (throttle > 0) {
      if (fwd < maxSpeed) fwd = Math.min(maxSpeed, fwd + accel * throttle * dt);
    } else if (throttle < 0) {
      if (fwd > 0) fwd = Math.max(0, fwd + s.brake * throttle * dt);
      else fwd = Math.max(-0.4 * s.maxSpeed, fwd + s.accel * 0.6 * throttle * dt);
    } else {
      fwd *= 1 - 0.8 * dt;
    }
    lat *= Math.exp(-s.grip * dt);
    car.vx = fwd * c - lat * sn;
    car.vy = fwd * sn + lat * c;
    // Steering turns the nose; velocity catches up through grip next step, which is the drift.
    // A pivot vehicle (tank tracks) turns at full rate even at a standstill.
    if (s.pivot) car.heading += steer * s.turnRate * dt * (fwd < -0.1 ? -1 : 1);
    else car.heading += steer * s.turnRate * Math.min(1, Math.abs(fwd) / 2) * dt * Math.sign(fwd);
  }
  car.vx *= 1 - 0.4 * dt;
  car.vy *= 1 - 0.4 * dt;

  const ox = car.x, oy = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  constrainToRoad(car, track);
  if (car.flying) return;
  // A face taller than STEP_HEIGHT (the far wall of a pit) can't be driven up.
  const ahead = groundAt(car.x, car.y);
  if (Number.isFinite(ahead) && ahead > car.z + STEP_HEIGHT) {
    car.x = ox; car.y = oy;
    car.vx *= -0.3; car.vy *= -0.3;
  }

  const g = groundAt(car.x, car.y);
  const ground = g ?? car.z;
  if (car.grounded) {
    // Compare the slope just driven over with the slope just ahead. When the ground falls away
    // faster than the car can follow (a crest, a lip, a pit edge) it takes off with the
    // climbing speed it had. Short baselines would turn tiny height seams into launches.
    const sp = Math.hypot(car.vx, car.vy);
    let vzBehind = 0, vzAhead = 0;
    if (sp > 0.01 && Number.isFinite(ground)) {
      const ux = car.vx / sp, uy = car.vy / sp;
      const gb = groundAt(car.x - ux * SLOPE_BEHIND, car.y - uy * SLOPE_BEHIND);
      vzBehind = Number.isFinite(gb) ? clamp(((ground - gb) / SLOPE_BEHIND) * sp, -MAX_GROUND_VZ, MAX_GROUND_VZ) : 0;
      const ga = groundAt(car.x + ux * SLOPE_AHEAD, car.y + uy * SLOPE_AHEAD);
      vzAhead = ga === -Infinity ? -Infinity : ga === null ? vzBehind : ((ga - ground) / SLOPE_AHEAD) * sp;
    }
    if (!Number.isFinite(ground) || vzBehind - vzAhead > LAUNCH_DV) {
      car.grounded = false;
      car.vz = vzBehind;
    } else {
      car.vz = vzBehind;
      car.z = ground;
    }
  }
  if (!car.grounded) {
    car.vz -= GRAVITY * (s.glide ?? 1) * dt; // gyrocopters glide off every jump and pad
    car.z += car.vz * dt;
    if (car.z <= ground) {
      car.z = ground; car.vz = 0; car.grounded = true;
    } else if (car.z < FALL_DEPTH) {
      car.fallen = true; car.respawnTimer = RESPAWN_TIME;
    }
  }
}

export function stepCar(car, input, dt, track) {
  if (car.fallen) {
    car.respawnTimer -= dt;
    if (car.respawnTimer <= 1e-9) respawn(car, track);
    return;
  }
  if (car.flying) { fly(car, dt); return; }
  const throttle = clamp(num(input.throttle), -1, 1);
  const steer = clamp(num(input.steer), -1, 1);
  car.scrape = 0;
  const speed = Math.hypot(car.vx, car.vy);
  const n = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP_DIST), Math.ceil(dt * 120));
  for (let i = 0; i < n && !car.fallen && !car.flying; i++) substep(car, throttle, steer, dt / n, track);
}
