import { VOX, Z_SCALE } from '../../core/iso.js';

// Visual effects state (pure: no DOM). Race events and vehicle states become particles, shock rings,
// lightning bolts, glows and road stamps (skids, scorches); drawFx.js draws them.
// Particles live on the grid (x, y in tiles) with z in screen pixels above the ground plane, and
// `floor` (screen px) where they land. Colours are 0xRRGGBB.
export const MAX_PARTS = 1500;

export function createFx() {
  return { parts: [], rings: [], bolts: [], glows: [], stamps: [], flash: 0, shake: 0 };
}

const R = (rng, a, b) => a + rng() * (b - a);
const zs = z => (Number.isFinite(z) ? z * Z_SCALE : 0);
function add(fx, p) {
  p.max ??= p.life;
  p.floor ??= 0;
  fx.parts.push(p);
}
function cap(fx) { if (fx.parts.length > MAX_PARTS) fx.parts.splice(0, fx.parts.length - MAX_PARTS); }

function sparks(fx, x, y, z, n, rng, { speed = 5, up = 50, blue = false, color } = {}) {
  for (let k = 0; k < n; k++) {
    const a = R(rng, 0, 2 * Math.PI), sp = R(rng, speed * 0.4, speed);
    add(fx, { kind: 'spark', x, y, z: z + R(rng, 2, 10), floor: z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R(rng, up * 0.2, up), life: R(rng, 0.2, 0.55), max: 0.55, blue, color });
  }
}
function smoke(fx, x, y, z, n, rng, { r0 = 4, r1 = 14, life = 2.6, color = 0x2a2328, lit = 0x4a3e44, delay = 0, spread = 0.5, rise = 12 } = {}) {
  for (let k = 0; k < n; k++) {
    const l = R(rng, life * 0.7, life);
    add(fx, { kind: 'smoke', delay: delay ? R(rng, delay * 0.3, delay) : 0, x: x + R(rng, -spread, spread), y: y + R(rng, -spread, spread), z: z + R(rng, 2, 14), vx: R(rng, -0.3, 0.3) + 0.2, vy: R(rng, -0.3, 0.3) - 0.1, vz: R(rng, rise * 0.5, rise), life: l, max: l, r0: R(rng, r0 * 0.7, r0), r1: R(rng, r1 * 0.75, r1), color, lit });
  }
}

// The full layered explosion: flash, fireball cooling white→yellow→red→smoke, shock ring, bouncing
// debris (some glowing), sparks, lingering smoke, embers left on the ground and a scorch mark.
function explosion(fx, x, y, zSim, s, rng, debrisColor) {
  const z = zs(zSim);
  fx.flash = Math.max(fx.flash, 0.07);
  fx.shake = Math.max(fx.shake, 7 * s);
  fx.rings.push({ x, y, z, age: 0, life: 0.38, size: s });
  for (let k = 0; k < 18 * s; k++) {
    const life = R(rng, 0.55, 0.95);
    add(fx, { kind: 'fire', x: x + R(rng, -0.4, 0.4) * s, y: y + R(rng, -0.4, 0.4) * s, z: z + R(rng, 3, 16), floor: z, vx: R(rng, -1.2, 1.2), vy: R(rng, -1.2, 1.2), vz: R(rng, 8, 38), life, max: life, r0: R(rng, 4, 8) * s, r1: R(rng, 10, 16) * s });
  }
  for (let k = 0; k < 16 * s; k++) {
    const a = R(rng, 0, 2 * Math.PI), sp = R(rng, 1.5, 5.5) * s, glow = rng() < 0.4;
    add(fx, { kind: 'debris', x, y, z: z + R(rng, 4, 10), floor: z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R(rng, 50, 110), life: R(rng, 1.4, 2.2), max: 2.2, glow, size: rng() < 0.5 ? 2 : 3, color: debrisColor && rng() < 0.5 ? debrisColor : undefined });
  }
  sparks(fx, x, y, z, 30 * s, rng, { speed: 9 * s, up: 70 });
  smoke(fx, x, y, z, 12 * s, rng, { delay: 0.5, r0: 6 * s, r1: 18 * s, life: 3.4 });
  for (let k = 0; k < 14 * s; k++) add(fx, { kind: 'glowdot', x: x + R(rng, -0.9, 0.9) * s, y: y + R(rng, -0.9, 0.9) * s, z, floor: z, vx: 0, vy: 0, vz: 0, life: R(rng, 1.5, 3.5), max: 3.5 });
  fx.stamps.push({ x, y, z: zSim ?? 0, r: 32 * s, type: 'scorch', strength: 1 });
}

// Perpendicular offsets (as a fraction of the length) along a jagged line, by midpoint displacement:
// 2^n + 1 points from [0, 0] to [1, 0].
export function boltPath(n, rng) {
  let pts = [[0, 0], [1, 0]];
  for (let d = 0; d < n; d++) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ta, oa] = pts[i], [tb, ob] = pts[i + 1];
      next.push(pts[i], [(ta + tb) / 2, (oa + ob) / 2 + (rng() - 0.5) * (tb - ta) * 0.7]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}
// (Re)builds a bolt's jagged shape: main path plus one to three branches. Called again every 1/20 s.
export function rejitter(bolt, rng) {
  bolt.path = boltPath(5, rng);
  bolt.branches = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({ path: boltPath(4, rng), at: R(rng, 0.25, 0.8), dir: R(rng, -0.9, 0.9) }));
}

const carZ = c => zs(c.z);
const behind = (c, d) => [c.x - Math.cos(c.heading) * d, c.y - Math.sin(c.heading) * d];

export function absorbEvents(fx, events, rng = Math.random) {
  for (const e of events) {
    switch (e.type) {
      case 'zap': {
        const bolt = { points: e.points.map(p => [...p]), age: 0, life: 0.35 };
        rejitter(bolt, rng);
        fx.bolts.push(bolt);
        for (const t of e.targets ?? []) sparks(fx, t.x, t.y, carZ(t), 14, rng, { blue: true, speed: 5 });
        if (!(e.targets ?? []).length) { const p = e.points[e.points.length - 1]; sparks(fx, p[0], p[1], zs(p[2] - 6), 8, rng, { blue: true }); }
        break;
      }
      case 'explosion': explosion(fx, e.x, e.y, e.z, 1, rng); break;
      case 'wreck': explosion(fx, e.x, e.y, e.z, 1.4, rng, e.car?.color ? parseInt(e.car.color.slice(1), 16) : undefined); break;
      case 'sawBounce': sparks(fx, e.x, e.y, zs(e.z), 8, rng, { speed: 4, up: 40 }); break;
      case 'sawHit': sparks(fx, e.x, e.y, zs(e.z), 18, rng, { speed: 6, color: 0xff3b5c }); sparks(fx, e.x, e.y, zs(e.z), 10, rng); fx.shake = Math.max(fx.shake, 3); break;
      case 'sawBreak': sparks(fx, e.x, e.y, zs(e.z), 10, rng, { speed: 3 }); break;
      case 'harpoon':
        fx.bolts.push({ rope: true, a: e.car, b: e.target, age: 0, life: 0.3 });
        sparks(fx, e.target.x, e.target.y, carZ(e.target), 10, rng);
        break;
      case 'pickup': fx.rings.push({ x: e.car.x, y: e.car.y, z: carZ(e.car), age: 0, life: 0.4, size: 0.35, color: 0xffe14a }); break;
      case 'launch':
        sparks(fx, e.car.x, e.car.y, carZ(e.car), 16, rng, { blue: true, speed: 3, up: 40 });
        smoke(fx, e.car.x, e.car.y, carZ(e.car), 5, rng, { r0: 3, r1: 9, life: 1, color: 0x6a6070, lit: 0x8a8090, rise: 6 });
        break;
      case 'tumble':
        smoke(fx, e.car.x, e.car.y, carZ(e.car), 8, rng, { r0: 3, r1: 10, life: 1.2, color: 0x6a6070, lit: 0x8a8090, rise: 6 });
        sparks(fx, e.car.x, e.car.y, carZ(e.car), 12, rng, { speed: 3 });
        fx.shake = Math.max(fx.shake, 5);
        break;
      case 'bump':
        if (e.impact > 4) { sparks(fx, (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2, carZ(e.a), 10, rng, { speed: 3 }); fx.shake = Math.max(fx.shake, 3); }
        break;
      case 'nitro': {
        const [x, y] = behind(e.car, 0.7);
        for (let k = 0; k < 10; k++) add(fx, { kind: 'flame', x, y, z: carZ(e.car) + 8, floor: 0, vx: -Math.cos(e.car.heading) * 3 + R(rng, -0.5, 0.5), vy: -Math.sin(e.car.heading) * 3 + R(rng, -0.5, 0.5), vz: R(rng, 5, 20), life: 0.25, r: R(rng, 2, 3.5), blue: true });
        break;
      }
      case 'ball':
        sparks(fx, e.x, e.y, zs(e.z), 16, rng, { speed: 4 });
        smoke(fx, e.x, e.y, zs(e.z), 4, rng, { r0: 3, r1: 8, life: 0.9, color: 0x6a6070, lit: 0x8a8090, rise: 5 });
        fx.shake = Math.max(fx.shake, 4);
        break;
      case 'ram':
        sparks(fx, e.target.x, e.target.y, carZ(e.target), 20, rng, { speed: 5 });
        for (let k = 0; k < 6; k++) add(fx, { kind: 'debris', x: e.target.x, y: e.target.y, z: carZ(e.target) + 6, floor: carZ(e.target), vx: R(rng, -3, 3), vy: R(rng, -3, 3), vz: R(rng, 30, 60), life: 1.2, size: 2 });
        fx.shake = Math.max(fx.shake, 5);
        break;
      case 'bombPass': fx.rings.push({ x: e.target.x, y: e.target.y, z: carZ(e.target), age: 0, life: 0.3, size: 0.3, color: 0xff3b5c }); break;
      default: break;
    }
  }
  cap(fx);
}

// Per-frame effects from one vehicle: tyre smoke and skids when sliding, exhaust pops on a lift,
// sparks when scraping a wall, and the rig's own extras (jets, spray, dust, glows).
export function emitVehicle(fx, car, anim, rig, dt, rng = Math.random) {
  const c = Math.cos(car.heading), s = Math.sin(car.heading), z = carZ(car);
  const at = (ox, oy) => [car.x + (ox * c - oy * s) / VOX, car.y + (ox * s + oy * c) / VOX];
  if (car.grounded && anim.slip > 2.2) {
    for (const side of [-1, 1]) {
      const [x, y] = at(-11, side * 9);
      fx.stamps.push({ x, y, z: car.z, r: 3, type: 'skid', strength: Math.min(1, anim.slip / 5) });
      if (rng() < 0.35) smoke(fx, x, y, z, 1, rng, { r0: 2, r1: 7, life: 1.4, color: 0x8a8490, lit: 0xb4aeb8, spread: 0.05, rise: 8 });
    }
  }
  if (anim.lift) anim.popT = 0.45;
  if (anim.popT > 0) {
    anim.popT -= dt;
    if (rng() < 0.3) for (const side of [-1, 1]) {
      const [x, y] = at(-17, side * 5.5);
      add(fx, { kind: 'flame', x, y, z: z + 14, floor: z, vx: -c * 2 + R(rng, -0.5, 0.5), vy: -s * 2 + R(rng, -0.5, 0.5), vz: R(rng, 10, 30), life: 0.14, r: R(rng, 1.5, 2.5) });
    }
  } else if (anim.throttle > 0.5 && rng() < 0.12) {
    const [x, y] = at(-17, rng() < 0.5 ? -5.5 : 5.5);
    smoke(fx, x, y, z + 6, 1, rng, { r0: 1.5, r1: 4, life: 0.9, color: 0x2a2630, lit: 0x4a4450, spread: 0.02, rise: 14 });
  }
  if (anim.scrape > 1.5) {
    const side = anim.vL >= 0 ? 1 : -1, [x, y] = at(0, side * 10);
    sparks(fx, x, y, z, Math.min(5, Math.ceil(anim.scrape * 0.8)), rng, { speed: 3, up: 45 });
  }
  for (const e of rig?.extras?.(anim, car, anim.t) ?? []) {
    const [x, y] = at(e.ox ?? 0, e.oy ?? 0), ez = z + (e.oz ?? 0);
    if (e.kind === 'glow') fx.glows.push({ x, y, z: ez, r: e.r ?? 10, color: e.color ?? '#ffffff', a: e.a ?? 0.2 });
    else if (e.kind === 'jet') {
      const n = Math.ceil(2 * (e.power ?? 1));
      for (let k = 0; k < n; k++) add(fx, { kind: 'flame', x, y, z: ez, floor: 0, vx: -c * (4 + 4 * e.power) + R(rng, -0.4, 0.4), vy: -s * (4 + 4 * e.power) + R(rng, -0.4, 0.4), vz: R(rng, -4, 4), life: 0.12 + 0.1 * e.power, r: 2 + 2 * e.power, blue: k === 0 });
    } else if (e.kind === 'flame') {
      if (rng() < 0.5 * (e.power ?? 1)) add(fx, { kind: 'flame', x, y, z: ez, floor: 0, vx: -c * 2, vy: -s * 2, vz: R(rng, 5, 15), life: 0.12, r: R(rng, 1.2, 2.2) });
    } else if (e.kind === 'spray') {
      for (let k = 0; k < Math.round(3 * (e.amount ?? 1)); k++) add(fx, { kind: 'spark', x: x + R(rng, -0.3, 0.3), y: y + R(rng, -0.3, 0.3), z: ez, floor: z, vx: -c * 2 + R(rng, -1, 1), vy: -s * 2 + R(rng, -1, 1), vz: R(rng, 15, 40), life: 0.4, color: 0xbfe6ff });
    } else if (e.kind === 'dust') smoke(fx, x, y, ez, 2, rng, { r0: 2, r1: 6, life: 0.8, color: 0x5a5060, lit: 0x7a7080, spread: 0.1, rise: 5 });
    else if (e.kind === 'shimmer') { if (rng() < 0.4) add(fx, { kind: 'shimmer', x, y, z: ez, floor: 0, vx: -c, vy: -s, vz: 4, life: 0.3, r: R(rng, 3, 6) }); }
  }
  cap(fx);
}

export function stepFx(fx, dt, rng = Math.random) {
  for (const p of fx.parts) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.kind === 'debris' || p.kind === 'spark' || p.kind === 'drop') {
      p.vz -= 170 * dt;
      if (p.z < p.floor) { p.z = p.floor; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; }
      if (p.kind === 'debris' && p.glow && rng() < 0.3) add(fx, { kind: 'smoke', x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 8, life: 0.6, r0: 1, r1: 3, color: 0x3a3238 });
    } else if (p.kind === 'smoke') { p.vx *= 1 - dt * 0.3; p.vy *= 1 - dt * 0.3; }
    else if (p.kind === 'ember') { p.vx += Math.sin(p.sway + p.life * 5) * dt * 0.8; }
    else if (p.kind === 'fire') { p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.vz *= 1 - dt * 1.5; }
    if (p.kind === 'bubble' && p.life <= 0) {
      for (let k = 0; k < 6; k++) { const a = R(rng, 0, 2 * Math.PI); add(fx, { kind: 'drop', x: p.x, y: p.y, z: p.floor + 1, floor: p.floor, vx: Math.cos(a) * 0.9, vy: Math.sin(a) * 0.9, vz: R(rng, 25, 45), life: 0.35 }); }
    }
  }
  fx.parts = fx.parts.filter(p => p.life > 0);
  for (const r of fx.rings) r.age += dt;
  fx.rings = fx.rings.filter(r => r.age < r.life);
  for (const b of fx.bolts) {
    b.age += dt;
    if (b.path && Math.floor(b.age * 20) !== b.jit) { b.jit = Math.floor(b.age * 20); rejitter(b, rng); }
  }
  fx.bolts = fx.bolts.filter(b => b.age < b.life);
  fx.glows.length = 0;
  fx.flash = Math.max(0, fx.flash - dt);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  cap(fx);
}

// Embers and popping bubbles over the visible lava, and smoke from the smokestacks.
// lavaPoints: a few random grid points known to be lava this frame (sampled by the caller from the layer).
export function emitAmbient(fx, lavaPoints, stacks, dt, rng = Math.random) {
  for (const [x, y] of lavaPoints) {
    if (rng() < 0.12) add(fx, { kind: 'bubble', x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.7 });
    else { const life = R(rng, 1.2, 2.6); add(fx, { kind: 'ember', x, y, z: 0, vx: R(rng, -0.2, 0.3), vy: R(rng, -0.3, 0.2), vz: R(rng, 14, 36), life, sway: R(rng, 0, 6) }); }
  }
  for (const p of stacks) if (rng() < dt * 9) smoke(fx, p.x, p.y, p.top + 2, 1, rng, { r0: 3, r1: 15, life: 4.2, color: 0x2e282e, lit: 0x7a4a3a, spread: 0.05, rise: 16 });
  cap(fx);
}
