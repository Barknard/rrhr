import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { rod, ball, bodyOffset, footPath } from './parts.js';
import { VOX } from '../../core/iso.js';

// Stomper: a six-legged running robot. Its legs move in a tripod gait matched to the ground speed, the armoured torso pitches with every stride, and each footfall kicks up dust.
const GUN = 0x9aa4b4, GUN_L = 0xc8d0dc, GUN_D = 0x545c6c, BLK = 0x16141c, RED = 0xff2a3a, YEL = 0xf0bd2a, CHROME = 0xd2d8e2,
  HYD = 0x3a7fd0;
export const GAIT_PHASES = 12;
export const STOMPER_REACH = 9; // voxels a foot reaches ahead of (and behind) its hip

function torso() {
  const m = builder(34, 18, 14);
  for (let x = 2; x <= 31; x++) for (let y = 1; y <= 16; y++) {
    const front = x > 26, h = front ? 10 - (x - 26) : 11, edge = y === 1 || y === 16;
    m.box(x, y, 2, x, y, h, edge ? GUN_D : GUN);
    m.set(x, y, h, edge ? GUN : x % 6 === 0 ? GUN_D : GUN_L);
    if (edge && x % 4 === 0) m.set(x, y, 6, CHROME, 'chrome'); // bolts
  }
  for (let y = 4; y <= 13; y++) m.box(31, y, 6, 31, y, 7, RED, 'emit'); // visor slit
  m.box(32, 6, 3, 33, 11, 5, BLK); // chin grille
  for (let x = 6; x <= 14; x++) for (let y = 3; y <= 14; y++) if ((x + y) % 4 < 2) m.set(x, y, 12, BLK); // back vents
  for (const y of [2, 15]) for (let x = 18; x <= 24; x++) m.set(x, y, 11, ((x >> 1) & 1) ? YEL : BLK); // hazard shoulders
  rod(m, [8, 13, 12], [6, 13, 13], 0.6, BLK); m.set(6, 13, 13, RED, 'emit'); // antenna
  for (const y of [1, 16]) for (const x of [5, 17, 29]) ball(m, x, y, 4, 2.2, GUN_D);  // hip housings
  return m.done();
}

// One leg at gait phase v/GAIT_PHASES: planted and pushing back, then lifted and swung forward (see footPath).
function leg(v) {
  const m = builder(30, 5, 26), y = 2, { dx, dz } = footPath(v / GAIT_PHASES, STOMPER_REACH, 6);
  const hip = [15, y, 19], foot = [15 + dx, y, 1 + dz];
  const knee = [(hip[0] + foot[0]) / 2 + 4, y, (hip[2] + foot[2]) / 2 + 2];
  rod(m, hip, knee, 1.4, GUN);
  rod(m, [hip[0] + 1, y, hip[2] - 2], [knee[0] - 1, y, knee[2] + 1], 0.6, HYD); // hydraulic ram
  rod(m, knee, foot, 1, GUN_D);
  ball(m, ...knee, 1.6, CHROME, 'chrome');
  m.box(Math.round(foot[0]) - 2, 0, Math.round(foot[2]) - 1, Math.round(foot[0]) + 2, 4, Math.round(foot[2]) - 1, BLK); // foot pad
  return m.done();
}

// Six legs, tripod gait: front and rear on one side move with the middle of the other side, so three feet
// are always planted. ox, oy, phase offset.
const LEGS = [[12, -11, 0], [0, -11, 0.5], [-12, -11, 0], [12, 11, 0.5], [0, 11, 0], [-12, 11, 0.5]];
const phaseOf = (anim, ph) => (((anim.gait + ph) % 1) + 1) % 1;

export const stomper = {
  key: 'stomper',
  stride: (4 * STOMPER_REACH) / VOX, // tiles per gait cycle: exactly what a planted foot covers, so no skating
  sets: { torso: partSet(torso), leg: partSet(leg, GAIT_PHASES) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.5, lean: 0.8 });
    const moving = Math.abs(anim.vF) > 0.3;
    const step = moving ? Math.abs(Math.sin(anim.gait * Math.PI * 2)) : 0; // the torso rises with each tripod's push
    return [
      { set: 'torso', ox: b.ox + Math.round(step), oy: b.oy, oz: 13 + b.oz + Math.round(step * 1.5) },
      ...LEGS.map(([ox, oy, ph]) => ({ set: 'leg', variant: Math.floor(phaseOf(anim, ph) * GAIT_PHASES) % GAIT_PHASES, ox, oy })),
    ];
  },
  extras(anim) {
    if (Math.abs(anim.vF) < 1.5) return [];
    return LEGS.filter(([, , ph]) => phaseOf(anim, ph) < 0.05).map(([ox, oy]) => ({ kind: 'dust', ox, oy, oz: 0 }));
  },
};
