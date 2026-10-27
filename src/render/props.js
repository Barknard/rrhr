import { builder } from './voxel/builder.js';
import { rod, ball } from '../cars/rigs/parts.js';

// Voxel models for the scenery and the things on the track: smokestacks, beacon towers, mystery crates,
// gravity mines and the flying buzzsaw. Baked with the same HD baker as the vehicles.
const RUST = 0x8a4a2a, RUST_D = 0x5a2e1a, RUST_L = 0xb06a3a, BLK = 0x16141c, STEEL = 0x7d8494, YEL = 0xf0bd2a, RED = 0xff3030,
  WOOD = 0xa7790e, WOOD_D = 0x6a4a08, GOLD = 0xffd84a, PURP = 0x6b2bb8, PURP_L = 0xb14dff, CHROME = 0xd2d8e2;

export const STACK_TOP = 74; // px above the ground where the smoke comes out
export function stackModel() {
  const m = builder(17, 17, 76);
  for (let z = 0; z < 74; z++) {
    const r = z < 6 ? 7.5 : 6 - z * 0.012;
    for (let x = 0; x < 17; x++) for (let y = 0; y < 17; y++) {
      const d = Math.hypot(x - 8, y - 8);
      if (d > r || (z > 68 && d < r - 1.5)) continue; // hollow mouth at the top
      let c = (x * 3 + y * 5 + z) % 7 === 0 ? RUST_D : (x + y) % 4 === 0 ? RUST_L : RUST;
      if (z % 14 === 0 || z === 73) c = STEEL;                 // steel bands
      if (z > 54 && z < 60) c = ((z + Math.round(Math.atan2(y - 8, x - 8) * 4)) >> 1) & 1 ? YEL : BLK; // hazard band
      if (z % 14 === 3 && (x + y) % 3 === 0) c = CHROME;      // rivets
      m.set(x, y, z, c, c === CHROME ? 'chrome' : undefined);
    }
  }
  return m.done();
}

export const BEACON_TOP = 58;
export function beaconModel() {
  const m = builder(13, 13, 62);
  for (const [x, y] of [[1, 1], [11, 1], [1, 11], [11, 11]]) rod(m, [x, y, 0], [6 + (x - 6) * 0.3, 6 + (y - 6) * 0.3, 56], 0.6, STEEL);
  for (let z = 6; z < 56; z += 10) for (let i = 0; i < 4; i++) { // lattice cross-bracing
    const k = 1 - (z / 56) * 0.7, a = 6 - 5 * k, b = 6 + 5 * k;
    const c = [[a, a], [b, a], [b, b], [a, b]];
    rod(m, [...c[i], z], [...c[(i + 1) % 4], z + 8], 0.4, BLK);
  }
  m.box(4, 4, 56, 8, 8, 57, BLK);
  ball(m, 6, 6, 59, 1.6, 0x5a1010);
  return m.done();
}

export function crateModel() {
  const m = builder(12, 12, 12);
  for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) for (let z = 0; z < 12; z++) {
    const edges = [x === 0 || x === 11, y === 0 || y === 11, z === 0 || z === 11].filter(Boolean).length;
    if (!edges) continue;
    m.set(x, y, z, edges >= 2 ? GOLD : (x + y + z) % 4 === 0 ? WOOD_D : WOOD);
  }
  // a question mark on every side face
  const Q = ['0110', '1001', '0010', '0100', '0000', '0100'];
  Q.forEach((row, r) => [...row].forEach((b, c) => {
    if (b !== '1') return;
    const z = 9 - r, u = 4 + c;
    m.set(u, 0, z, BLK); m.set(u, 11, z, BLK); m.set(0, u, z, BLK); m.set(11, u, z, BLK);
  }));
  return m.done();
}

export function mineModel() {
  const m = builder(9, 9, 5);
  ball(m, 4, 4, 1.5, 3.4, 0x2a2830);
  for (let a = 0; a < 6; a++) rod(m, [4, 4, 2], [4 + Math.cos(a) * 4.2, 4 + Math.sin(a) * 4.2, 2], 0.3, STEEL); // spikes
  m.set(4, 4, 4, RED, 'emit');
  m.set(3, 4, 3, PURP_L, 'emit'); m.set(5, 4, 3, PURP, 'emit');
  return m.done();
}

// A buzzsaw lying flat as it flies; spinning is done by stepping through the heading frames.
export function flatSawModel() {
  const m = builder(13, 13, 2);
  for (let x = 0; x < 13; x++) for (let y = 0; y < 13; y++) {
    const d = Math.hypot(x - 6, y - 6), a = (Math.atan2(y - 6, x - 6) / (2 * Math.PI)) * 10;
    if (d < 1.2) m.box(x, y, 0, x, y, 1, BLK);
    else if (d < 4.6) m.box(x, y, 0, x, y, 1, d > 3.4 ? CHROME : 0xa8aeb8, 'chrome');
    else if (d < 6.3 && ((a % 1) + 1) % 1 < 0.55 - (d - 4.6) * 0.25) m.box(x, y, 0, x, y, 1, 0xeef2f8, 'chrome');
  }
  return m.done();
}
