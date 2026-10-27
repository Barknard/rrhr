import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { rod, ball, bodyOffset, footPath } from './parts.js';
import { VOX } from '../../core/iso.js';

// Widowmaker: a green hover sled carried on eight spider legs, with a scorpion stinger cannon arched
// over its back. The hull floats and bobs; the legs keep tapping the ground.
const GRN = 0x2fbf73, GRN_L = 0x6cf0a4, GRN_D = 0x166b3e, BLK = 0x16141c, BELLY = 0x24302a, CHROME = 0xc9cfd9,
  GLASS = 0x1f8a6a, VENT = 0x7dffb8, STING = 0xff3b5c, EYE = 0xfff27a;
const GAIT_PHASES = 12;
export const WIDOW_REACH = 9;

function hull() {
  const m = builder(36, 16, 26);
  for (let x = 2; x <= 33; x++) {
    const k = (x - 2) / 31, half = Math.round(7 * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.08)));
    const hz = Math.round(3 + 5 * Math.sin(Math.PI * Math.min(1, k * 1.1 + 0.1)));
    for (let y = 8 - half; y <= 7 + half; y++) {
      const edge = y === 8 - half || y === 7 + half;
      m.box(x, y, 0, x, y, 1, BELLY);
      m.box(x, y, 2, x, y, hz, edge ? GRN_D : GRN);
      m.set(x, y, hz, edge ? GRN : GRN_L);
      if (!edge && (x % 5 === 0)) m.set(x, y, hz, GRN_D); // segment plates like an abdomen
    }
  }
  for (let x = 6; x <= 26; x += 4) for (const y of [2, 13]) m.set(x, y, 3, VENT, 'emit'); // glowing side vents
  for (let x = 20; x <= 27; x++) for (let y = 5; y <= 10; y++) { // cockpit bubble
    const h = Math.round(2.6 * Math.sin((Math.PI * (x - 19)) / 9));
    for (let z = 8; z <= 8 + h; z++) m.set(x, y, z, GLASS, 'glass');
  }
  for (const y of [6, 9]) m.set(33, y, 5, EYE, 'emit'); // eyes
  m.box(34, 7, 3, 35, 8, 4, BLK); // mandibles
  // the stinger: a segmented arc from the tail up and forward over the hull, ending in a cannon
  let prev = null;
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 0.72, x = 3 + 9 * (1 - Math.cos(a)) + i * 0.5, z = 7 + 17 * Math.sin(a);
    const p = [x, 7.5, z];
    if (prev) rod(m, prev, p, 1, i % 2 ? GRN_D : GRN);
    prev = p;
  }
  ball(m, prev[0], 7.5, prev[2], 2, BLK);
  rod(m, [prev[0], 7.5, prev[2]], [prev[0] + 7, 7.5, prev[2] - 4], 0.6, CHROME, 'chrome');
  m.set(prev[0] + 7, 7, prev[2] - 4, STING, 'emit'); m.set(prev[0] + 7, 8, prev[2] - 4, STING, 'emit');
  return m.done();
}

// One spider leg reaching out along +y: hip, a high knee, and a foot that walks (see footPath).
function leg(v, side) {
  const m = builder(24, 19, 24), { dx, dz } = footPath(v / GAIT_PHASES, WIDOW_REACH, 5);
  const Y = y => (side > 0 ? y : 18 - y);
  const hip = [12, Y(0), 12], knee = [12 + dx * 0.4, Y(8), 22], foot = [12 + dx, Y(18), 1 + dz];
  rod(m, hip, knee, 1, GRN_D);
  rod(m, knee, foot, 0.6, BLK);
  ball(m, ...knee, 1.4, CHROME, 'chrome');
  ball(m, ...hip, 1.2, CHROME, 'chrome');
  m.set(foot[0], foot[1], foot[2] - 1, STING);
  return m.done();
}

// Eight legs, four a side, alternating so four feet are always down. ox, side, phase offset.
const LEGS = [-13.5, -4.5, 4.5, 13.5].flatMap((ox, i) => [[ox, -1, (i % 2) * 0.5], [ox, 1, ((i + 1) % 2) * 0.5]]);

export const widowmaker = {
  key: 'widowmaker',
  stride: (4 * WIDOW_REACH) / VOX,
  sets: { hull: partSet(hull), legL: partSet(v => leg(v, -1), GAIT_PHASES), legR: partSet(v => leg(v, 1), GAIT_PHASES) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.5, lean: 1.2 });
    const hover = Math.round(9 + Math.sin(t * 3.1) * 1.5);
    const cycle = Math.abs(anim.vF) > 0.3 ? anim.gait : t * 0.5; // parked: the legs keep shifting restlessly
    return [
      { set: 'hull', ox: b.ox, oy: b.oy, oz: b.oz + hover },
      ...LEGS.map(([ox, side, ph]) => ({
        set: side > 0 ? 'legR' : 'legL', variant: Math.floor((((cycle + ph) % 1) + 1) % 1 * GAIT_PHASES) % GAIT_PHASES, ox, oy: side * 16,
      })),
    ];
  },
  extras: (anim, car, t) => [{ kind: 'glow', ox: 0, oy: 0, oz: 2, r: 13, color: '#2fff9a', a: 0.22 + 0.06 * Math.sin(t * 6) }],
};
