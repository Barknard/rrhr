import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, ball, bodyOffset, wheelVariant, steerAngle } from './parts.js';

// Rattler: a snub-nosed rig pulling two diamond-back trailers that snake behind it through corners.
// The cab is the car; each trailer is drawn as its own composite at the trailer's simulated position.
const RED = 0xd6352f, RED_L = 0xff6a5a, RED_D = 0x7a1612, CHROME = 0xd2d8e2, BLK = 0x16141c, GLASS = 0x1f4f7a,
  TAN = 0xc9a36a, BRN = 0x5a3a1e, BRN_D = 0x3a2412, CREAM = 0xf2e6c8, FANG = 0xf6f2e8, HEAD = 0xfff2b8, TAIL = 0xff2440;

function cab() {
  const m = builder(28, 20, 24);
  m.box(1, 6, 1, 26, 13, 2, BLK); // chassis
  for (let x = 14; x <= 26; x++) for (let y = 2; y <= 17; y++) { // hood
    const top = 9 - (x > 23 ? x - 23 : 0);
    m.box(x, y, 3, x, y, top, y === 2 || y === 17 ? RED_D : RED);
    m.set(x, y, top, (y === 2 || y === 17) ? RED : RED_L);
  }
  for (let y = 4; y <= 15; y++) for (let z = 3; z <= 8; z++) m.set(27, y, z, (y + z) & 1 ? CHROME : BLK, (y + z) & 1 ? 'chrome' : undefined); // grille
  for (const y of [6, 13]) { m.box(27, y, 1, 27, y, 2, FANG); } // the fangs
  for (let x = 3; x <= 13; x++) for (let y = 2; y <= 17; y++) { // cab + sleeper
    const top = x < 6 ? 15 : 18;
    m.box(x, y, 3, x, y, top, y === 2 || y === 17 ? RED_D : RED);
    m.set(x, y, top, RED_L);
  }
  for (let y = 4; y <= 15; y++) for (let z = 12; z <= 16; z++) m.set(13, y, z, GLASS, 'glass'); // windscreen
  for (const y of [2, 17]) m.box(8, y, 12, 12, y, 15, GLASS, 'glass');
  m.box(13, 3, 17, 14, 16, 18, BLK); // sun visor
  for (const y of [1, 18]) { rod(m, [11, y, 4], [11, y, 23], 0.6, CHROME, 'chrome'); m.set(11, y, 23, BLK); } // stacks
  for (const y of [1, 18]) m.box(6, y, 3, 12, y, 6, CHROME, 'chrome'); // fuel tanks
  rod(m, [9, 6, 19], [9, 13, 19], 0.4, CHROME, 'chrome'); // air horn
  for (const y of [3, 16]) m.set(27, y, 6, HEAD, 'emit');
  m.box(0, 7, 3, 2, 12, 4, BLK); // fifth wheel
  return m.done();
}

// A diamond-back trailer; the last one ends in a rattle.
function trailer(last) {
  const m = builder(28, 18, 16);
  m.box(1, 6, 1, 26, 11, 2, BLK);
  for (let x = 2; x <= 25; x++) for (let y = 1; y <= 16; y++) for (let z = 3; z <= 12; z++) {
    const shell = y === 1 || y === 16 || z === 12 || x === 2 || x === 25;
    if (!shell) continue;
    const u = y === 1 || y === 16 ? x : x, v = y === 1 || y === 16 ? z : y;
    const dia = (Math.abs(((u + v) % 8) - 4) + Math.abs(((u - v + 64) % 8) - 4));
    m.set(x, y, z, dia < 2 ? BRN_D : dia < 4 ? BRN : z === 12 && (y > 6 && y < 11) ? CREAM : TAN);
  }
  if (last) for (let i = 0; i < 4; i++) ball(m, 1 - i * 0 , 8.5, 10 - i * 2, 1.6 - i * 0.2, i & 1 ? CREAM : TAN); // the rattle
  else m.box(26, 7, 3, 27, 10, 4, BLK); // coupling
  for (const y of [3, 14]) m.set(2, y, 4, TAIL, 'emit');
  return m.done();
}

export const rattler = {
  key: 'rattler',
  sets: { cab: partSet(cab), trailer: partSet(v => trailer(v === 1), 2), wheel: tyre(5, 3), front: tyre(4.5, 3) },
  pose(anim, car, t) {
    const b = bodyOffset(anim);
    const wv = wheelVariant(anim, 5, t), fv = wheelVariant(anim, 4.5, t), dh = steerAngle(anim);
    return [
      { set: 'cab', ...b },
      { set: 'front', variant: fv, ox: 9, oy: -9, dh }, { set: 'front', variant: fv, ox: 9, oy: 9, dh },
      { set: 'wheel', variant: wv, ox: -7, oy: -9 }, { set: 'wheel', variant: wv, ox: -7, oy: 9 },
    ];
  },
  // trailer: { x, y, z, heading, index }; drawn in its own space, facing its own heading
  trailerPose(anim, trailer, car, t) {
    const wv = wheelVariant(anim, 5, t);
    return [
      { set: 'trailer', variant: trailer.index === 1 ? 1 : 0, ox: 0, oy: 0, oz: Math.round(anim.bob * 0.5) },
      { set: 'wheel', variant: wv, ox: -8, oy: -9 }, { set: 'wheel', variant: wv, ox: -8, oy: 9 },
    ];
  },
};
