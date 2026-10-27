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

const PORTRAIT_HEADINGS = 16, PORTRAIT_FRAME = 1; // face turned 22.5 degrees off the camera: a three-quarter view
const cache = new Map();
export function bakePortrait(key, frame = 0) {
  const id = `${key}:${frame}`;
  if (!cache.has(id)) cache.set(id, bakeModel(PORTRAITS[key](frame), PORTRAIT_HEADINGS)[PORTRAIT_FRAME]);
  return cache.get(id);
}
