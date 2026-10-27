import { bakeModel } from '../../render/voxel/bake.js';

// A vehicle rig is { key, sets: { name: partSet }, pose(anim, car, t) -> items, extras?(anim, car, t) }.
// A part set is a model baked at every heading for each of its variants (spin phases, gait phases,
// lean steps...). pose() says which parts to draw where; composeParts() z-buffers them together.
const TAU = 2 * Math.PI;
export const SPIN_PHASES = 12;
export const BLUR_RATE = 20; // rad/s: above this a spinner shows its motion-blur frames

export function headingIndex(h, n = 32) {
  const k = Math.round((h / TAU) * n) % n;
  return k < 0 ? k + n : k + 0; // + 0 turns -0 into 0
}

// make(variantIndex) -> model
export const partSet = (make, variants = 1) => ({ make, variants });

// A part that spins (wheels, saws, fans): make(phase, blur) -> model. Its pattern repeats every `period`
// radians, so 12 phases cover a full turn; variants 12 and 13 are motion-blur frames.
export const spinner = (make, period) => ({
  variants: SPIN_PHASES + 2, period,
  make: v => (v < SPIN_PHASES ? make((v * period) / SPIN_PHASES, false) : make(((v - SPIN_PHASES) * period) / 2, true)),
});

export function spinVariant(angle, rate, period, t) {
  if (Math.abs(rate) > BLUR_RATE) return SPIN_PHASES + (Math.floor(t * 30) & 1);
  const k = Math.floor((angle / period) * SPIN_PHASES) % SPIN_PHASES;
  return k < 0 ? k + SPIN_PHASES : k;
}

const cache = new Map();
export function bakeRig(rig, headings = 32) {
  const key = `${rig.key}@${headings}`;
  if (!cache.has(key)) {
    const sets = {};
    for (const [name, set] of Object.entries(rig.sets)) {
      sets[name] = [];
      for (let v = 0; v < set.variants; v++) sets[name].push(bakeModel(set.make(v), headings));
    }
    cache.set(key, { sets, headings });
  }
  return cache.get(key);
}

// items: { set, variant = 0, ox, oy, oz = 0, dh = 0, dz = 0 } in voxels, vehicle space (+x = nose, +z = up).
export function composeParts(comp, baked, items, heading, headings = baked.headings ?? 32) {
  const c = Math.cos(heading), s = Math.sin(heading);
  for (const it of items) {
    const frames = baked.sets[it.set][it.variant ?? 0];
    const ox = it.ox ?? 0, oy = it.oy ?? 0, oz = it.oz ?? 0;
    const rx = ox * c - oy * s, ry = ox * s + oy * c;
    comp.put(frames[headingIndex(heading + (it.dh ?? 0), headings)], rx - ry, (rx + ry) / 2 - oz, rx + ry + oz + (it.dz ?? 0));
  }
}
