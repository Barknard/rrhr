import { builder } from '../../render/voxel/builder.js';
import { partSet, spinVariant, BLUR_RATE } from './rig.js';
import { tyre, fan, rod, ball, bodyOffset, wheelVariant, steerAngle } from './parts.js';

// Whirlybird: a gyrocopter car. A free-spinning rotor overhead speeds up with airflow (a blur disc when
// fast), a pusher prop drives it, and it glides off launch pads.
const TEAL = 0x4fe0c8, TEAL_L = 0xa0fff0, TEAL_D = 0x1a7a6a, WHT = 0xf2f6f8, BLK = 0x16141c, CHROME = 0xd2d8e2,
  GLASS = 0x1f5a7a, RED = 0xe0442a, YEL = 0xf0bd2a;
const ROTOR_R = 22;

function body() {
  const m = builder(36, 14, 30);
  for (let x = 12; x <= 32; x++) for (let y = 1; y <= 12; y++) { // pod
    const k = (x - 12) / 20, r = Math.hypot((y - 6.5) / 6, 0), h = Math.round(9 * Math.sqrt(Math.max(0, 1 - Math.pow(k * 2 - 1, 4))) - r * 2);
    if (h < 1) continue;
    for (let z = 3; z <= 3 + h; z++) {
      const glass = k > 0.45 && z > 6 && y > 2 && y < 11;
      m.set(x, y, z, glass ? GLASS : z === 3 + h ? TEAL_L : y === 1 || y === 12 ? TEAL_D : TEAL, glass ? 'glass' : undefined);
    }
  }
  rod(m, [2, 6.5, 8], [13, 6.5, 6], 1, TEAL_D);             // tail boom
  m.box(1, 6, 8, 3, 7, 15, WHT); m.box(1, 6, 14, 3, 7, 15, RED); // fin with a red tip
  m.box(1, 2, 8, 3, 11, 8, WHT);                            // tailplane
  rod(m, [20, 6.5, 12], [20, 6.5, 27], 0.6, CHROME, 'chrome'); // rotor mast
  ball(m, 20, 6.5, 28, 1.4, BLK);
  for (const y of [1, 12]) rod(m, [16, y, 2], [16, y, 5], 0.4, BLK); // gear legs
  m.set(33, 5, 6, YEL, 'emit'); m.set(33, 8, 6, YEL, 'emit');
  return m.done();
}

// variant 0: two blades along x; variant 1: the blurred disc
function rotor(v) {
  const s = 2 * ROTOR_R + 1, m = builder(s, s, 2);
  for (let x = 0; x < s; x++) for (let y = 0; y < s; y++) {
    const dx = x - ROTOR_R, dy = y - ROTOR_R, d = Math.hypot(dx, dy);
    if (v === 0 ? Math.abs(dy) <= 1 && d <= ROTOR_R : d <= ROTOR_R && (d > ROTOR_R - 1.2 || (x + y) % 3 === 0)) {
      m.set(x, y, 0, v === 0 ? (Math.abs(dx) > ROTOR_R - 3 ? RED : WHT) : 0x9aa0aa);
    }
  }
  return m.done();
}

export const whirlybird = {
  key: 'whirlybird',
  sets: { body: partSet(body), rotor: partSet(rotor, 2), prop: fan(5, 3, { cage: 0 }), rear: tyre(3.5, 3), front: tyre(3, 2) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.8 });
    const rate = 5 + Math.abs(anim.vF) * 2 + (anim.airborne ? 12 : 0);
    const propRate = 8 + Math.max(0, anim.throttle) * 30;
    const rv = wheelVariant(anim, 3.5, t), fv = wheelVariant(anim, 3, t);
    return [
      { set: 'body', ...b },
      { set: 'rotor', variant: rate > BLUR_RATE ? 1 : 0, ox: b.ox + 2, oy: b.oy, oz: b.oz + 29, dh: t * rate },
      { set: 'prop', variant: spinVariant(t * propRate, propRate, (2 * Math.PI) / 3, t), ox: b.ox - 20, oy: b.oy, oz: b.oz + 3 },
      { set: 'rear', variant: rv, ox: -2, oy: -7 }, { set: 'rear', variant: rv, ox: -2, oy: 7 },
      { set: 'front', variant: fv, ox: 14, oy: 0, dh: steerAngle(anim) },
    ];
  },
};
