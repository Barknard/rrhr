import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, bodyOffset, fourWheels } from './parts.js';

// Afterburner: a jet-powered dragster: needle nose, skinny front wheels, fat slicks, a turbojet on its
// back whose flame grows with the throttle.
const PINK = 0xff3df0, PINK_L = 0xff9af6, PINK_D = 0x9a1690, WHT = 0xf2eef8, BLK = 0x16141c, CHROME = 0xd2d8e2,
  GLASS = 0x2a1f5a, HOT = 0xff8a1e, DSTEEL = 0x454a57;

function body() {
  const m = builder(48, 14, 18);
  for (let x = 2; x <= 46; x++) {
    const k = x / 46, half = x > 30 ? Math.max(1, Math.round(4 - (x - 30) * 0.2)) : 5;
    const top = x > 30 ? Math.max(3, Math.round(6 - (x - 30) * 0.18)) : 7;
    for (let y = 7 - half; y <= 6 + half; y++) {
      m.box(x, y, 2, x, y, top, y === 7 - half || y === 6 + half ? PINK_D : PINK);
      m.set(x, y, top, Math.abs(y - 6.5) < 1 ? WHT : PINK_L); // centre stripe
      if (k > 0.5 && (x % 6 === 0)) m.set(x, y, top, PINK_D);
    }
  }
  for (let x = 20; x <= 26; x++) for (let y = 4; y <= 9; y++) { // cockpit
    const h = Math.round(2.5 * Math.sin((Math.PI * (x - 19)) / 8));
    for (let z = 8; z <= 7 + h; z++) m.set(x, y, z, GLASS, 'glass');
  }
  // the turbojet: a cylinder along x on the back, with an intake lip and a glowing nozzle
  for (let x = 3; x <= 18; x++) for (let y = 2; y <= 11; y++) for (let z = 7; z <= 16; z++) {
    const d = Math.hypot(y - 6.5, z - 11.5);
    if (d > 4.6) continue;
    if (x === 18 && d < 3) m.set(x, y, z, BLK);
    else if (x === 3) m.set(x, y, z, d < 2.6 ? HOT : DSTEEL, d < 2.6 ? 'emit' : undefined);
    else m.set(x, y, z, x % 4 === 0 ? DSTEEL : CHROME, 'chrome');
  }
  for (const y of [1, 12]) { rod(m, [3, y, 8], [6, y, 15], 0.4, BLK); } // wing struts
  m.box(0, 0, 15, 4, 13, 15, PINK); m.box(0, 0, 16, 1, 13, 16, WHT); // rear wing
  m.box(44, 3, 2, 47, 10, 2, BLK); // nose splitter
  return m.done();
}

export const afterburner = {
  key: 'afterburner',
  sets: { body: partSet(body), rear: tyre(6.5, 6), front: tyre(3, 2) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.7, lean: 0.8 });
    return [{ set: 'body', ...b }, ...fourWheels(anim, t, { rx: -11, ry: 10, rr: 6.5, fx: 17, fy: 6, fr: 3 })];
  },
  extras: (anim) => [
    { kind: 'jet', ox: -24, oy: 0, oz: 11, power: Math.max(0.15, anim.throttle) },
    ...(anim.throttle > 0.5 ? [{ kind: 'shimmer', ox: -34, oy: 0, oz: 11 }] : []),
  ],
};
