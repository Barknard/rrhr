import { builder } from '../render/voxel/builder.js';
import { bakeModel } from '../render/voxel/bake.js';
import { shade } from '../render/voxel/color.js';

// Driver portraits: voxel head-and-shoulders busts baked with the HD baker at a three-quarter view.
// Each has two idle frames (a blink, a glowing cigar, a sparking fuse...). +x is the face side.
const SX = 30, SY = 28, SZ = 46;
const CX = 14, CY = 13.5;

function base({ skin, shirt, headR = [7.5, 7, 9], cz = 22, shoulders = true }) {
  const m = builder(SX, SY, SZ), [rx, ry, rz] = headR;
  if (shoulders) for (let x = 6; x <= 22; x++) for (let y = 1; y <= 26; y++) for (let z = 0; z <= 11; z++) {
    const e = ((x - 14) / 8.5) ** 2 + ((y - CY) / 13) ** 2 + ((z - 2) / 10) ** 2;
    if (e <= 1) m.set(x, y, z, typeof shirt === 'function' ? shirt(x, y, z) : shirt);
  }
  m.cyl(CX, CY, 9, cz - 6, 3, shade(skin, 0.85)); // neck
  for (let x = 0; x < SX; x++) for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) {
    if (((x - CX) / rx) ** 2 + ((y - CY) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) m.set(x, y, z, skin);
  }
  // the face surface: the frontmost head voxel at (y, z)
  const front = (y, z) => Math.round(CX + rx * Math.sqrt(Math.max(0, 1 - ((y - CY) / ry) ** 2 - ((z - cz) / rz) ** 2)));
  const face = (y, z, c, mat, out = 0) => m.set(front(y, z) + out, y, z, c, mat);
  const both = (y, z, c, mat, out) => { face(y, z, c, mat, out); face(SY - 1 - y, z, c, mat, out); };
  const eyes = (z, blink, iris = 0x2a1a10, white = 0xf4f0ea) => {
    for (const y of [10, 17]) {
      if (blink) { face(y, z, 0x3a2a24); face(y + (y < CY ? 1 : -1), z, 0x3a2a24); continue; }
      face(y, z, iris); face(y + (y < CY ? 1 : -1), z, white);
    }
  };
  return { m, face, both, eyes, front, cz, rx, ry, rz };
}

function hairCap(b, color, { from = 2, back = true } = {}) {
  const { m, cz, rx, ry, rz } = b;
  for (let x = 0; x < SX; x++) for (let y = 0; y < SY; y++) for (let z = cz + from; z < SZ; z++) {
    const e = ((x - CX) / (rx + 1)) ** 2 + ((y - CY) / (ry + 1)) ** 2 + ((z - cz) / (rz + 1)) ** 2;
    if (e <= 1 && (back || x <= CX + 3)) m.set(x, y, z, color);
  }
  if (back) for (let x = 0; x <= CX - 3; x++) for (let y = 0; y < SY; y++) for (let z = cz - 4; z < cz + from; z++) {
    if (((x - CX) / (rx + 1)) ** 2 + ((y - CY) / (ry + 1)) ** 2 + ((z - cz) / (rz + 1)) ** 2 <= 1) m.set(x, y, z, color);
  }
}

const GOLD = 0xf0c040, BLACK = 0x141016;

// King Cinder, the series boss: a bigger bust than the roster's (it fills the talking-head shot). Cracked
// obsidian over molten rock: the cracks are the borders of fixed Voronoi cells, so they branch like cooling
// cracks. Frames 0/1 pulse the seams, eyes, drips and crown tips; frames 2/3 are the same two pulses with the
// jaw open, for the talking head. Only the voxel rows in KING_JAW change between an idle and a talking frame.
const KX = 40, KY = 38, KZ = 58, KCX = 19, KCY = 18.5, KCZ = 29;
export const KING_JAW = { z0: KCZ - 12, z1: KCZ - 2 };
const OBSIDIAN = [0x241d2c, 0x2e2638, 0x382e44], OBS_HI = 0x5a4a6e, FACE = [0x3e3248, 0x463a52, 0x4e4060], CROWN = 0x1e1828, SOCKET = 0x080508;
const sup = v => Math.abs(v) ** 2.5; // a squarish ellipsoid: blocky, rocky masses
const inShoulders = (x, y, z) => z <= 17 && sup((x - 14) / 10) + sup((y - KCY) / 17.5) + sup((z - 2) / 14) <= 1;
const inHead = (x, y, z) => sup((x - KCX) / 10) + sup((y - KCY) / 11) + (z > KCZ ? ((z - KCZ) / 7.5) ** 2 : sup((z - KCZ) / 10)) <= 1;
const inJaw = (x, y, z) => z <= KCZ - 2 && sup((x - KCX - 2) / 8.5) + sup((y - KCY) / 11) + sup((z - (KCZ - 6)) / 5.5) <= 1;
const kingSolid = (x, y, z) => inShoulders(x, y, z) || inHead(x, y, z) || inJaw(x, y, z);
const KING_SEEDS = (() => { // a small LCG: the cracks are the same on every load
  let s = 7;
  const r = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  return Array.from({ length: 40 }, () => [r() * KX, r() * KY, r() * KZ * 0.7]);
})();
// The static rock, worked out once: voxels as [x, y, z, kind] (kind 0..2 a cell's tone, 3 a highlight fleck,
// 4 heat bleeding from a crack, 5 a glowing crack, 6..8 the lighter face rock) and the frontmost voxel's x at each (y, z).
let kingRock = null;
function kingShape() {
  if (kingRock) return kingRock;
  const front = new Int8Array(KY * KZ).fill(-1), voxels = [];
  for (let y = 0; y < KY; y++) for (let z = 0; z < KZ; z++) for (let x = KX - 1; x >= 0; x--) if (kingSolid(x, y, z)) { front[y * KZ + z] = x; break; }
  for (let x = 0; x < KX; x++) for (let y = 0; y < KY; y++) for (let z = 0; z < KZ; z++) {
    if (!kingSolid(x, y, z)) continue;
    let d1 = 1e9, d2 = 1e9, k = 0;
    KING_SEEDS.forEach(([sx, sy, sz], i) => { const d = Math.hypot(x - sx, y - sy, (z - sz) * 1.2); if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d; });
    const gap = d2 - d1, onFace = x >= front[y * KZ + z] - 2 && Math.abs(y - KCY) <= 8 && z >= KCZ - 9 && z <= KCZ + 4;
    let kind = gap < 0.6 ? 5 : gap < 1.2 ? 4 : (x * 7 + y * 13 + z * 5) % 23 === 0 ? 3 : k % 3;
    if (onFace) kind = kind === 5 ? 4 : 6 + (k % 3); // a lighter face with fainter cracks, so it reads
    voxels.push([x, y, z, kind]);
  }
  return (kingRock = { voxels, front });
}

function kingCinder(frame) {
  const m = builder(KX, KY, KZ), hot = frame & 1, talk = frame >= 2, { voxels, front } = kingShape();
  const SEAM = hot ? 0xffb43a : 0xff6a1a, HEAT = hot ? 0x8a2a12 : 0x561c12, EMBER = hot ? 0xff7a1a : 0xd8400e;
  const f = (y, z) => front[Math.round(y) * KZ + Math.round(z)];
  const face = (y, z, c, mat, out = 0) => { if (f(y, z) >= 0) m.set(f(y, z) + out, y, z, c, mat); };
  const mouth = (y, z) => talk && z >= KCZ - 8 && z <= KCZ - 4 && Math.abs(y - KCY) <= (z === KCZ - 8 || z === KCZ - 4 ? 4 : 5);
  for (const [x, y, z, kind] of voxels) {
    if (mouth(y, z) && x >= f(y, z) - 3) { if (x === f(y, z) - 3) m.set(x, y, z, hot ? 0xffc040 : 0xff8a1a, 'emit'); continue; } // the molten maw
    if (kind === 5) m.set(x, y, z, SEAM, 'emit');
    else m.set(x, y, z, kind >= 6 ? FACE[kind - 6] : kind === 4 ? HEAT : kind === 3 ? OBS_HI : OBSIDIAN[kind]);
  }
  for (let y = KCY - 8.5; y <= KCY + 8.5; y++) { // a heavy brow, dipping in the middle: a permanent scowl
    const z = KCZ + 3 + (Math.abs(y - KCY) > 5 ? 1 : 0) - (Math.abs(y - KCY) < 2 ? 1 : 0);
    face(y, z, OBSIDIAN[2], undefined, 1); face(y, z + 1, OBS_HI, undefined, 1);
  }
  for (const y of [KCY - 4.5, KCY + 4.5]) { // eyes like coals in deep sockets
    for (let dy = -2; dy <= 2; dy++) for (let dz = -1; dz <= 2; dz++) face(y + dy, KCZ + dz, SOCKET);
    for (const dy of [-1, 0, 1]) { face(y + dy, KCZ + 1, dy ? EMBER : hot ? 0xfff2a0 : 0xffd040, 'emit'); face(y + dy, KCZ, dy ? 0xa82a0c : EMBER, 'emit'); }
  }
  for (let y = KCY - 2; y <= KCY + 2; y++) for (let z = KCZ - 2; z <= KCZ; z++) { // broad flat nose, glowing nostrils
    const nostril = z === KCZ - 2 && Math.abs(y - KCY) > 1;
    face(y, z, nostril ? EMBER : OBSIDIAN[1], nostril ? 'emit' : undefined, 1);
  }
  if (talk) for (let y = KCY - 4.5; y <= KCY + 4.5; y++) { // jagged obsidian fangs, top and bottom
    if (Math.round(y) % 2) m.set(f(y, KCZ - 4) - 1, y, KCZ - 4, OBS_HI);
    else m.set(f(y, KCZ - 8) - 1, y, KCZ - 8, OBS_HI);
  } else for (let y = KCY - 5; y <= KCY + 5; y++) { // the shut mouth: a snarl of glowing crack
    face(y, KCZ - 6 + (Math.round(y) % 3 === 0 ? 1 : 0), SEAM, 'emit');
    face(y, KCZ - 7, OBS_HI);
  }
  for (const [y, z, len] of [[11, KCZ - 2, 4], [26, KCZ - 1, 5], [8, 12, 5], [29, 11, 4], [14, 10, 6], [24, 8, 5]]) { // lava drips
    const n = len + hot;
    for (let i = 0; i < n; i++) face(y, z - i, i === n - 1 ? 0xffe070 : SEAM, 'emit', 1);
  }
  for (const y of [6, KY - 7]) for (let t = 0; t <= 6; t++) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { // shoulder spikes
    if (Math.abs(dx) + Math.abs(dy) > 2 - t * 0.35) continue;
    m.set(16 + dx, y + dy + (y < KCY ? -t * 0.5 : t * 0.5), 10 + t, t === 6 ? EMBER : dx > 0 ? OBS_HI : CROWN, t === 6 ? 'emit' : undefined);
  }
  for (let x = 0; x < KX; x++) for (let y = 0; y < KY; y++) for (let z = KCZ + 3; z <= KCZ + 5; z++) { // the crown band
    if (inHead(x, y, z)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inHead(x + a, y + b, z))) m.set(x, y, z, z === KCZ + 4 ? 0x3a2e4a : CROWN);
  }
  for (let i = 0; i < 9; i++) { // nine obsidian spikes, the tallest over the brow; alternate tips glow in turn
    const a = (i / 9) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), H = 6 + Math.round(3 * (ca + 1)) + (i % 2) * 2;
    for (let t = 0; t <= H; t++) {
      const r = 1.1 * (1 - t / H) + 0.35, bx = KCX + ca * (8 + t * 0.15), by = KCY + sa * (8.4 + t * 0.15), z = KCZ + 5 + t;
      for (let x = Math.floor(bx - r); x <= Math.ceil(bx + r); x++) for (let y = Math.floor(by - r); y <= Math.ceil(by + r); y++) {
        if (Math.hypot(x - bx, y - by) > r + 0.2) continue;
        const tip = t >= H - 1 && (i + hot) % 2 === 0;
        m.set(x, y, z, tip ? SEAM : (x - bx) * 0.8 + (y - by) * -0.4 > 0.3 ? OBS_HI : CROWN, tip ? 'emit' : undefined);
      }
    }
  }
  for (const [y, z0] of [[5, 14], [KY - 6, 15]]) for (let i = 0; i < 3; i++) { // steam puffs rising off the shoulders
    const z = z0 + i * 3 + hot * 2, x = 11 + ((i + hot) % 2), c = [0xc8c0d0, 0xa8a0b4, 0x8a8496][i];
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]) m.set(x + dx, y + dy, z + dz, c);
  }
  return m.done();
}

export const PORTRAITS = {
  vinnie(frame) {
    const b = base({ skin: 0xd59a6a, shirt: 0xf2f2f0, headR: [8, 8, 9] });
    const { m, face, both, eyes, front, cz } = b;
    for (let y = 1; y <= 26; y++) for (let z = 7; z <= 10; z++) if (y < 6 || y > 21) for (let x = 8; x <= 20; x++) m.set(x, y, z, 0xd59a6a); // bare shoulders
    hairCap(b, 0x1a1414, { from: 3 });
    eyes(cz + 1, false);
    for (let y = 8; y <= 19; y++) face(y, cz + 3, BLACK); // one heavy brow
    for (let y = 11; y <= 16; y++) face(y, cz - 4, 0x8a3a2a);
    face(13, cz - 1, shade(0xd59a6a, 0.8), undefined, 1); face(14, cz - 1, shade(0xd59a6a, 0.8), undefined, 1);
    for (let a = 0; a < 20; a++) { const y = CY + Math.cos(a / 20 * Math.PI * 2) * 6, x = CX + 2 + Math.sin(a / 20 * Math.PI * 2) * 4; m.set(x, y, 11, GOLD, 'chrome'); }
    const fx = front(17, cz - 4);
    for (let i = 1; i <= 5; i++) m.set(fx + i, 17, cz - 4, 0x7a4a22);
    m.set(fx + 6, 17, cz - 4, frame ? 0xffd27a : 0xff5a1a, 'emit');
    both(9, cz - 1, shade(0xd59a6a, 0.9));
    return m.done();
  },
  dolly(frame) {
    const b = base({ skin: 0xf4cfb4, shirt: (x, y, z) => ((y + z) % 5 === 0 && (x + y) % 3 === 0 ? 0xffffff : 0xc8202a) }); // polka dots
    const { m, face, eyes, cz } = b;
    hairCap(b, 0xff6fae, { from: 1 });
    for (let z = cz + 6; z < 41; z++) m.cyl(CX - 1, CY, z, z, 6.5 - (z - cz - 6) * 0.25, 0xff6fae); // the beehive
    for (let z = 41; z <= 43; z++) m.set(CX - 1, CY, z, 0x3a2a1a);
    m.set(CX - 1, CY, 44, frame ? 0xffe14a : 0xff6a1a, 'emit'); m.set(CX, CY, 45, frame ? 0xff6a1a : 0xffffff, 'emit');
    eyes(cz + 1, frame === 1, 0x2a6a9a);
    for (const y of [9, 18]) face(y, cz + 2, BLACK); // lashes
    for (let y = 11; y <= 16; y++) face(y, cz - 4, 0xd0203a, undefined, 1);
    face(12, cz - 5, 0xd0203a); face(15, cz - 5, 0xd0203a);
    return m.done();
  },
  professor(frame) {
    const b = base({ skin: 0xf0d0b8, shirt: 0xe8e8e8 });
    const { m, face, eyes, cz } = b;
    for (let z = 0; z <= 11; z++) m.box(20, 12, z, 22, 15, z, z > 7 ? 0xffffff : 0xc02020); // collar and tie
    for (const [x, y, z] of [[18, 4, 6], [10, 22, 3], [16, 24, 8]]) m.box(x, y, z, x + 1, y + 1, z + 1, 0x3a2a24); // burn marks
    for (let i = 0; i < 70; i++) { // wild white hair, sides and back
      const a = (i / 70) * Math.PI * 2, el = ((i * 37) % 11) / 11;
      for (let r = 6; r <= 10 + (i % 3); r++) {
        const x = CX - 1 + Math.cos(a) * r * 0.9, y = CY + Math.sin(a) * r, z = cz + 1 + el * 8 + (r - 6) * 0.5;
        if (x < CX + 4) m.set(x, y, z, 0xf4f4f4);
      }
    }
    eyes(cz + 1, false, 0x2a4a7a);
    for (const y of [10, 17]) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      const r = Math.hypot(dy, dz);
      if (r > 2.6) continue;
      face(y + dy, cz + 1 + dz, r > 1.6 ? 0x9aa0ad : frame ? 0xbfefff : 0x6fd0ff, r > 1.6 ? 'chrome' : 'glass', 1);
    }
    for (let y = 11; y <= 16; y++) face(y, cz - 5, 0x8a4a3a);
    return m.done();
  },
  mama(frame) {
    const b = base({ skin: 0xe8b090, shirt: 0x1e1b24 });
    const { m, face, cz } = b;
    for (let z = 0; z <= 11; z++) m.set(21, CY, z, 0xc9cfd9, 'chrome'); // zipper
    hairCap(b, 0xb8b8c0, { from: 1 });
    for (const y of [8, 12, 16, 20]) for (const x of [10, 14, 18]) m.box(x, y - 1, cz + 8, x + 1, y + 1, cz + 9, 0xff8ac8); // curlers
    for (let y = 8; y <= 19; y++) face(y, cz + 1, BLACK, 'glass', 1); // big sunglasses
    face(9, cz + 2, frame ? 0xffffff : BLACK, frame ? 'emit' : 'glass', 1);
    for (const z of [cz - 2, cz + 4]) for (const y of [7, 20]) face(y, z, shade(0xe8b090, 0.75)); // wrinkles
    for (let y = 11; y <= 16; y++) face(y, cz - 4, 0xa04a4a);
    return m.done();
  },
  juice(frame) {
    const b = base({ skin: 0x7a4a2a, shirt: 0xd02828 });
    const { m, face, cz } = b;
    for (let z = 0; z <= 11; z++) for (const y of [4, 23]) for (let x = 8; x <= 20; x++) m.set(x, y, z, 0xffffff); // stripes
    hairCap(b, 0x141010, { from: 4 });
    for (let y = 7; y <= 20; y++) face(y, cz + 1, y === 7 || y === 20 ? GOLD : BLACK, y === 7 || y === 20 ? 'chrome' : 'glass', 1);
    for (let y = 11; y <= 16; y++) face(y, cz - 4, y % 2 ? 0xffd700 : 0xffe880, frame && y === 13 ? 'emit' : 'chrome');
    face(13, cz - 1, shade(0x7a4a2a, 0.8), undefined, 1);
    return m.done();
  },
  voltage(frame) {
    const b = base({ skin: 0xf0c8b0, shirt: 0x18161e });
    const { m, face, eyes, cz } = b;
    for (const [y, z] of [[5, 3], [6, 4], [5, 5], [6, 6], [22, 3], [21, 4], [22, 5], [21, 6]]) m.set(16, y, z, 0xffe14a, 'emit');
    hairCap(b, 0x2a6aff, { from: 3 });
    for (let i = 0; i < 9; i++) { // spikes
      const y = 6 + i * 2, x = CX - 2 + (i % 3);
      for (let z = cz + 9; z <= cz + 15 + (i % 2) * 3; z++) m.set(x, y, z, 0x2a6aff);
      m.set(x, y, cz + 16 + (i % 2) * 3, (i + frame) % 2 ? 0x7ff8ff : 0xffffff, 'emit');
    }
    eyes(cz + 1, frame === 1, 0x6a2aff);
    for (let y = 11; y <= 16; y++) face(y, cz - 4, 0x5a2a6a);
    m.set(CX, 5, cz - 2, 0xffe14a, 'emit'); m.set(CX, 22, cz - 2, 0xffe14a, 'emit'); // lightning earrings
    return m.done();
  },
  count(frame) {
    const b = base({ skin: 0xc8d0c0, shirt: 0x101014 });
    const { m, face, cz } = b;
    for (let z = 10; z <= cz + 2; z++) for (let y = 0; y < SY; y++) for (let x = 2; x <= CX - 3; x++) { // tall cape collar
      if (Math.abs(y - CY) > 6 + (z - 10) * 0.2) m.set(x, y, z, z % 2 ? 0x101014 : 0x18141c);
    }
    for (let z = 6; z <= 11; z++) m.box(20, 10, z, 21, 17, z, 0x8a1020);
    hairCap(b, 0x101014, { from: 3 });
    m.cyl(CX, CY, cz + 7, cz + 7, 9.5, 0x101014);           // brim
    for (let z = cz + 8; z <= cz + 19; z++) m.cyl(CX, CY, z, z, 6, z === cz + 9 ? 0x8a1020 : 0x101014); // top hat
    for (const y of [10, 17]) face(y, cz + 1, frame ? 0x5a2020 : 0xff2020, frame ? undefined : 'emit');
    for (let y = 11; y <= 16; y++) face(y, cz - 4, 0x4a1018);
    face(12, cz - 5, 0xffffff, undefined, 1); face(15, cz - 5, 0xffffff, undefined, 1); // fangs
    return m.done();
  },
  sprocket(frame) {
    const b = base({ skin: 0x6fae3a, shirt: 0xff8a1e, headR: [7, 6.5, 7.5], cz: 21 });
    const { m, face, cz } = b;
    for (let z = 0; z <= 11; z++) for (const y of [8, 19]) m.set(21, y, z, 0xc9cfd9, 'chrome'); // overall buttons
    for (let i = 0; i <= 9; i++) for (let k = 0; k <= 9 - i; k++) { // big pointy ears
      m.set(CX - 1 + (k >> 2), 6 - i * 0.6, cz + k - 2 + i * 0.8, 0x5f9a32);
      m.set(CX - 1 + (k >> 2), SY - 7 + i * 0.6, cz + k - 2 + i * 0.8, 0x5f9a32);
    }
    for (let y = 8; y <= 19; y++) face(y, cz + 5, 0x3a3030);
    for (const y of [10, 17]) m.box(CX + 2, y - 1, cz + 5, CX + 3, y + 1, cz + 6, 0xff8a1e, 'glass'); // goggles up top
    for (const y of [10, 17]) {
      face(y, cz + 1, frame ? 0x3f6a22 : 0xffe14a); face(y, cz + 2, frame ? 0x3f6a22 : 0xffe14a);
      if (!frame) face(y, cz + 1, BLACK, undefined, 1);
    }
    for (let y = 10; y <= 17; y++) face(y, cz - 3, y % 2 ? 0xffffff : 0x2a1a10); // toothy grin
    for (let i = 0; i <= 30; i++) m.set(11 + i * 0.12, 22 + i * 0.12, 4 + i, 0xc9cfd9, 'chrome'); // the giant wrench
    m.box(14, 24, 33, 17, 27, 36, 0xc9cfd9, 'chrome'); m.box(15, 25, 34, 16, 27, 35, 0x101014);
    return m.done();
  },
};
// The series boss (see src/series/bosses.js); frames 2 and 3 talk. Not enumerable: PORTRAITS' keys stay the
// roster's (DRIVER_KEYS), while PORTRAITS.kingCinder and bakePortrait('kingCinder', f) still work.
Object.defineProperty(PORTRAITS, 'kingCinder', { value: kingCinder, enumerable: false });

const PORTRAIT_HEADINGS = 16, PORTRAIT_FRAME = 1; // face turned 22.5 degrees off the camera: a three-quarter view
const cache = new Map();
export function bakePortrait(key, frame = 0) {
  const id = `${key}:${frame}`;
  if (!cache.has(id)) cache.set(id, bakeModel(PORTRAITS[key](frame), PORTRAIT_HEADINGS)[PORTRAIT_FRAME]);
  return cache.get(id);
}
