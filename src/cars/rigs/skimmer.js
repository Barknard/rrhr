import { builder } from '../../render/voxel/builder.js';
import { partSet, spinVariant } from './rig.js';
import { fan, bodyOffset } from './parts.js';

// Skimmer: a racing hovercraft. A puffy rubber skirt ripples underneath, a caged fan roars at the back,
// and it throws spray as it slides.
const BLU = 0x3aa8ff, BLU_L = 0x8fd0ff, BLU_D = 0x1a5a9c, WHT = 0xeef2f6, BLK = 0x16141c, RUB = 0x2a2830, RUB_L = 0x3c3944,
  GLASS = 0x1f4f7a, CHROME = 0xc9cfd9, YEL = 0xf0bd2a, HEAD = 0xfff2b8;
const L = 38, Wd = 22;
const inHull = (x, y, pad = 0) => { // rounded-rectangle deck outline
  const rx = L / 2 - 1 + pad, ry = Wd / 2 - 1 + pad, r = 6 + pad;
  const dx = Math.max(0, Math.abs(x - (L - 1) / 2) - (rx - r)), dy = Math.max(0, Math.abs(y - (Wd - 1) / 2) - (ry - r));
  return Math.hypot(dx, dy) <= r;
};

function hull() {
  const m = builder(L, Wd, 16);
  for (let x = 0; x < L; x++) for (let y = 0; y < Wd; y++) {
    if (!inHull(x, y, -1)) continue;
    const edge = !inHull(x, y, -2);
    m.box(x, y, 3, x, y, 5, edge ? BLU_D : BLU);
    m.set(x, y, 6, edge ? BLU : Math.abs(y - 10.5) < 1.6 ? WHT : BLU_L); // racing stripe
    if (!edge && x % 8 === 0) m.set(x, y, 6, BLU_D);
  }
  for (let x = 18; x <= 30; x++) for (let y = 6; y <= 15; y++) { // cabin with a wraparound windscreen
    const h = x > 26 ? 3 : 5;
    for (let z = 7; z <= 6 + h; z++) m.set(x, y, z, (x >= 26 || z >= 6 + h - 1) && y > 6 && y < 15 ? GLASS : WHT, (x >= 26 || z >= 6 + h - 1) && y > 6 && y < 15 ? 'glass' : undefined);
  }
  for (const y of [3, 18]) { m.box(2, y, 7, 7, y, 13, BLK); m.box(2, y, 13, 7, y, 13, YEL); } // fan duct struts
  for (const y of [8, 13]) m.box(0, y, 7, 2, y, 12, CHROME, 'chrome'); // rudders
  for (const y of [6, 15]) m.set(L - 2, y, 6, HEAD, 'emit');
  return m.done();
}

// The rubber skirt: a puffy segmented ring around the deck whose segments ripple (4 variants).
function skirt(v) {
  const m = builder(L + 2, Wd + 2, 5);
  for (let x = 0; x < L + 2; x++) for (let y = 0; y < Wd + 2; y++) {
    const hx = x - 1, hy = y - 1;
    if (!inHull(hx, hy, 1) || inHull(hx, hy, -3)) continue;
    const seg = Math.floor((Math.atan2(hy - (Wd - 1) / 2, hx - (L - 1) / 2) / (2 * Math.PI)) * 28 + 28);
    const puff = ((seg + v) & 3) === 0 ? 3 : ((seg + v) & 3) === 2 ? 1 : 2;
    m.box(x, y, 0, x, y, puff, (seg & 1) ? RUB : RUB_L);
  }
  return m.done();
}

export const skimmer = {
  key: 'skimmer',
  sets: { hull: partSet(hull), skirt: partSet(skirt, 4), fan: fan(7, 4, { cage: 0x3a3f4a, depth: 2 }) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.6, lean: 1.4 });
    const float = Math.round(Math.sin(t * 5) * 0.7);
    const fanAngle = t * (10 + Math.max(0, anim.throttle) * 26), fanRate = 10 + Math.max(0, anim.throttle) * 26;
    return [
      { set: 'skirt', variant: Math.floor(t * 10 + anim.roll * 0.08) & 3, ox: 0, oy: 0, oz: 0 },
      { set: 'hull', ox: b.ox, oy: b.oy, oz: 1 + float + b.oz },
      { set: 'fan', variant: spinVariant(fanAngle, fanRate, Math.PI / 2, t), ox: b.ox - 15, oy: b.oy, oz: 3 + float + b.oz },
    ];
  },
  extras: (anim, car, t) => [{ kind: 'spray', ox: -20, oy: 0, oz: 1, amount: Math.min(1, Math.abs(anim.vF) / 7 + anim.slip / 4) }],
};
