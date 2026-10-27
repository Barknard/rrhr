import { builder } from '../../render/voxel/builder.js';
import { spinner, spinVariant } from './rig.js';
import { VOX } from '../../core/iso.js';

// Shared voxel parts and pose helpers for the vehicle rigs. Vehicle space: +x = nose, +y = right side
// as seen from above when facing +x, +z = up; one unit = one voxel (1/28 tile).

export const TYRE_PERIOD = (2 * Math.PI) / 5; // tyre and saw patterns repeat five times per turn

// A tyre standing in the x-z plane (axle along y): tread, sidewall lettering, chrome rim, spokes, hub.
export function wheelModel(r, w, phase, blur, { rim = 0xc8ced8, hub = 0xe2e6ee, spoke = 0xb8bfcb, tread = 0x37343d } = {}) {
  const c = Math.ceil(r), s = 2 * c + 1, m = builder(s, w, s);
  for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) {
    const dx = x - c, dz = z - c, d = Math.hypot(dx, dz);
    if (d > r + 0.3) continue;
    const ang = Math.atan2(dz, dx) + phase, frac = k => (((ang * k) / (2 * Math.PI)) % 1 + 1) % 1;
    for (let y = 0; y < w; y++) {
      const face = y === 0 || y === w - 1;
      let col, mm;
      if (d > r - 1.0) col = blur ? ((y + (z & 1)) & 1 ? 0x2c2a30 : 0x1f1d23) : ((Math.floor(frac(10) * 2) + (y & 1)) & 1 ? tread : 0x18171c);
      else if (!face) col = 0x18171c;
      else if (d > r * 0.64) col = !blur && Math.abs(d - (r - 1.7)) < 0.45 && frac(5) < 0.4 ? 0x9a94a2 : 0x24222a;
      else if (d > r * 0.54) { col = rim; mm = 'chrome'; }
      else if (d < r * 0.2) { col = hub; mm = 'chrome'; }
      else if (blur) col = 0x6a7080;
      else if (frac(5) < 0.24) { col = spoke; mm = 'chrome'; }
      else col = 0x2a2c34;
      m.set(x, y, z, col, mm);
    }
  }
  return m.done();
}
export const tyre = (r, w, opts) => spinner((p, b) => wheelModel(r, w, p, b, opts), TYRE_PERIOD);

// A circular saw blade in the x-z plane with ten teeth.
export function sawModel(r, phase, blur) {
  const c = Math.ceil(r + 0.6), s = 2 * c + 1, m = builder(s, 2, s);
  for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) {
    const dx = x - c, dz = z - c, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx) + phase, frac = k => (((ang * k) / (2 * Math.PI)) % 1 + 1) % 1;
    let col;
    if (d < 1.2) col = 0x2a2c34;
    else if (d < r - 0.8) col = !blur && Math.abs(d - r * 0.5) < 0.9 && frac(5) < 0.2 ? 0x1a1a20 : blur ? 0xa8aeb8 : 0xc4cad4;
    else if (d < r + 0.6 && (blur ? d < r + 0.1 : frac(10) < 0.62 - (d - (r - 0.8)) * 0.3)) col = blur ? 0xd4d8e0 : 0xeef2f8;
    else continue;
    for (let y = 0; y < 2; y++) m.set(x, y, z, col, 'chrome');
  }
  return m.done();
}
export const saw = r => spinner((p, b) => sawModel(r, p, b), TYRE_PERIOD);

// A propeller or fan in the y-z plane (axle along x) with `blades` blades inside an optional cage ring.
export function fanModel(r, blades, phase, blur, { blade = 0xd8dce4, cage = 0x3a3f4a, hub = 0x22252c, depth = 2 } = {}) {
  const c = Math.ceil(r + 1), s = 2 * c + 1, m = builder(depth + 2, s, s);
  for (let y = 0; y < s; y++) for (let z = 0; z < s; z++) {
    const dy = y - c, dz = z - c, d = Math.hypot(dy, dz);
    if (cage && Math.abs(d - (r + 0.6)) < 0.55) { m.set(0, y, z, cage, 'chrome'); m.set(depth + 1, y, z, cage, 'chrome'); continue; }
    if (d > r) continue;
    let col;
    if (d < 1.3) col = hub;
    else if (blur) { if ((y + z) & 1) continue; col = 0x9aa0aa; }
    else {
      const a = (((Math.atan2(dz, dy) + phase) * blades) / (2 * Math.PI)) % 1;
      if ((a + 1) % 1 > 0.28) continue;
      col = blade;
    }
    for (let x = 1; x <= depth; x++) m.set(x, y, z, col, 'chrome');
  }
  return m.done();
}
export const fan = (r, blades, opts) => spinner((p, b) => fanModel(r, blades, p, b, opts), (2 * Math.PI) / blades);

// A thick straight rod between two points (legs, booms, chains, roll bars).
export function rod(m, [x0, y0, z0], [x1, y1, z1], r, c, mat) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dy * dy + dz * dz <= r * r + 0.5) m.set(x + dx, y + dy, z + dz, c, mat);
    }
  }
}

// A filled sphere (wrecking ball, robot joints, domes).
export function ball(m, cx, cy, cz, r, c, mat) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) if (Math.hypot(x - cx, y - cy, z - cz) <= r + 0.2) m.set(x, y, z, c, mat);
}

// ---------- walking ----------

// Where a walking foot is at gait phase p (0..1), relative to its hip, in voxels along +x (forward).
// First half: planted, sliding back from +reach to -reach at a constant speed (so with stride = 4*reach/VOX
// tiles per cycle it stays put on the ground). Second half: lifted and swung forward again.
export function footPath(p, reach, lift) {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return { dx: reach - (p / 0.5) * 2 * reach, dz: 0 };
  const q = (p - 0.5) / 0.5, e = q * q * (3 - 2 * q);
  return { dx: -reach + e * 2 * reach, dz: Math.sin(Math.PI * q) * lift };
}

// ---------- pose helpers ----------

// How the sprung body sits this frame: bob, kerb rattle, idle shake, lean out of corners, nose dive.
export function bodyOffset(anim, { travel = 1, lean = 1 } = {}) {
  const idle = Math.abs(anim.vF) < 0.6 ? (Math.floor(anim.t * 22) & 1) * 0.6 : 0;
  return { ox: Math.round(-anim.pitch * 0.4), oy: anim.lean * VOX * lean, oz: Math.round(anim.bob * travel + idle) };
}

export const wheelVariant = (anim, r, t) => spinVariant(anim.roll / r, anim.rate / r, TYRE_PERIOD, t);
export const steerAngle = anim => anim.steer * 0.42;

// Four wheels: rear pair and steering front pair.
export function fourWheels(anim, t, { rearSet = 'rear', frontSet = 'front', rx, ry, rr, fx, fy, fr, oz = 0 }) {
  const rv = wheelVariant(anim, rr, t), fv = wheelVariant(anim, fr, t), dh = steerAngle(anim);
  return [
    { set: rearSet, variant: rv, ox: rx, oy: -ry, oz }, { set: rearSet, variant: rv, ox: rx, oy: ry, oz },
    { set: frontSet, variant: fv, ox: fx, oy: -fy, oz, dh }, { set: frontSet, variant: fv, ox: fx, oy: fy, oz, dh },
  ];
}

// The world angle from this vehicle to its aim point, relative to its heading (turrets, gunners).
export const aimOffset = (anim, car) => (Number.isFinite(anim.aim) ? anim.aim - car.heading : 0);
