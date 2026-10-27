import { builder, transform } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { tyre, rod, ball, bodyOffset, wheelVariant, steerAngle, aimOffset } from './parts.js';

// Hog & Hitch: a chopper with a sidecar. The bike leans into corners while the sidecar stays flat,
// and the gunner in the sidecar swivels his gun toward the nearest rival.
const ORG = 0xff8a1e, ORG_L = 0xffc070, ORG_D = 0xa04a08, BLK = 0x16141c, LEATHER = 0x2a2226, CHROME = 0xd2d8e2,
  SKIN = 0xd99a6c, VISOR = 0x29e3ff, FLAME = 0xffe14a, RED = 0xe0442a, HEAD = 0xfff2b8, TAIL = 0xff2440, DSTEEL = 0x454a57;
const LEAN_STEPS = 7, LEAN_MAX = 0.45;

function bike(v) {
  const m = builder(36, 7, 24);
  const y = 3;
  rod(m, [8, y, 8], [24, y, 11], 1, DSTEEL);                 // backbone
  rod(m, [24, y, 11], [32, y, 4], 0.6, CHROME, 'chrome');   // raked forks
  rod(m, [24, y, 12], [22, y, 17], 0.6, CHROME, 'chrome');  // ape-hanger bars
  m.box(21, 0, 17, 23, 6, 17, CHROME, 'chrome');
  for (let x = 15; x <= 23; x++) for (let yy = 1; yy <= 5; yy++) { // teardrop tank with flames
    const h = Math.round(2.5 * Math.sin((Math.PI * (x - 14)) / 10));
    for (let z = 11; z <= 11 + h; z++) m.set(x, yy, z, z === 11 + h ? ((x + yy) % 4 === 0 ? FLAME : ORG_L) : x < 18 && z > 11 ? RED : ORG);
  }
  for (let x = 12; x <= 18; x++) for (const yy of [1, 5]) for (let z = 4; z <= 9; z++) if ((x + z) % 3) m.set(x, yy, z, CHROME, 'chrome'); // V-twin
  rod(m, [12, 1, 5], [2, 1, 6], 0.6, CHROME, 'chrome');      // fishtail pipe
  m.box(4, 1, 9, 12, 5, 10, LEATHER);                        // seat
  m.box(1, 2, 9, 4, 4, 11, ORG); m.set(1, 3, 10, TAIL, 'emit'); // rear fender + tail light
  // the rider: boots, legs, torso leaning on the bars, helmet with visor
  rod(m, [9, y, 11], [14, y, 18], 1.4, LEATHER);
  rod(m, [14, y, 18], [21, y, 17], 0.6, LEATHER);
  rod(m, [8, y, 10], [15, y, 6], 1, LEATHER);
  ball(m, 15, y, 21, 2.4, ORG); for (let yy = 1; yy <= 5; yy++) m.set(17, yy, 21, VISOR, 'glass');
  m.set(32, y, 7, HEAD, 'emit');
  return transform(m.done(), { roll: (v - (LEAN_STEPS - 1) / 2) * ((2 * LEAN_MAX) / (LEAN_STEPS - 1)), pivot: [17.5, 3, 0] });
}

function sidecar() {
  const m = builder(24, 11, 12);
  for (let x = 1; x <= 22; x++) {
    const k = (x - 1) / 21, half = Math.max(1, Math.round(4.8 * Math.sin(Math.PI * Math.min(1, 0.12 + k))));
    for (let y = 5 - half; y <= 5 + half; y++) {
      const top = Math.abs(y - 5) === half;
      m.box(x, y, 3, x, y, 8, top ? ORG_D : ORG);
      if (x > 6 && x < 16 && Math.abs(y - 5) < half - 1) m.set(x, y, 8, LEATHER); // open cockpit
      else m.set(x, y, 9, top ? ORG : ORG_L);
    }
  }
  rod(m, [4, 0, 6], [16, 0, 6], 0.6, CHROME, 'chrome'); // bumper rail
  m.box(20, 4, 9, 22, 6, 9, CHROME, 'chrome');           // nose cone tip
  rod(m, [12, 10, 4], [12, 10, 1], 0.6, DSTEEL);          // wheel strut
  return m.done();
}

// The gunner and a pintle machine gun, pointing along +x (turned by the pose toward the aim).
function gunner() {
  const m = builder(22, 8, 14);
  rod(m, [9, 4, 2], [9, 4, 7], 1.4, LEATHER);   // torso
  ball(m, 9, 4, 9.5, 2, ORG);                    // helmet
  m.box(10, 2, 9, 11, 6, 9, VISOR, 'glass');
  rod(m, [9, 4, 6], [20, 4, 6], 0.6, BLK);       // barrel
  m.box(12, 3, 5, 15, 5, 7, DSTEEL);             // receiver
  rod(m, [11, 2, 5], [11, 2, 3], 0.6, SKIN); rod(m, [11, 6, 5], [11, 6, 3], 0.6, SKIN); // hands
  m.box(5, 3, 0, 7, 5, 2, CHROME, 'chrome');     // swivel post
  return m.done();
}

export const hogHitch = {
  key: 'hogHitch',
  sets: { bike: partSet(bike, LEAN_STEPS), sidecar: partSet(sidecar), gunner: partSet(gunner),
    front: tyre(5, 2), rear: tyre(5.5, 3), car: tyre(4, 2) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.8, lean: 0.3 });
    const into = Math.max(-1, Math.min(1, -anim.lean / 0.06)); // leaning into the turn: toward the inside
    const lean = Math.round((LEAN_STEPS - 1) / 2 - into * ((LEAN_STEPS - 1) / 2));
    const fv = wheelVariant(anim, 5, t), rv = wheelVariant(anim, 5.5, t), cv = wheelVariant(anim, 4, t);
    return [
      { set: 'bike', variant: lean, ox: b.ox, oy: -5, oz: Math.max(0, b.oz) },
      { set: 'front', variant: fv, ox: 14, oy: -5, dh: steerAngle(anim) },
      { set: 'rear', variant: rv, ox: -12, oy: -5 },
      { set: 'sidecar', ox: b.ox + 1, oy: 7 + b.oy, oz: b.oz },
      { set: 'car', variant: cv, ox: 2, oy: 11 },
      { set: 'gunner', ox: b.ox + 1, oy: 7 + b.oy, oz: b.oz + 7, dh: aimOffset(anim, car) },
    ];
  },
};
