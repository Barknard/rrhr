import { builder } from '../../render/voxel/builder.js';
import { partSet } from './rig.js';
import { rod, ball, bodyOffset, aimOffset } from './parts.js';
import { hash } from '../../core/iso.js';

// Gravedigger: a mini tank. Its tracks scroll (in opposite directions when it pivots on the spot) and
// the turret swings toward the nearest rival.
const OLV = 0x6f8a3a, OLV_L = 0x9ab35a, OLV_D = 0x3e4f1e, CAMO = 0x4a3a22, BLK = 0x16141c, TREAD = 0x2e2c32, TREAD_L = 0x4a4752,
  STEEL = 0x7d8494, CHROME = 0xc9cfd9, BONE = 0xeee6d0, HEAD = 0xfff2b8;
const TRACK_PHASES = 4;

function hull() {
  const m = builder(36, 22, 12);
  for (let x = 1; x <= 34; x++) for (let y = 2; y <= 19; y++) {
    const glacis = x > 27 ? Math.round((x - 27) * 0.7) : 0, top = 9 - glacis;
    const camo = hash(x >> 2, y >> 2, 4) < 0.3;
    m.box(x, y, 3, x, y, top, camo ? CAMO : OLV);
    m.set(x, y, top, y === 2 || y === 19 ? OLV_D : camo ? CAMO : OLV_L);
  }
  for (const y of [3, 18]) for (let x = 4; x <= 24; x += 5) m.box(x, y, 10, x + 3, y, 10, STEEL); // tool boxes on the fenders
  for (let x = 2; x <= 5; x++) for (let y = 7; y <= 14; y += 2) m.set(x, y, 10, BLK); // exhaust grille
  for (const y of [5, 16]) m.set(34, y, 6, HEAD, 'emit');
  for (const y of [4, 17]) rod(m, [35, y, 4], [35, y, 5], 0.4, STEEL); // tow hooks
  return m.done();
}

// A track run: tread links scroll by phase around a loop with five road wheels showing on the outside.
function track(v) {
  const m = builder(38, 5, 10);
  const R = 4, x0 = 4, x1 = 33, cz = 4.5;
  for (let x = 0; x < 38; x++) for (let z = 0; z < 10; z++) {
    const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, d = dx ? Math.hypot(dx, z - cz) : Math.abs(z - cz);
    if (dx ? d > R + 0.5 : Math.abs(z - cz) > R + 0.5) continue;
    const outer = dx ? d > R - 0.7 : Math.abs(z - cz) > R - 0.7;
    for (let y = 0; y < 5; y++) {
      if (outer) {
        const link = (z < cz ? x : 40 - x) + (z < cz ? -v : v) * 1; // the bottom run moves back, the top forward
        m.set(x, y, z, ((link >> 1) & 1) ? TREAD : TREAD_L);
      } else if (y === 0 || y === 4) {
        const wx = Math.round((x - x0) / 7.25) * 7.25 + x0;
        const r = Math.hypot(x - wx, z - cz);
        m.set(x, y, z, r < 1 ? CHROME : r < 3 ? STEEL : BLK, r < 1 ? 'chrome' : undefined);
      } else m.set(x, y, z, BLK);
    }
  }
  return m.done();
}

function turret() {
  const m = builder(36, 16, 10);
  for (let x = 4; x <= 18; x++) for (let y = 1; y <= 14; y++) {
    const r = Math.hypot((x - 11) / 7.5, (y - 7.5) / 7);
    if (r > 1) continue;
    const h = Math.round(5 * Math.sqrt(1 - r * r));
    m.box(x, y, 0, x, y, h, OLV);
    m.set(x, y, h, r > 0.8 ? OLV_D : hash(x >> 2, y >> 2, 9) < 0.3 ? CAMO : OLV_L);
  }
  m.box(17, 6, 1, 20, 9, 4, OLV_D);                        // mantlet
  rod(m, [20, 7.5, 2.5], [34, 7.5, 2.5], 1, STEEL);        // barrel
  m.box(33, 6, 1, 35, 9, 4, BLK);                          // muzzle brake
  ball(m, 9, 9, 5, 1.6, OLV_D);                            // hatch
  for (const [dx, dz] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) m.set(8 + dx, 4, 3 + dz, BONE); // skull-and-bones decal
  rod(m, [6, 3, 4], [6, 3, 9], 0.4, BLK);                  // antenna
  return m.done();
}

export const gravedigger = {
  key: 'gravedigger',
  sets: { hull: partSet(hull), track: partSet(track, TRACK_PHASES), turret: partSet(turret) },
  pose(anim, car, t) {
    const b = bodyOffset(anim, { travel: 0.3, lean: 0.4 });
    const spin = (Number.isFinite(car.heading) ? car.heading : 0) * 12; // turning drives the two tracks apart (12 voxels from centre)
    const ph = r => ((Math.floor(r / 1.5) % TRACK_PHASES) + TRACK_PHASES) % TRACK_PHASES;
    return [
      { set: 'hull', ox: b.ox, oy: b.oy, oz: b.oz + 1 },
      { set: 'track', variant: ph(anim.roll - spin), ox: 0, oy: -12 },
      { set: 'track', variant: ph(anim.roll + spin), ox: 0, oy: 12 },
      { set: 'turret', ox: b.ox + 6, oy: b.oy, oz: b.oz + 11, dh: aimOffset(anim, car) },
    ];
  },
};
