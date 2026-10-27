import { builder } from '../../render/voxel/builder.js';
import { partSet, spinVariant } from './rig.js';
import { tyre, saw, bodyOffset, fourWheels, TYRE_PERIOD } from './parts.js';

// Grinder: red wedge hot rod with a spinning nose saw.
function body() {
  const m = builder(40, 22, 18);
  const RED = 0xe0442a, RED_L = 0xff7a50, RED_D = 0x8e2214, BLK = 0x1e1b24, STEEL = 0x8890a0, DSTEEL = 0x454a57,
    CHROME = 0xc9cfd9, GLASS = 0x2a6f99, YEL = 0xf0bd2a, HEAD = 0xfff2b8, TAIL = 0xff2440, WHITE = 0xece8e2;
  const top = x => Math.round(11 - Math.max(0, x - 8) * 0.24);
  m.box(3, 5, 2, 35, 16, 3, DSTEEL); // chassis tub
  for (let x = 3; x <= 35; x++) {
    const half = x < 6 || x > 30 ? 5 : 6, y0 = 11 - half, y1 = 10 + half, tz = top(x);
    for (let y = y0; y <= y1; y++) {
      m.box(x, y, 4, x, y, tz, RED);
      m.set(x, y, 4, RED_D);
      if (y === y0 || y === y1) {
        if (x % 7 === 0) m.box(x, y, 5, x, y, tz - 1, RED_D);                   // panel seams
        if (x % 3 === 1 && x > 5 && x < 33 && tz > 6) m.set(x, y, tz - 1, STEEL); // rivets
        m.set(x, y, tz, RED_L);                                                // highlight crease
      }
      if (x >= 24 && x <= 34 && y >= 6 && y <= 15) m.set(x, y, tz, ((x + y) >> 1) & 1 ? BLK : YEL); // hazard hood
    }
  }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { // number roundels on both doors
    if (dx * dx + dz * dz > 5) continue;
    const c = dx * dx + dz * dz <= 1 ? BLK : WHITE;
    m.set(21 + dx, 5, 7 + dz, c); m.set(21 + dx, 16, 7 + dz, c);
  }
  for (let x = 12; x <= 19; x++) { // cockpit canopy
    const hh = Math.round(3.4 * Math.sin((Math.PI * (x - 11)) / 9));
    for (let y = 6; y <= 15; y++) for (let z = top(x) + 1; z <= top(x) + hh; z++) m.set(x, y, z, y === 6 || y === 15 ? BLK : GLASS, y === 6 || y === 15 ? undefined : 'glass');
  }
  for (const y of [6, 15]) m.box(10, y, top(10) + 1, 10, y, top(10) + 5, CHROME, 'chrome'); // roll cage
  m.box(10, 6, top(10) + 5, 10, 15, top(10) + 5, CHROME, 'chrome');
  m.box(4, 8, 12, 8, 13, 13, CHROME, 'chrome'); // supercharger + scoop
  m.box(5, 9, 14, 7, 12, 15, BLK);
  for (let y = 9; y <= 12; y++) m.set(7, y, 15, y & 1 ? STEEL : BLK);
  for (const y of [5, 16]) { m.box(3, y, 12, 3, y, 15, CHROME, 'chrome'); m.set(3, y, 16, BLK); } // exhaust stacks
  m.box(0, 3, 15, 2, 18, 15, RED); m.box(0, 3, 15, 0, 18, 15, RED_D); // rear wing
  for (const y of [3, 18]) m.box(0, y, 13, 2, y, 15, BLK);
  for (const y of [7, 14]) m.box(1, y, 12, 1, y, 14, DSTEEL);
  for (const [y0, y1] of [[0, 4], [17, 21]]) { m.box(4, y0, 12, 13, y1, 12, RED); m.box(4, y0, 12, 4, y1, 12, RED_D); m.box(13, y0, 12, 13, y1, 12, RED_D); } // fenders
  for (const [y0, y1] of [[1, 4], [17, 20]]) m.box(29, y0, 9, 33, y1, 9, RED);
  for (const y of [4, 17]) { m.box(28, y, 4, 33, y, 4, DSTEEL); m.box(6, y, 4, 26, y, 4, CHROME, 'chrome'); } // arms, side pipes
  for (const [y0, y1] of [[6, 7], [14, 15]]) { m.box(35, y0, 5, 35, y1, 6, HEAD, 'emit'); m.box(3, y0 - 1, 6, 3, y1 - 1, 7, TAIL, 'emit'); }
  m.box(36, 6, 3, 37, 15, 4, DSTEEL); // bumper and the saw arm
  m.box(36, 10, 5, 37, 11, 5, STEEL);
  return m.done();
}

export const grinder = {
  key: 'grinder',
  sets: { body: partSet(body), rear: tyre(5.5, 4), front: tyre(4, 3), saw: saw(4.2) },
  pose(anim, car, t) {
    const b = bodyOffset(anim);
    const sawAngle = anim.t * 9 + anim.roll * 0.05, sawRate = 9 + Math.abs(anim.vF) * 1.6;
    return [
      { set: 'body', ...b },
      ...fourWheels(anim, t, { rx: -11, ry: 9, rr: 5.5, fx: 11.5, fy: 8.5, fr: 4 }),
      { set: 'saw', variant: spinVariant(sawAngle, sawRate, TYRE_PERIOD, t), ox: 19.5 + b.ox, oy: b.oy, oz: b.oz },
    ];
  },
};
