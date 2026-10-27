import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, ball, bodyOffset, fourWheels } from './parts.js';

// Last Ride: a hot-rod hearse with a blower through the hood and an open bed where the coffin bounces
// and its lid rattles. Flames lick out of the side pipes.
const BLK = 0x1c1824, BLK_L = 0x3a3346, PURP = 0x6a3a9a, CHROME = 0xd2d8e2, WOOD = 0x5a3216, WOOD_D = 0x3a1e0c, BRASS = 0xd8a840,
  BONE = 0xeee6d0, GLASS = 0x2a1f3a, HEAD = 0xfff2b8, TAIL = 0xff2440;

function body() {
  const m = builder(44, 20, 18);
  for (let x = 2; x <= 41; x++) for (let y = 2; y <= 17; y++) {
    const hood = x > 26, bed = x < 14;
    const top = hood ? 8 : bed ? 6 : 13;
    const edge = y === 2 || y === 17;
    if (bed && !edge && x > 2 && y > 3 && y < 16) { m.box(x, y, 2, x, y, 3, BLK_L); continue; } // open bed floor
    m.box(x, y, 2, x, y, top, BLK);
    m.set(x, y, top, edge ? BLK_L : BLK);
    if (edge && (x % 2 === 0)) m.set(x, y, 5, CHROME, 'chrome'); // chrome beltline
  }
  for (let x = 15; x <= 26; x++) for (const y of [2, 17]) m.box(x, y, 9, x, y, 12, PURP); // curtained side windows
  for (let y = 3; y <= 16; y++) for (let z = 9; z <= 12; z++) m.set(26, y, z, GLASS, 'glass'); // windscreen
  for (const y of [2, 17]) rod(m, [8, y, 6], [12, y, 10], 0.6, CHROME, 'chrome'); // landau bars
  m.box(30, 6, 9, 36, 13, 11, CHROME, 'chrome'); // blower
  m.box(32, 7, 12, 34, 12, 13, BLK);
  for (let y = 7; y <= 12; y++) m.set(33, y, 14, y & 1 ? CHROME : BLK); // butterfly intake
  for (let y = 4; y <= 15; y++) for (let z = 3; z <= 7; z++) m.set(42, y, z, (y + z) & 1 ? CHROME : BLK); // grille
  ball(m, 41, 9.5, 10, 1.5, BONE); // skull ornament
  for (const y of [1, 18]) rod(m, [16, y, 3], [32, y, 3], 1, CHROME, 'chrome'); // side pipes
  for (const y of [4, 15]) m.set(42, y, 7, HEAD, 'emit');
  for (const y of [3, 16]) m.box(2, y, 4, 2, y, 5, TAIL, 'emit');
  return m.done();
}

function coffin(v) {
  const m = builder(20, 10, 8);
  const lift = v === 1 ? 2 : 0;
  for (let x = 1; x <= 18; x++) {
    const half = x > 13 ? 4 - Math.floor((x - 13) / 2) : 4;
    for (let y = 5 - half; y <= 4 + half; y++) {
      m.box(x, y, 0, x, y, 3, y === 5 - half || y === 4 + half ? WOOD_D : WOOD);
      const lz = 4 + Math.round((lift * (18 - x)) / 17); // the lid lifts at the foot end
      m.set(x, y, lz, (x + y) % 5 === 0 ? WOOD_D : WOOD);
    }
  }
  for (const x of [4, 10, 15]) { m.set(x, 0, 2, BRASS, 'chrome'); m.set(x, 9, 2, BRASS, 'chrome'); } // handles
  ball(m, 12, 4.5, 5, 1.3, BONE); // a skull on the lid
  return m.done();
}

export const lastRide = {
  key: 'lastRide',
  sets: { body: partSet(body), coffin: partSet(coffin, 2), rear: tyre(6, 5, { rim: 0xd8a840 }), front: tyre(4.5, 3) },
  pose(anim, car, t) {
    const b = bodyOffset(anim);
    const jolt = Math.round(Math.max(0, -anim.bob) * 1.5 + Math.abs(anim.swing) * 2);
    return [
      { set: 'body', ...b },
      { set: 'coffin', variant: jolt > 1 || (Math.abs(anim.vF) > 1 && Math.floor(t * 8) % 5 === 0) ? 1 : 0, ox: b.ox - 13, oy: b.oy, oz: b.oz + 4 + jolt },
      ...fourWheels(anim, t, { rx: -13, ry: 10, rr: 6, fx: 14, fy: 9, fr: 4.5 }),
    ];
  },
  extras: (anim) => (anim.throttle > 0 || anim.lift ? [-1, 1].map(s => ({ kind: 'flame', ox: -4, oy: s * 10, oz: 3, power: anim.lift ? 1 : 0.5 })) : []),
};
