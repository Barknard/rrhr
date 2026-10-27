import { shade, abgr } from '../render/voxel/color.js';

// The landing page's pin-up: an anime-styled biker-club gal in a polka-dot bikini, an open leather vest and
// knee-high boots, painted
// pixel by pixel (shaded ellipses and limbs, light from the upper left, a dark outline). Her loop: she bounces on
// her toes (hair and top trailing every hop, with a bit of squash and stretch), reaches for the knot, fiddles with
// it like she's about to... then yanks it tight and wags a finger at you. The bikini top never comes open;
// tests/pinup.test.js checks every frame for that.
const W = 96, H = 144, Y0 = 8; // Y0: headroom for the hop
export const PINUP_GROUND = 138; // the row her boot soles stand on, for the shadow

const C = {
  skin: 0xf6c09c, hair: 0x2a1c34, hairHi: 0x7a5aa0, scarf: 0xd81e2c, dot: 0xf6e6dc, vest: 0x2c2630,
  vestHi: 0x6a6070, patch: 0xffa21e, patchDk: 0x8a1e0c, belt: 0x3a2418,
  steel: 0xd8dce4, boot: 0x221c24, glove: 0x2e262e, lips: 0xd0203a, mouth: 0x7a0a18, white: 0xfaf6f0,
  irisDk: 0x1e4a6a, iris: 0x2e8ac0, irisLt: 0x8ad8f0, lash: 0x140a10, gold: 0xffd84a, blush: 0xf0908a,
  shades: 0x101018, glint: 0x9ad8ff,
};
const TONES = [0.62, 0.8, 0.95, 1.1];
const OUTLINE = 0x140810;

// The poses. Arms are [shoulder, elbow, hand] per side, in sprite pixels before the bounce. body: upper-body
// offset; feet: boot offset; bust and hair: how far they trail the body (down +), so they swing past it on
// every change of direction.
const L_HIP = [[33, 41], [22, 56], [35, 70]], R_HIP = [[63, 41], [74, 56], [61, 70]];
const bob = (body, feet, bust, hair, face = 'smile') => ({ pose: 'bob', body, feet, bust, hair, arms: [L_HIP, R_HIP], face });
const FRAMES = [
  bob(2, 0, 3, 1),          // landing crouch: everything keeps going down
  bob(0, 0, 2, 2),          // pushing up: the top and hair lag behind
  bob(-3, 0, 1, 1),         // rising
  bob(-6, -5, -3, -1, 'grin'), // the top of the hop: they fly on up
  bob(-4, -3, -2, -2, 'grin'), // falling: they float a moment
  bob(0, 0, 1, 0),          // touchdown
  { pose: 'reach', bust: 1, arms: [[[33, 41], [30, 60], [44, 48]], [[63, 41], [66, 60], [52, 48]]], face: 'smirk', knot: 'tied' },
  { pose: 'knot', arms: [[[33, 41], [32, 59], [46, 45]], [[63, 41], [64, 59], [50, 45]]], face: 'glance', knot: 'tied' },
  { pose: 'tease', bust: 1, arms: [[[33, 41], [31, 58], [43, 45]], [[63, 41], [65, 58], [53, 45]]], face: 'oh', knot: 'loose' },
  { pose: 'snap', bust: -3, hair: -1, arms: [[[33, 41], [33, 56], [45, 41]], [[63, 41], [63, 56], [51, 41]]], face: 'grin', knot: 'flick' },
  { pose: 'wag', bust: 2, arms: [L_HIP, [[63, 41], [73, 47], [67, 29]]], face: 'wink', finger: 0 },
  { pose: 'wag', bust: -1, arms: [L_HIP, [[63, 41], [74, 47], [70, 30]]], face: 'wink', finger: 1 },
];
export const PINUP_FRAMES = FRAMES.length;

// The loop, in seconds: a run of bounces, the reach, a fidgety tease, the snap, a finger wag.
const SCRIPT = [
  [2.5, t => Math.floor(t * 12) % 6],
  [0.3, () => 6],
  [0.9, t => (t < 0.35 ? 7 : Math.floor(t * 8) % 2 ? 8 : 7)],
  [0.25, () => 9],
  [1.0, t => 10 + (Math.floor(t * 6) % 2)],
];
export const PINUP_LOOP = SCRIPT.reduce((s, [d]) => s + d, 0);
export function pinupFrame(t) {
  let u = ((t % PINUP_LOOP) + PINUP_LOOP) % PINUP_LOOP;
  for (const [d, f] of SCRIPT) { if (u < d) return f(u); u -= d; }
  return 0;
}

function painter() {
  const col = new Int32Array(W * H).fill(-1);
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) col[y * W + x] = c; };
  // tone from a fake surface normal (nx, ny in -1..1); edge pixels a step darker so overlaps read
  const lit = (c, nx, ny, edge) => shade(c, TONES[Math.max(0, Math.min(3, Math.round(1.9 - nx * 1.3 - ny * 1.0 - (edge ? 1 : 0))))]);
  const ellipse = (cx, cy, rx, ry, c, { flat = false, pattern = null } = {}) => {
    const inner = ((Math.min(rx, ry) - 1) / Math.min(rx, ry)) ** 2;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, e = dx * dx + dy * dy;
      if (e > 1) continue;
      const base = pattern ? pattern(x, y) ?? c : c;
      put(x, y, flat ? base : lit(base, dx, dy, e > inner));
    }
  };
  const limb = ([ax, ay], [bx, by], ra, rb, c) => {
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1, r = Math.max(ra, rb);
    for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.ceil(Math.max(ay, by) + r); y++) for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.ceil(Math.max(ax, bx) + r); x++) {
      const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
      const qx = ax + vx * t, qy = ay + vy * t, rr = ra + (rb - ra) * t, d = Math.hypot(px - qx, py - qy);
      if (d <= rr) put(x, y, lit(c, (px - qx) / rr, (py - qy) / rr - 0.2, d > rr - 1));
    }
  };
  // rows of a shape: halfWidth(y) around cx, shaded across its width
  const rows = (cx, y0, y1, halfWidth, c, pattern) => {
    for (let y = y0; y <= y1; y++) {
      const hw = halfWidth(y);
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
        const nx = (x + 0.5 - cx) / hw;
        put(x, y, lit(pattern ? pattern(x, y) ?? c : c, nx, -0.1, Math.abs(nx) > 1 - 1.2 / hw));
      }
    }
  };
  const outline = () => {
    const filled = i => col[i] >= 0;
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!filled(i) && ((x > 0 && filled(i - 1)) || (x < W - 1 && filled(i + 1)) || (y > 0 && filled(i - W)) || (y < H - 1 && filled(i + W)))) add.push(i);
    }
    for (const i of add) col[i] = OUTLINE;
  };
  return { col, put, ellipse, limb, rows, outline };
}

const lerpTable = table => y => {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (y <= table[i][0]) {
    const [y0, a] = table[i - 1], [y1, b] = table[i];
    return a + (b - a) * (y - y0) / (y1 - y0);
  }
  return table[table.length - 1][1];
};

// Big anime eyes (4 wide, 4 tall, a highlight in each), thin brows, a dot of a nose, a small mouth.
function face(p, hx, hy, kind) {
  const { put } = p;
  const look = kind === 'glance' || kind === 'oh';
  const eye = (ex, side) => { // ex: the eye's left column; side -1 is the eye on the left of the screen
    const y0 = hy;
    const flick = side < 0 ? ex - 2 : ex + 5;
    if (kind === 'wink' && side > 0) { // a happy closed curve
      for (const [x, y] of [[ex, y0 + 2], [ex + 1, y0 + 1], [ex + 2, y0 + 1], [ex + 3, y0 + 2]]) put(x, y, C.lash);
      put(flick, y0 + 1, C.lash);
      return;
    }
    for (let x = ex - 1; x <= ex + 4; x++) put(x, y0 - 1, C.lash); // the heavy upper lash
    put(flick, y0 - 2, C.lash);
    for (let y = y0; y <= y0 + 3; y++) for (let x = ex; x <= ex + 3; x++) put(x, y, C.white);
    const ix = look ? ex + 1 : side < 0 ? ex + 1 : ex; // the irises lean toward the middle, or both glance aside
    const tone = [C.irisDk, C.iris, C.iris, C.irisLt];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) put(ix + x, y0 + y, tone[y]);
    put(ix + 1, y0 + 1, C.lash); put(ix + 1, y0 + 2, C.irisDk); // pupil
    put(ix, y0 + 1, C.white); // the shine
    put(ex + 1, y0 + 4, shade(C.skin, 0.82)); put(ex + 2, y0 + 4, shade(C.skin, 0.82)); // lower lid
  };
  eye(41, -1); eye(52, 1);
  const brow = (ex, up) => { put(ex, hy - 3 - up, C.hair); put(ex + 1, hy - 4 - up, C.hair); put(ex + 2, hy - 4 - up, C.hair); put(ex + 3, hy - 4 - up, C.hair); };
  brow(41, 0); brow(52, kind === 'glance' || kind === 'wink' ? 1 : 0);
  for (const x of [40, 41, 42, 54, 55, 56]) put(x, hy + 5, C.blush);
  put(48, hy + 6, shade(C.skin, 0.75)); // nose
  put(52, hy + 9, C.lash); // beauty mark
  const m = hy + 8;
  if (kind === 'oh') {
    put(47, m, C.mouth); put(48, m, C.mouth); put(47, m + 1, C.mouth); put(48, m + 1, C.lips);
  } else if (kind === 'grin') { // the open anime "D" grin
    for (let x = 45; x <= 51; x++) put(x, m, C.mouth);
    for (let x = 46; x <= 50; x++) put(x, m + 1, x === 48 ? C.lips : C.mouth);
    for (let x = 46; x <= 50; x++) put(x, m - 1, C.white);
  } else {
    for (let x = 46; x <= 50; x++) put(x, m, C.lips);
    put(48, m + 1, shade(C.lips, 1.15));
    put(51, m - 1, C.lips); // corners up; a smirk only on one side
    if (kind !== 'smirk' && kind !== 'wink') put(45, m - 1, C.lips);
  }
}

// One frame as { px (Uint32 ABGR), w, h, pose, lift }. lift: how far her boots are off the ground.
// arms: false bakes her without them (an x-ray, so the tests can see the whole top behind her hands).
export function bakePinup(frame, { arms = true } = {}) {
  const f = FRAMES[((frame % FRAMES.length) + FRAMES.length) % FRAMES.length];
  const p = painter(), { ellipse, limb, rows, put } = p;
  const by = Y0 + (f.body ?? 0), fy = Y0 + (f.feet ?? 0), hairLag = f.hair ?? 0, bustLag = f.bust ?? 0;
  const at = ([x, y]) => [x, y + by];
  const hx = 48, hy = 21 + by;

  // hair at the back: a big mass and two long curls that swing
  ellipse(hx, hy + 3 + hairLag, 13, 14, C.hair);
  ellipse(35, hy + 15 + hairLag * 2, 5, 9, C.hair, { pattern: (x, y) => ((x + y) % 6 === 0 ? C.hairHi : null) });
  ellipse(61, hy + 15 + hairLag * 2, 5, 9, C.hair, { pattern: (x, y) => ((x - y) % 6 === 0 ? C.hairHi : null) });

  // bare legs in knee-high biker boots
  const hipL = [42, 85 + by], hipR = [54, 85 + by], squat = Math.max(0, f.body ?? 0);
  const kneeL = [39 - squat, 101 + (by + fy) / 2], kneeR = [57 + squat, 101 + (by + fy) / 2];
  const ankleL = [41, 122 + fy], ankleR = [55, 122 + fy];
  limb(hipL, kneeL, 6, 3.6, C.skin); limb(kneeL, ankleL, 3.8, 3, C.skin);
  limb(hipR, kneeR, 6, 3.6, C.skin); limb(kneeR, ankleR, 3.8, 3, C.skin);
  for (const [ax, ay] of [ankleL, ankleR]) {
    limb([ax, ay - 12], [ax, ay + 2], 4.8, 4.2, C.boot);
    for (let x = -5; x <= 4; x++) put(ax + x, ay - 13, C.vestHi); // the cuff
    for (const dy of [-8, -3]) for (let x = -4; x <= 3; x++) put(ax + x, ay + dy, C.steel); // buckle straps
    ellipse(ax + (ax < 48 ? -2 : 2), ay + 5, 6, 3, C.boot);
    for (let x = -7; x <= 6; x++) put(ax + x + (ax < 48 ? -2 : 2), ay + 7, 0x0a080c); // sole
  }

  // torso, seen from the front: shoulders, a tight waist, wide hips, then the pelvis narrowing into a V between the thighs
  const torso = lerpTable([[35, 5], [38, 12], [41, 15], [46, 14.5], [54, 11], [60, 8.5], [66, 8], [71, 12], [77, 14.5], [81, 13], [85, 9], [88, 4]]);
  rows(48, 35 + by, 88 + by, y => torso(y - by), C.skin);
  put(48, 64 + by, shade(C.skin, 0.7)); // belly button
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) put(48 + side * (11 - i), 75 + i + by, shade(C.skin, 0.8)); // hip bones
  const bottoms = lerpTable([[78, 10.5], [89, 2]]); // a front brief: a straight V from the waistband down
  const dotsLow = (x, y) => ((y - by) % 4 === 0 && (x + ((y - by) >> 2) * 2) % 4 === 0 ? C.dot : null);
  rows(48, 78 + by, 89 + by, y => bottoms(y - by), C.scarf, dotsLow);
  for (const side of [-1, 1]) { // side ties with little bows
    for (let d = 10; d <= 14; d++) put(48 + side * d, 78 + by - (d > 12 ? 1 : 0), C.scarf); // the string, riding up over the hip
    const x = 48 + side * 14;
    put(x, 76 + by, C.scarf); put(x, 78 + by, C.scarf);
  }
  for (let x = 32; x <= 64; x++) put(x, Math.round(73 + by + (x - 32) * 0.12), x % 3 ? C.belt : C.steel); // a studded belt, slung low
  for (let x = 51; x <= 53; x++) for (let y = 75; y <= 76; y++) put(x, y + by, C.steel); // its buckle
  for (let x = 55; x <= 63; x++) put(x, 79 + by + (x % 3 === 0 ? 1 : 0), C.steel); // a wallet chain

  // the bikini top: two big cups that trail the bounce (squashed when they land, stretched when they fly),
  // halter strings up to her neck, and the front tie she teases
  const bust = by + bustLag;
  const squash = bustLag >= 2 ? [1, -1] : bustLag <= -2 ? [-0.5, 1] : [0, 0];
  const rx = 10 + squash[0], ry = 9 + squash[1];
  const dots = (x, y) => { const v = y - bust; return v % 4 === 0 && (x + (v >> 2) * 2) % 4 === 0 ? C.dot : null; }; // pinned to the cloth
  ellipse(41, 51 + bust, rx, ry, C.skin);
  ellipse(55, 51 + bust, rx, ry, C.skin);
  for (let y = 45; y <= 52; y++) put(48, y + bust, shade(C.skin, 0.72)); // the line between them
  ellipse(41.5, 52 + bust, rx - 1.5, ry - 1, C.scarf, { pattern: dots });
  ellipse(54.5, 52 + bust, rx - 1.5, ry - 1, C.scarf, { pattern: dots });
  rows(48, 46 + bust, 50 + bust, () => 3, C.scarf, dots); // the front band, where it ties
  limb([40, 44 + bust], [44.5, 36 + by], 0.6, 0.6, C.scarf); limb([56, 44 + bust], [51.5, 36 + by], 0.6, 0.6, C.scarf); // halter strings, round the neck
  const k = f.knot ?? 'tied', kx = 48, ky = 43 + bust;
  if (k === 'loose') {
    ellipse(kx - 2, ky, 2.5, 2, C.scarf); ellipse(kx + 2, ky, 2.5, 2, C.scarf); // the bow half pulled, loops wide
    limb([kx, ky + 1], [kx - 4, ky + 9], 1.2, 1, shade(C.scarf, 1.1)); limb([kx, ky + 1], [kx + 5, ky + 9], 1.2, 1, shade(C.scarf, 1.1));
  } else if (k === 'flick') {
    ellipse(kx, ky, 2, 1.6, C.scarf);
    limb([kx, ky], [kx - 6, ky - 4], 1.2, 0.8, C.scarf); limb([kx, ky], [kx + 6, ky - 4], 1.2, 0.8, C.scarf);
  } else {
    ellipse(kx, ky, 2.5, 2, C.scarf);
    limb([kx, ky + 1], [kx - 3, ky + 6], 1.2, 1, C.scarf); limb([kx, ky + 1], [kx + 3, ky + 6], 1.2, 1, C.scarf);
  }

  // the open leather vest, with a club patch
  const vestOut = y => torso(y) + 2.5, lapel = lerpTable([[37, 5], [42, 9], [46, 16], [56, 16], [60, 9], [63, 6], [70, 6.5]]);
  for (let y = 37; y <= 70; y++) for (const side of [-1, 1]) {
    const outer = Math.max(vestOut(y), lapel(y) + 1), inner = lapel(y);
    for (let d = Math.ceil(inner); d <= Math.ceil(outer); d++) {
      const x = side < 0 ? Math.floor(48 - d) : Math.ceil(48 + d) - 1;
      const edge = d === Math.ceil(inner) || d === Math.ceil(outer);
      put(x, y + by, edge ? shade(C.vest, 0.7) : d === Math.ceil(inner) + 1 ? C.vestHi : C.vest);
    }
  }
  ellipse(38, 64 + by, 3, 3, C.patch); put(37, 64 + by, C.patchDk); put(39, 64 + by, C.patchDk); put(38, 66 + by, C.patchDk); // a flaming skull
  for (const x of [36, 38, 40]) put(x, 60 + by, C.patch);

  // neck and head: a round crown and a pointed anime chin
  limb([48, hy + 8], [48, 37 + by], 3, 3.6, C.skin);
  ellipse(hx, hy - 1, 9.5, 9.5, C.skin);
  ellipse(hx, hy + 5, 7, 6, C.skin);
  face(p, hx, hy, f.face);
  ellipse(40.5, hy + 7, 1.4, 1.8, C.gold, { flat: true }); put(40, hy + 7, C.hair); // hoop earrings
  ellipse(55.5, hy + 7, 1.4, 1.8, C.gold, { flat: true }); put(56, hy + 7, C.hair);
  // victory rolls and bangs, shades pushed up
  const sheen = (x, y) => ((x + y) % 5 === 0 ? C.hairHi : null);
  ellipse(40, hy - 11 + hairLag, 7, 5.5, C.hair, { pattern: sheen });
  ellipse(56, hy - 11 + hairLag, 7, 5.5, C.hair, { pattern: sheen });
  ellipse(44, hy - 7, 8, 3.5, C.hair, { pattern: sheen }); ellipse(54, hy - 7.5, 6, 3, C.hair);
  for (let x = 39; x <= 57; x++) put(x, hy - 13 + hairLag, C.shades);
  for (let x = 40; x <= 46; x++) put(x, hy - 12 + hairLag, C.shades);
  for (let x = 50; x <= 56; x++) put(x, hy - 12 + hairLag, C.shades);
  put(42, hy - 13 + hairLag, C.glint); put(52, hy - 13 + hairLag, C.glint);

  // arms, gloves and studded cuffs
  for (const [s, e, h] of arms ? f.arms : []) {
    limb(at(s), at(e), 3.4, 2.8, C.skin);
    limb(at(e), at(h), 2.8, 2.3, C.skin);
    const [cx, cy] = at(h), [ex, ey] = at(e);
    const ux = (cx - ex) / Math.hypot(cx - ex, cy - ey), uy = (cy - ey) / Math.hypot(cx - ex, cy - ey);
    for (let i = -2; i <= 2; i++) put(Math.round(cx - ux * 3 - uy * i), Math.round(cy - uy * 3 + ux * i), i % 2 ? C.steel : C.glove);
    ellipse(cx, cy, 3, 2.6, C.glove);
  }
  if (arms && f.finger !== undefined) { // the wagging finger, a bare fingertip out of the glove
    const [cx, cy] = at(f.arms[1][2]);
    limb([cx, cy - 2], [cx + (f.finger ? 1 : -2), cy - 8], 1.1, 1, C.skin);
  }

  p.outline();
  const px = new Uint32Array(W * H);
  for (let i = 0; i < px.length; i++) if (p.col[i] >= 0) px[i] = abgr(p.col[i]);
  return { px, w: W, h: H, pose: f.pose, lift: Math.max(0, -(f.feet ?? 0)) };
}

// Browser only: each frame as a canvas, baked on first use.
const cache = new Map();
export function pinupCanvas(frame) {
  if (!cache.has(frame)) {
    const f = bakePinup(frame), c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    const g = c.getContext('2d'), img = g.createImageData(f.w, f.h);
    new Uint32Array(img.data.buffer).set(f.px);
    g.putImageData(img, 0, 0);
    cache.set(frame, { canvas: c, lift: f.lift });
  }
  return cache.get(frame);
}
