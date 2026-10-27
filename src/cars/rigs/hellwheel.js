import { builder, transform } from '../../render/voxel/builder.js';
import { partSet, spinner, spinVariant } from './rig.js';
import { rod, ball } from './parts.js';

// Hellwheel: a monowheel. One giant studded tyre rolls around a yellow pod that hangs inside it on
// bearings, so the pod swings forward and back as you brake and accelerate. A nose cannon pokes out.
const YEL = 0xf4c21b, YEL_L = 0xffe27a, YEL_D = 0x9a7408, BLK = 0x18161e, CHROME = 0xc9cfd9, GLASS = 0x2a5f8f,
  RED = 0xe0442a, FIRE = 0xffa21e;

export const RING_R = 12, RING_W = 7;

function ringModel(phase, blur) {
  const c = RING_R + 1, s = 2 * c + 1, m = builder(s, RING_W, s);
  for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) {
    const d = Math.hypot(x - c, z - c);
    if (d > RING_R + 0.3 || d < RING_R - 3.2) continue;
    const ang = Math.atan2(z - c, x - c) + phase, frac = k => (((ang * k) / (2 * Math.PI)) % 1 + 1) % 1;
    for (let y = 0; y < RING_W; y++) {
      let col, mm;
      if (d > RING_R - 1.2) { // studded tread
        if (blur) col = (y + (z & 1)) & 1 ? 0x2c2a30 : 0x1f1d23;
        else col = frac(15) < 0.3 && (y === 1 || y === RING_W - 2) ? 0x9aa0ad : (Math.floor(frac(15) * 2) + y) & 1 ? 0x34313a : 0x18171c;
        if (!blur && frac(15) < 0.3 && (y === 1 || y === RING_W - 2)) mm = 'chrome';
      } else if (d > RING_R - 2.2) col = y === 0 || y === RING_W - 1 ? (!blur && frac(5) < 0.3 ? FIRE : RED) : 0x24222a; // flame-painted sidewall
      else { col = CHROME; mm = 'chrome'; } // inner rim the pod's bearings ride on
      m.set(x, y, z, col, mm);
    }
  }
  return m.done();
}

// The pod is wider than the tyre, so it shows on both sides of the wheel like a pair of pontoons.
function podModel(v) {
  const W = 13, m = builder(22, W, 22);
  const cz = 11, mid = (W - 1) / 2;
  for (let x = 3; x <= 18; x++) {
    const k = (x - 3) / 15, r = Math.round(4.6 * Math.sqrt(Math.max(0, 1 - Math.pow(k * 2 - 1, 2))) + 0.8);
    for (let y = 0; y < W; y++) for (let z = cz - r; z <= cz + r; z++) {
      const side = y === 0 || y === W - 1, top = z === cz + r;
      let c = top ? YEL_L : YEL;
      if (side) c = Math.abs(x - 10.5) < 2.5 && Math.abs(z - cz) < 2.5 ? (Math.hypot(x - 10.5, z - cz) < 1.3 ? BLK : 0xf2eee4) : YEL; // number roundel
      if (side && (x === 3 || x === 18 || z === cz - r)) c = YEL_D;
      if (!side && (x + z) % 6 === 0 && Math.abs(y - mid) < 2) c = BLK; // hazard chevrons along the spine
      m.set(x, y, z, c);
    }
  }
  for (let x = 9; x <= 15; x++) for (let y = 3; y <= W - 4; y++) m.set(x, y, cz + 5, GLASS, 'glass'); // canopy
  m.box(8, 3, cz + 6, 8, W - 4, cz + 6, BLK);
  rod(m, [17, mid, cz - 1], [21, mid, cz - 1], 1, CHROME, 'chrome'); // nose cannon
  m.set(21, mid, cz - 1, BLK);
  for (const y of [1, W - 2]) m.set(18, y, cz, 0xfff2b8, 'emit'); // headlamps on the pontoon fronts
  for (const y of [1, W - 2]) m.set(3, y, cz, 0xff2440, 'emit');
  rod(m, [3, mid, cz + 2], [1, mid, cz + 6], 0.6, BLK); // tail fin
  ball(m, 10.5, mid, cz, 1.4, CHROME, 'chrome');
  return transform(m.done(), { pitch: (v - 3) * 0.14, pivot: [10.5, mid, cz] });
}

export const hellwheel = {
  key: 'hellwheel',
  sets: { ring: spinner(ringModel, (2 * Math.PI) / 15), pod: partSet(podModel, 7) },
  pose(anim, car, t) {
    const swing = Math.max(0, Math.min(6, Math.round(3 + anim.swing * 4 + anim.pitch * 0.3)));
    const bob = Math.round(anim.bob * 0.6);
    return [
      { set: 'ring', variant: spinVariant(anim.roll / RING_R, anim.rate / RING_R, (2 * Math.PI) / 15, t), ox: 0, oy: 0, oz: 0 },
      { set: 'pod', variant: swing, ox: 0, oy: 0, oz: 2 + bob },
    ];
  },
};
