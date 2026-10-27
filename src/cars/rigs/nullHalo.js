import { builder, transform } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { bodyOffset } from './parts.js';

// Null Halo: an anti-gravity sled. No wheels at all: it floats, banks hard into corners, and two glowing
// rings orbit its hull on tilted axes.
const WHT = 0xe8f4ff, WHT_D = 0xa9bccc, ICE = 0x7fd8ff, CYAN = 0x29e3ff, BLK = 0x101018, GLASS = 0x0d2a40, CHROME = 0xd8e2ec, VIOLET = 0x9a7bff, SEAM = 0x5a6878;

function hull() {
  const m = builder(36, 16, 10);
  for (let x = 0; x < 36; x++) {
    const k = x / 35, half = Math.max(1, Math.round(7.4 * Math.sin(Math.PI * Math.min(1, 0.15 + k * 0.95)) ** 0.7));
    const top = Math.round(2 + 4.5 * Math.sin(Math.PI * Math.min(1, 0.1 + k * 0.9)));
    for (let y = 7.5 - half; y <= 7.5 + half; y++) {
      const edge = Math.abs(y - 7.5) >= half - 0.5;
      m.box(x, y, 1, x, y, top, edge ? WHT_D : WHT);
      m.set(x, y, 0, x % 4 ? BLK : SEAM);
      if (edge && x % 3 !== 0) m.set(x, y, 2, CYAN, 'emit'); // light strip along the flanks
      if (!edge && x % 9 === 4) m.set(x, y, top, ICE);
      if (x > 27 && Math.abs(y - 7.5) < 1) m.set(x, y, top, VIOLET); // nose stripe
    }
  }
  for (let x = 17; x <= 27; x++) for (let y = 5; y <= 10; y++) { // black glass canopy
    const h = Math.round(2.2 * Math.sin((Math.PI * (x - 16)) / 12));
    for (let z = 6; z <= 6 + h; z++) m.set(x, y, z, GLASS, 'glass');
  }
  for (const y of [1, 14]) for (let z = 3; z <= 8; z++) m.set(2 + (z - 3), y, z, CHROME, 'chrome'); // swept tail fins
  m.box(0, 6, 2, 0, 9, 4, CYAN, 'emit'); // drive glow
  return m.done();
}

// A thin glowing torus, tilted, so spinning it about the vertical axis makes it wobble like an orbit.
function ring(tilt) {
  const R = 15, s = 2 * R + 3, c = (s - 1) / 2, m = builder(s, s, s);
  for (let x = 0; x < s; x++) for (let y = 0; y < s; y++) {
    const d = Math.hypot(x - c, y - c);
    if (Math.abs(d - R) < 0.8) m.set(x, y, c, Math.atan2(y - c, x - c) * 3 % 1 > 0.5 ? CYAN : ICE, 'emit');
  }
  return transform(m.done(), { ...tilt, pivot: [c, c, c] });
}

export const nullHalo = {
  key: 'nullHalo',
  sets: { hull: partSet(hull), ringA: partSet(() => ring({ roll: 0.55 })), ringB: partSet(() => ring({ pitch: -0.5 })) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.4, lean: 1.8 });
    const float = 10 + Math.round(Math.sin(t * 2.5) * 2);
    return [
      { set: 'hull', ox: b.ox, oy: b.oy, oz: float + b.oz },
      { set: 'ringA', ox: 0, oy: b.oy, oz: float - 12 + b.oz, dh: t * 2.2 },
      { set: 'ringB', ox: 0, oy: b.oy, oz: float - 12 + b.oz, dh: -t * 1.7 },
    ];
  },
  extras: (anim, car, t) => [{ kind: 'glow', ox: 0, oy: 0, oz: 1, r: 14, color: '#29e3ff', a: 0.2 + 0.08 * Math.sin(t * 9) }],
};
