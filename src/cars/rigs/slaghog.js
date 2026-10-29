import { builder, transform } from '../../render/voxel/builder.js';
import { partSet, spinner } from './rig.js';
import { rod, ball, bodyOffset, fourWheels, TYRE_PERIOD } from './parts.js';

// The Slaghog, King Cinder's ride (the series boss; see src/series/bosses.js): a heavy four-wheel ATV on
// balloon tyres of cooled lava rock, a black-iron roll cage, a skull on the front, a slag hopper on the back
// (the MOLTEN TRAIL) and twin exhausts that belch fire. The King rides it, leaning into the corners.
const PAINT = 0xd8461a, PAINT_L = 0xff7a36, PAINT_D = 0x7e220c, IRON = 0x2a2428, DSTEEL = 0x454a57, CAGE = 0x5a5f6c,
  SEAT = 0x1e1b24, BONE = 0xe6dcc2, BONE_D = 0xa89a7e, SOCKET = 0x16100e, HOT = 0xff8a1a, GLOW = 0xffc040,
  TAIL = 0xff2440, ROCK = 0x3a3236, ROCK_D = 0x262024, ROCK_L = 0x564a4c;
const OBSIDIAN = [0x241d2c, 0x2e2638, 0x382e44], OBS_HI = 0x5a4a6e, SEAM = 0xff6a1a;
const WHEEL_R = 7, WHEEL_W = 6, LEAN_STEPS = 5, LEAN_MAX = 0.28;

// A balloon tyre of cooled lava rock: a fat, rounded profile with knobbly rock lugs and glowing cracks that
// turn with the wheel, on a black-iron rim with a molten hub.
function lavaWheel(phase, blur) {
  const r = WHEEL_R, w = WHEEL_W, c = Math.ceil(r), s = 2 * c + 1, m = builder(s, w, s);
  for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) {
    const dx = x - c, dz = z - c, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx) + phase, frac = k => (((ang * k) / (2 * Math.PI)) % 1 + 1) % 1;
    for (let y = 0; y < w; y++) {
      const edge = Math.min(y, w - 1 - y), rr = r - [1.3, 0.4, 0][Math.min(edge, 2)]; // the balloon bulge
      if (d > rr + 0.3) continue;
      const face = y === 0 || y === w - 1;
      let col, mat;
      if (d > rr - 1.6) { // the tread: rock lugs, and cracks that glow between them
        if (blur) col = (y + (z & 1)) & 1 ? ROCK : ROCK_D;
        else if (frac(9) < 0.12 && edge > 0) { col = (y & 1) ? SEAM : HOT; mat = 'emit'; }
        else col = frac(9) < 0.6 ? (edge ? ROCK_L : ROCK) : ROCK_D;
      } else if (!face) col = ROCK_D;
      else if (d > r * 0.5) col = !blur && Math.abs(d - r * 0.68) < 0.5 && frac(5) < 0.3 ? SEAM : ROCK, mat = col === SEAM ? 'emit' : undefined;
      else if (d > r * 0.32) { col = blur ? DSTEEL : frac(5) < 0.3 ? 0x8a8f9a : IRON; mat = 'chrome'; } // lug nuts on the iron rim
      else { col = GLOW; mat = 'emit'; }
      m.set(x, y, z, col, mat);
    }
  }
  return m.done();
}

function body() {
  const m = builder(40, 26, 43);
  const cy = 12.5, wheelX = [7.5, 31.5];
  m.box(5, 8, 3, 35, 17, 5, DSTEEL);                          // the chassis rails
  for (const x of wheelX) m.box(x - 1, 2, 6, x + 1, 23, 7, IRON); // axles
  for (let x = 8; x <= 32; x++) for (let y = 6; y <= 19; y++) { // the main tub, painted
    const top = x > 25 ? 11 : 12, edge = y === 6 || y === 19;
    for (let z = 6; z <= top; z++) m.set(x, y, z, edge && z === top ? PAINT_L : z === 6 ? PAINT_D : PAINT);
  }
  for (let x = 13; x <= 25; x++) for (const y of [7, 18]) if (x % 3 === 0) m.set(x, y, 9, 0x8a8f9a, 'chrome'); // rivets
  for (const x of wheelX) for (const y0 of [0, 20]) { // fat fenders arching over each wheel
    for (let dx = -7; dx <= 7; dx++) {
      const z = 15 - Math.round(Math.max(0, Math.abs(dx) - 3) * 0.75);
      for (let y = y0; y <= y0 + 5; y++) {
        m.set(x + dx, y, z, y === y0 || y === y0 + 5 ? PAINT_D : PAINT);
        m.set(x + dx, y, z + 1, (dx + y) % 5 === 0 ? PAINT_D : PAINT_L);
      }
    }
  }
  for (const y0 of [0, 20]) m.box(15, y0, 7, 23, y0 + 5, 7, IRON); // footboards between the fenders
  m.box(10, 9, 13, 18, 16, 14, SEAT); m.box(10, 9, 15, 11, 16, 16, SEAT); // the saddle and its backrest
  for (let x = 19; x <= 25; x++) { // the tank, with a flame lick
    const h = Math.round(2.5 * Math.sin((Math.PI * (x - 18)) / 8));
    for (let y = 9; y <= 16; y++) for (let z = 12; z <= 13 + h; z++) m.set(x, y, z, z === 13 + h ? (x + y) % 4 === 0 ? GLOW : PAINT_L : PAINT);
  }
  rod(m, [25, cy, 14], [28, cy, 19], 0.8, DSTEEL);           // the steering post
  rod(m, [28, 5, 19], [28, 20, 19], 0.6, CAGE, 'chrome');    // handlebars
  for (const y of [5, 20]) m.box(28, y, 19, 29, y, 19, SEAT);
  for (let x = 13; x <= 24; x++) for (const y of [8, 17]) if (x % 2) m.set(x, y, 5, 0x8a8f9a, 'chrome'); // the engine fins under the tub
  m.box(32, 6, 12, 36, 19, 12, IRON);                         // the front rack
  for (let y = 6; y <= 19; y += 2) m.set(36, y, 13, IRON);
  // the skull on the nose: bone dome, black sockets that glow as headlights, a nose hole and a row of teeth
  for (let x = 33; x <= 39; x++) for (let y = 6; y <= 19; y++) for (let z = 4; z <= 12; z++) {
    const e = ((x - 34) / 5) ** 2 + ((y - cy) / 6.5) ** 2 + ((z - 8.5) / 4.5) ** 2;
    if (e <= 1) m.set(x, y, z, z <= 5 ? BONE_D : BONE);
  }
  for (const y of [9.5, 15.5]) for (let dy = -1; dy <= 1; dy++) for (const z of [8, 9]) m.set(38 + (Math.abs(dy) === 1 ? 0 : 1), y + dy, z, dy === 0 && z === 8 ? 0xff3a1a : SOCKET, dy === 0 && z === 8 ? 'emit' : undefined);
  m.set(39, cy - 0.5, 6, SOCKET); m.set(39, cy + 0.5, 6, SOCKET);
  for (let y = 8; y <= 17; y++) m.set(38, y, 4, y % 2 ? BONE : SOCKET);
  m.box(35, 4, 3, 37, 21, 3, DSTEEL);                         // the bumper under the jaw
  // the slag hopper on the back: an iron bucket of glowing slag
  m.box(0, 7, 8, 5, 18, 13, IRON);
  for (let y = 8; y <= 17; y++) for (let x = 1; x <= 4; x++) m.set(x, y, 13, (x * 3 + y) % 5 === 0 ? GLOW : HOT, 'emit');
  for (const y of [7, 18]) m.box(0, y, 13, 5, y, 14, DSTEEL);
  for (const y of [8, 17]) m.box(0, y, 6, 0, y, 7, TAIL, 'emit');
  // twin exhausts sweeping up behind the seat; the tips glow
  for (const y of [4, 21]) { rod(m, [14, y, 7], [6, y, 12], 0.7, CAGE, 'chrome'); rod(m, [6, y, 12], [2, y, 21], 0.7, CAGE, 'chrome'); m.set(2, y, 22, HOT, 'emit'); m.set(1, y, 22, GLOW, 'emit'); }
  // the roll cage: a rear hoop, raked front pillars and top rails, in black iron
  const TOP = 41;
  for (const y of [3.5, 21.5]) { rod(m, [7, y, 12], [7, y, TOP], 0.6, CAGE, 'chrome'); rod(m, [24, y, 12], [18, y, TOP], 0.6, CAGE, 'chrome'); rod(m, [7, y, TOP], [18, y, TOP], 0.6, CAGE, 'chrome'); }
  rod(m, [7, 3.5, TOP], [7, 21.5, TOP], 0.6, CAGE, 'chrome'); rod(m, [18, 3.5, TOP], [18, 21.5, TOP], 0.6, CAGE, 'chrome');
  rod(m, [7, 3.5, 20], [7, 21.5, 20], 0.5, CAGE, 'chrome');
  for (const y of [3.5, 21.5]) for (let z = 16; z <= TOP; z += 5) m.set(7, y, z, 0xff3a1a, 'emit'); // red warning lamps up the hoop
  return m.done();
}

// King Cinder riding: a hulking obsidian torso with glowing seams, his arms out to the bars, legs on the
// footboards, and his crowned head with coal eyes. Model z 0 sits 8 voxels above the body's.
function rider(v) {
  const m = builder(22, 22, 34), cy = 10.5;
  const rock = (x, y, z) => ((x * 5 + y * 3 + z * 7) % 11 === 0 ? SEAM : (x + 2 * y + 3 * z) % 13 === 0 ? OBS_HI : OBSIDIAN[(x + y + z) % 3]);
  for (let x = 1; x <= 12; x++) for (let y = 2; y <= 19; y++) for (let z = 6; z <= 20; z++) { // the torso, hunched forward
    const lean = (z - 6) * 0.25, e = Math.abs((x - 5.5 - lean) / 4.6) ** 2.5 + Math.abs((y - cy) / 7.5) ** 2.5 + Math.abs((z - 13) / 7.5) ** 2.5;
    if (e <= 1) { const c = rock(x, y, z); m.set(x, y, z, c, c === SEAM ? 'emit' : undefined); }
  }
  for (const s of [-1, 1]) {
    const y = cy + s * 6.5;
    rod(m, [6, cy + s * 4, 7], [12, cy + s * 7, 10], 1.4, OBSIDIAN[1]); // thighs, knees up
    rod(m, [12, cy + s * 7, 10], [13, cy + s * 8, 2], 1.2, OBSIDIAN[0]); // shins down to the footboards
    m.box(12, cy + s * 8 - 1, 0, 16, cy + s * 8 + 1, 1, OBSIDIAN[2]);    // feet
    ball(m, 7, y, 18, 2.6, OBSIDIAN[2]);                                 // shoulders
    rod(m, [7, y, 17], [14, y - s * 0.5, 14], 1.3, OBSIDIAN[1]);        // upper arms
    rod(m, [14, y - s * 0.5, 14], [19, cy + s * 7.5, 11], 1.1, OBSIDIAN[0]); // forearms to the bars
    ball(m, 19.5, cy + s * 7.5, 11, 1.4, OBS_HI);                       // fists
    m.set(7, y, 21, SEAM, 'emit'); m.set(14, y, 15, SEAM, 'emit');
  }
  for (let x = 4; x <= 15; x++) for (let y = 5; y <= 16; y++) for (let z = 19; z <= 28; z++) { // the head, jutting forward
    const e = Math.abs((x - 9.5) / 4.6) ** 2.5 + Math.abs((y - cy) / 4.6) ** 2.5 + Math.abs((z - 23) / 4.4) ** 2.5;
    if (e <= 1) m.set(x, y, z, z <= 20 ? OBSIDIAN[0] : OBSIDIAN[(x + y + z) % 2 + 1]);
  }
  for (const y of [cy - 2, cy + 2]) { m.set(14, y, 24, GLOW, 'emit'); m.set(14, y + (y < cy ? -1 : 1), 24, HOT, 'emit'); m.set(14, y, 25, SOCKET); } // coal eyes under the brow
  for (let y = cy - 2; y <= cy + 2; y++) m.set(14, y, 21, SEAM, 'emit'); // the snarl
  for (let i = 0; i < 7; i++) { // the obsidian crown: seven spikes, the front one tallest
    const a = (i / 7) * Math.PI * 2, x = 9.5 + Math.cos(a) * 4, y = cy + Math.sin(a) * 4, h = 2 + Math.round(1.5 * (Math.cos(a) + 1));
    for (let z = 27; z <= 27 + h; z++) m.set(x, y, z, z === 27 + h ? SEAM : OBSIDIAN[0], z === 27 + h ? 'emit' : undefined);
  }
  return transform(m.done(), { roll: (v - (LEAN_STEPS - 1) / 2) * ((2 * LEAN_MAX) / (LEAN_STEPS - 1)), pivot: [10.5, cy, 6] }); // pivot at the box centre: the anchor stays put
}

export const slaghog = {
  key: 'slaghog',
  sets: { body: partSet(body), rider: partSet(rider, LEAN_STEPS), wheel: spinner(lavaWheel, TYRE_PERIOD) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 1.3, lean: 1.2 });
    const into = Math.max(-1, Math.min(1, -anim.lean / 0.06)); // the King leans into the turn
    const lean = Math.round((LEAN_STEPS - 1) / 2 - into * ((LEAN_STEPS - 1) / 2));
    return [
      { set: 'body', ...b },
      { set: 'rider', variant: lean, ox: b.ox, oy: b.oy, oz: b.oz + 8 },
      ...fourWheels(anim, t, { rearSet: 'wheel', frontSet: 'wheel', rx: -12, ry: 11, rr: WHEEL_R, fx: 12, fy: 11, fr: WHEEL_R }),
    ];
  },
  // the exhausts belch fire, harder on the throttle
  extras: anim => [-1, 1].map(s => ({ kind: 'flame', ox: -18, oy: s * 8.5, oz: 22, power: anim.throttle > 0 ? 1 : 0.3 })),
};
