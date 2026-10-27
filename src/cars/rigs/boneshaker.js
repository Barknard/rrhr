import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, ball, bodyOffset, fourWheels } from './parts.js';

// Boneshaker: a purple monster truck with a ribcage roll cage and a bulldozer blade, riding high on
// long-travel suspension over four huge tyres.
const PUR = 0x8a5ad8, PUR_L = 0xb48bff, PUR_D = 0x4a2a80, BONE = 0xeee6d0, BONE_D = 0xb8ad90, STEEL = 0x7d8494,
  DSTEEL = 0x3c4150, BLK = 0x18161e, YEL = 0xf0bd2a, CHROME = 0xc9cfd9, HEAD = 0xfff2b8, GLASS = 0x3a2f6a, TAIL = 0xff2440;

function body() {
  const m = builder(42, 24, 24);
  m.box(4, 7, 0, 36, 16, 1, DSTEEL); // frame rails
  for (let x = 3; x <= 37; x++) for (let y = 3; y <= 20; y++) {
    const fender = (x >= 4 && x <= 13) || (x >= 27 && x <= 36);
    const tz = fender && (y < 6 || y > 17) ? 9 : 7;
    m.box(x, y, 2, x, y, tz, PUR);
    m.set(x, y, tz, y === 3 || y === 20 ? PUR_D : PUR_L);
    if (y === 3 || y === 20) { m.set(x, y, 3, PUR_D); if (x % 6 === 0) m.box(x, y, 4, x, y, tz - 1, PUR_D); }
  }
  for (let x = 14; x <= 24; x++) for (let y = 6; y <= 17; y++) m.box(x, y, 8, x, y, 12, y === 6 || y === 17 ? PUR_D : PUR); // cab
  for (let x = 22; x <= 24; x++) for (let y = 7; y <= 16; y++) m.set(x, y, 11, GLASS, 'glass'); // windscreen
  for (const y of [6, 17]) m.box(16, y, 10, 21, y, 11, GLASS, 'glass'); // side windows
  // the ribcage: bone arches over the cab, a spine along the top, a skull on the hood
  for (let x = 13; x <= 25; x += 3) {
    let prev = null;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI, y = 11.5 - Math.cos(a) * 7.5, z = 8 + Math.sin(a) * 10;
      if (prev) rod(m, prev, [x, y, z], 0.6, i % 3 ? BONE : BONE_D);
      prev = [x, y, z];
    }
  }
  rod(m, [12, 11.5, 18], [26, 11.5, 18], 1, BONE);
  for (let x = 12; x <= 26; x += 2) m.set(x, 11, 19, BONE_D);
  ball(m, 33, 11.5, 10, 2.4, BONE);
  for (const y of [10, 13]) m.set(35, y, 11, BLK);
  m.box(35, 11, 9, 35, 12, 9, BLK);
  // bulldozer blade with hazard stripes and hydraulic arms
  for (let y = 0; y <= 23; y++) for (let z = 0; z <= 10; z++) {
    const curve = Math.round(Math.pow((z - 5) / 5, 2) * 1.5);
    m.set(40 - curve, y, z, z === 10 ? STEEL : ((y + z) >> 1) & 1 ? YEL : BLK);
    m.set(41 - curve, y, z, DSTEEL);
  }
  for (const y of [7, 16]) rod(m, [36, y, 5], [39, y, 6], 0.6, CHROME, 'chrome');
  for (const y of [5, 18]) { m.box(14, y, 12, 14, y, 20, CHROME, 'chrome'); m.set(14, y, 21, BLK); } // stacks
  for (const y of [5, 6, 17, 18]) m.set(37, y, 6, HEAD, 'emit');
  for (const y of [4, 19]) m.box(3, y, 5, 3, y, 6, TAIL, 'emit');
  return m.done();
}

export const boneshaker = {
  key: 'boneshaker',
  sets: { body: partSet(body), wheel: tyre(7, 5, { rim: 0xb48bff, spoke: 0x8a5ad8 }) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 1.6, lean: 1.6 });
    return [
      { set: 'body', ox: b.ox, oy: b.oy, oz: b.oz + 6 },
      ...fourWheels(anim, t, { rearSet: 'wheel', frontSet: 'wheel', rx: -12, ry: 12, rr: 7, fx: 11, fy: 12, fr: 7 }),
    ];
  },
};
