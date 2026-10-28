import { abgr } from '../render/voxel/color.js';

// The landing page's pin-up, painted from scratch in code at HD pixel-art detail: our own anime-styled biker-club
// gal, framed head to mid-thigh. Long dark hair with a teal sheen, a pink bikini with a gold heart clasp, an open
// leather vest, one hand behind her head. Everything is built from shaded shapes (ellipses, tapered limbs,
// profiles) lit from the upper left in cel bands with warm shadows, a rim of pool-blue light on the right, wet
// sparkles on the skin, and line art wherever one part overlaps another.
//
// Her loop: she bounces (hair and top trailing every hop, with squash and stretch), reaches for the clasp, fiddles
// with it like she's about to... then snaps it shut and wags a finger at you. The top never comes open;
// tests/pinup.test.js checks every frame for that.
const W = 208, H = 320, CX = 104;
export const PINUP_GROUND = H; // her frame is cut at mid-thigh: the sprite's bottom edge sits on the screen's

// Hand-picked ramps: [deep, shadow, base, light, spec]. Shadows lean warm, lights lean cool.
const R = {
  skin: [0xb8685a, 0xe39a7e, 0xf8c6a6, 0xffe2cc, 0xffffff],
  hair: [0x0c1218, 0x141e28, 0x1e2c38, 0x2e5664, 0x5ab0bc],
  bikini: [0xa8304e, 0xd84a6c, 0xf26c8c, 0xff9cb2, 0xffe0e8],
  leather: [0x0c0a10, 0x18141e, 0x2a2532, 0x4a4458, 0x8c86a0],
  glove: [0x0c0a10, 0x16121a, 0x221e28, 0x3a3444, 0x6a6478],
  gold: [0x8a5a10, 0xc88c1c, 0xf2c23c, 0xffe27a, 0xffffff],
};
const RIM = { skin: 0xd6eef0, hair: 0x2a6a78, bikini: 0xffc4d4, leather: 0x6a7c98, glove: 0x4a5468, gold: 0xfff2b0 };
const LINE = 0x2a1418, OUTLINE = 0x140810;
const EYE = { white: 0xfaf6f4, lid: 0xd6d8e6, irisDk: 0x173040, iris: 0x2f7486, irisLt: 0x7cd2da, pupil: 0x0c141c, lash: 0x1a0e16, glint: 0xfff0b8 };
const MOUTH = { lip: 0xe0506a, dark: 0x5a1222, tongue: 0xe8707e, teeth: 0xfaf6f4 };
const BLUSH = 0xf2928e, DROP = 0xe8fbff;
const L = (() => { const v = [-0.5, -0.62, 0.6], m = Math.hypot(...v); return v.map(c => c / m); })(); // light from the upper left

// ---- the poses ----
// arm: [shoulder, elbow, hand] for her right arm (on the screen's right); her left hand stays behind her head.
// body: whole-figure offset; bust and hair: how far they trail the body (down +), swinging past it on each turn.
const HIP = [[146, 124], [174, 188], [150, 238]];
const bob = (body, bust, hair, face = 'grin') => ({ pose: 'bob', body, bust, hair, arm: HIP, face });
const FRAMES = [
  bob(3, 4, 2),             // landing crouch: everything keeps going down
  bob(0, 3, 3),             // pushing up: the top and hair lag behind
  bob(-4, 1, 2),            // rising
  bob(-8, -4, -2),          // the top of the hop: they fly on up
  bob(-6, -3, -3),          // falling: they float a moment
  bob(0, 2, 0, 'smile'),    // touchdown
  { pose: 'reach', bust: 1, arm: [[146, 124], [166, 176], [122, 158]], face: 'smirk', clasp: 'tied' },
  { pose: 'knot', arm: [[146, 124], [158, 180], [110, 160]], face: 'glance', clasp: 'tied' },
  { pose: 'tease', bust: 1, arm: [[146, 124], [160, 182], [114, 164]], face: 'oh', clasp: 'loose' },
  { pose: 'snap', bust: -4, hair: -2, arm: [[146, 124], [162, 172], [110, 152]], face: 'grin', clasp: 'flick' },
  { pose: 'wag', bust: 2, arm: [[146, 124], [178, 150], [154, 100]], face: 'wink', finger: -2 },
  { pose: 'wag', bust: -1, arm: [[146, 124], [180, 152], [160, 102]], face: 'wink', finger: 2 },
];
export const PINUP_FRAMES = FRAMES.length;

// The loop, in seconds: a run of bounces, a shimmy, the reach, a fidgety tease, the snap, a finger wag.
const SHIMMY_TIME = 1.4;
const SCRIPT = [
  [2.5, t => Math.floor(t * 12) % 6],
  [SHIMMY_TIME, () => 5, 'shimmy'],
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

// The shimmy is a deformation applied as she's drawn, row by row, so it works on any art, painted here or imported:
// { s, lag } in -1..1, the body's swing and the chest's swing a beat behind it. Both 0 outside the shimmy.
export function pinupShimmy(t) {
  let u = ((t % PINUP_LOOP) + PINUP_LOOP) % PINUP_LOOP;
  for (const [d, , kind] of SCRIPT) {
    if (u < d) {
      if (kind !== 'shimmy') return { s: 0, lag: 0 };
      const env = Math.sin(Math.PI * u / d), w = 2 * Math.PI * 4.5; // eases in and out, 4.5 shakes a second
      return { s: Math.sin(u * w) * env, lag: Math.sin(u * w - 0.9) * env };
    }
    u -= d;
  }
  return { s: 0, lag: 0 };
}

// How far (px) sprite row y moves in a shimmy: head a little, shoulders and chest one way (the chest trailing and
// swinging furthest), the waist still, the hips the other way.
const SWAY = lerpTable([[0, 2], [100, 3], [125, 5], [200, 2], [222, 0], [246, -4], [320, -4]]);
const JIGGLE = lerpTable([[0, 0], [130, 0], [150, 5], [175, 5], [192, 0], [320, 0]]);
export function shimmyOffset(y, s, lag) {
  return Math.round(SWAY(y) * s + JIGGLE(y) * lag);
}
export const shimmySway = y => SWAY(y); // the body's part of it, for imported art (which brings its own chest band)

// Everything about her motion at time t, for drawing her from an imported image instead of painting her:
// which pose, how high she is (body), how far her chest trails (bust), and the shimmy.
export function pinupMotion(t) {
  const frame = pinupFrame(t), f = FRAMES[frame];
  return { frame, pose: f.pose, body: f.body ?? 0, bust: f.bust ?? 0, shimmy: pinupShimmy(t) };
}

// ---- the painter ----
// Every shape gets a part id; where a front part meets a different part behind it, its edge pixels become line
// art, and the figure's silhouette gets a dark outline.
function painter() {
  const col = new Int32Array(W * H).fill(-1), part = new Uint16Array(W * H), lined = new Uint8Array(4096);
  let pid = 0;
  const putAny = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) col[y * W + x] = c; };
  // tone from a surface normal (nx, ny in the picture plane; nz from them)
  const tone = (mat, nx, ny) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const t = nx * L[0] + ny * L[1] + nz * L[2], ramp = R[mat];
    if (mat !== 'leather' && mat !== 'glove' && nx > 0.72 && ny > -0.6 && t < 0.4) return RIM[mat]; // pool light on the right edge
    if (t > 0.965 && mat !== 'skin') return ramp[4];
    return t > 0.74 ? ramp[3] : t > 0.36 ? ramp[2] : t > 0.06 ? ramp[1] : ramp[0];
  };
  // fill(test, mat): test(x, y) returns [nx, ny] inside the shape or null
  const fill = (x0, y0, x1, y1, test, mat, { lines = true } = {}) => {
    const id = ++pid;
    lined[id] = lines ? 1 : 0;
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
        const n = test(x + 0.5, y + 0.5);
        if (!n) continue;
        col[y * W + x] = tone(mat, n[0], n[1]);
        part[y * W + x] = id;
      }
    }
    return id;
  };
  const ellipse = (cx, cy, rx, ry, mat, opts) => fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1 ? [dx * 0.95, dy * 0.95] : null;
  }, mat, opts);
  // a limb (or strand) from a to b, radius ra to rb
  const limb = ([ax, ay], [bx, by], ra, rb, mat, opts) => {
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1, r = Math.max(ra, rb);
    return fill(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
      const qx = ax + vx * t, qy = ay + vy * t, rr = ra + (rb - ra) * t, d = Math.hypot(x - qx, y - qy);
      return d <= rr ? [((x - qx) / rr) * 0.95, ((y - qy) / rr) * 0.95 - 0.1] : null;
    }, mat, opts);
  };
  // a body profile: halfWidth(y) around cx from y0 to y1, rounded across its width
  const profile = (cx, y0, y1, halfWidth, mat, opts) => fill(cx - 70, y0, cx + 70, y1, (x, y) => {
    const hw = halfWidth(y);
    if (hw <= 0 || Math.abs(x - cx) > hw) return null;
    return [((x - cx) / hw) * 0.92, -0.12];
  }, mat, opts);
  // line art where a front part meets a part behind it, then the silhouette outline
  const ink = () => {
    const out = new Int32Array(col);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = part[i];
      if (col[i] < 0 || !p || !lined[p]) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        if (col[j] >= 0 && part[j] && part[j] < p) { out[i] = LINE; break; }
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (col[i] >= 0) continue;
      if ((x > 0 && col[i - 1] >= 0) || (x < W - 1 && col[i + 1] >= 0) || (y > 0 && col[i - W] >= 0) || (y < H - 1 && col[i + W] >= 0)) out[i] = OUTLINE;
    }
    col.set(out);
  };
  return { col, putAny, fill, ellipse, limb, profile, ink };
}

function lerpTable(table) {
  return y => {
    if (y <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) if (y <= table[i][0]) {
      const [y0, a] = table[i - 1], [y1, b] = table[i];
      return a + (b - a) * (y - y0) / (y1 - y0);
    }
    return table[table.length - 1][1];
  };
}

// A gold heart: 'big' (the bikini clasp, an open ring) or 'small' (the hip rings and the hair clip).
function heart(p, x, y, size) {
  const s = size === 'big' ? 1 : 0.6;
  p.fill(x - 7 * s, y - 6 * s, x + 7 * s, y + 7 * s, (px, py) => {
    const u = (px - x) / (6 * s), v = -(py - y) / (6 * s) + 0.15;
    const f = (u * u + v * v - 1) ** 3 - u * u * v * v * v; // the classic heart curve
    const inner = size === 'big' && ((u / 0.55) ** 2 + ((v - 0.1) / 0.55) ** 2) < 1;
    return f <= 0 && !inner ? [u * 0.7, -v * 0.7] : null;
  }, 'gold');
}

// Big anime eyes: a lidded white, a deep gradient iris with two glints, a heavy flicked upper lash.
function eye(p, cx, cy, side, kind) {
  const { putAny } = p;
  if (kind === 'wink' && side > 0) { // a happy closed curve
    for (let dx = -9; dx <= 9; dx++) { const y = cy + 1 - Math.round(4 * (1 - (dx / 9) ** 2)); putAny(cx + dx, y, EYE.lash); putAny(cx + dx, y + 1, EYE.lash); }
    putAny(cx + 10, cy - 2, EYE.lash); putAny(cx + 11, cy - 3, EYE.lash);
    return;
  }
  const look = kind === 'glance' || kind === 'oh' ? 2 : side < 0 ? 1 : -1; // irises lean in, or both glance aside
  for (let dy = -7; dy <= 7; dy++) for (let dx = -9; dx <= 9; dx++) {
    if ((dx / 9.5) ** 2 + (dy / 7.5) ** 2 > 1) continue;
    const ix = (dx - look) / 6, iy = (dy - 0.5) / 7;
    let c = dy < -4 ? EYE.lid : EYE.white;
    if (ix * ix + iy * iy <= 1) c = dy < -2 ? EYE.irisDk : dy < 3 ? EYE.iris : EYE.irisLt;
    if (((dx - look) / 2.4) ** 2 + ((dy - 0.5) / 3.4) ** 2 <= 1) c = EYE.pupil;
    putAny(cx + dx, cy + dy, c);
  }
  for (const [gx, gy] of [[-3, -3], [-2, -3], [-3, -2], [-2, -2], [-3, -1]]) putAny(cx + look + gx, cy + gy, EYE.white); // the big glint
  putAny(cx + look + 3, cy + 3, EYE.glint); putAny(cx + look + 2, cy + 3, EYE.glint);
  for (let dx = -10; dx <= 10; dx++) { // the upper lash, thick, following the lid
    const y = cy - Math.round(7.5 * Math.sqrt(Math.max(0, 1 - (dx / 10.5) ** 2)));
    putAny(cx + dx, y, EYE.lash); putAny(cx + dx, y - 1, EYE.lash);
    if (Math.abs(dx) < 7) putAny(cx + dx, y + 1, EYE.lash);
  }
  const o = side < 0 ? -1 : 1; // the flick at the outer corner
  for (const [fx, fy] of [[10, -1], [11, -2], [12, -3], [12, -4], [11, -1]]) putAny(cx + o * fx, cy + fy, EYE.lash);
  for (let dx = 4; dx <= 8; dx++) putAny(cx + o * dx, cy + 7, EYE.lash); // lower lash, outer half
}

function face(p, cx, cy, kind) {
  const { putAny } = p;
  eye(p, cx - 15, cy, -1, kind); eye(p, cx + 15, cy, 1, kind);
  const brow = (x, up) => { for (let dx = -6; dx <= 6; dx++) putAny(x + dx, cy - 13 - up - Math.round(2 * (1 - (dx / 6) ** 2)), R.hair[1]); };
  brow(cx - 15, 0); brow(cx + 15, kind === 'glance' || kind === 'wink' ? 2 : 0);
  for (let i = 0; i < 4; i++) for (const bx of [cx - 21, cx + 13]) putAny(bx + i * 2, cy + 11 - (i % 2), BLUSH); // hatched blush
  for (let i = 0; i < 4; i++) for (const bx of [cx - 20, cx + 14]) putAny(bx + i * 2, cy + 13 - (i % 2), BLUSH);
  putAny(cx + 1, cy + 12, R.skin[1]); putAny(cx + 1, cy + 13, R.skin[1]); // nose
  const m = cy + 21;
  if (kind === 'oh') {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) putAny(cx + dx, m + dy, dx * dx + dy * dy >= 4 ? MOUTH.lip : MOUTH.dark);
  } else if (kind === 'grin') { // the open "D" smile, teeth on top and tongue below
    for (let dy = 0; dy <= 6; dy++) {
      const hw = Math.round(8 * Math.sqrt(1 - (dy / 7) ** 2));
      for (let dx = -hw; dx <= hw; dx++) putAny(cx + dx, m - 2 + dy, dy === 0 ? MOUTH.teeth : dy >= 4 && Math.abs(dx) < hw - 1 ? MOUTH.tongue : MOUTH.dark);
    }
    for (let dx = -9; dx <= 9; dx++) putAny(cx + dx, m - 3 + (Math.abs(dx) > 7 ? 1 : 0), MOUTH.lip);
  } else {
    for (let dx = -6; dx <= 6; dx++) putAny(cx + dx, m + Math.round((dx / 6) ** 2 * -2), MOUTH.lip);
    putAny(cx + 7, m - 3, MOUTH.lip);
    if (kind !== 'smirk' && kind !== 'wink') putAny(cx - 7, m - 3, MOUTH.lip);
    if (kind === 'wink') { putAny(cx + 1, m + 1, MOUTH.tongue); putAny(cx + 2, m + 1, MOUTH.tongue); putAny(cx + 1, m + 2, MOUTH.tongue); } // a cheeky tongue tip
  }
}

// One frame as { px (Uint32 ABGR), w, h, pose, lift }.
// arms: false bakes her without her moving arm (an x-ray, so the tests can see the whole top behind her hand).
export function bakePinup(frame, { arms = true } = {}) {
  const f = FRAMES[((frame % FRAMES.length) + FRAMES.length) % FRAMES.length];
  const p = painter(), { ellipse, limb, profile, fill, putAny } = p;
  const by = f.body ?? 0, bl = by + (f.bust ?? 0), hl = f.hair ?? 0;
  const at = ([x, y]) => [x, y + by];
  const hy = 62 + by; // the head's centre

  // 1. her hair, behind everything: the crown, a long fall to the hips, ends swinging behind her
  ellipse(CX, hy + 6 + hl * 0.5, 42, 44, 'hair', { lines: false });
  profile(CX, hy + 20, 262 + by + hl * 2, lerpTable([[hy + 20, 44], [hy + 80, 52], [hy + 150, 50], [hy + 200, 36]].map(([y, w]) => [y + hl, w])), 'hair', { lines: false });
  for (let k = -3; k <= 3; k++) limb([CX + k * 13, 228 + by + hl], [CX + k * 17 - hl * 2, 270 + by + hl * 3 - Math.abs(k) * 4], 8, 1, 'hair');

  // 2. her left arm, raised, hand tucked behind her head
  limb([62, 126 + by], [34, 70 + by], 10, 8, 'skin');
  limb([34, 70 + by], [74, 40 + by], 8, 7, 'skin');

  // 3. legs (cut at mid-thigh by the frame), then the body over their tops
  limb([82, 262 + by], [74, 336 + by], 25, 22, 'skin');
  limb([126, 262 + by], [134, 336 + by], 25, 22, 'skin');
  limb([104, hy + 22], [104, 126 + by], 11, 13, 'skin', { lines: false }); // neck, from behind the chin
  const torso = lerpTable([[110, 12], [116, 34], [122, 45], [132, 45], [150, 40], [172, 31], [194, 26], [210, 28], [232, 42], [246, 47], [258, 46], [270, 38], [282, 24], [292, 10]]);
  profile(CX, 110 + by, 292 + by, y => torso(y - by), 'skin');
  for (let k = 0; k < 9; k++) { putAny(CX - 38 + k * 3, 120 + by + Math.round(k * 0.6), R.skin[1]); putAny(CX + 38 - k * 3, 120 + by + Math.round(k * 0.6), R.skin[1]); } // collarbones
  for (let y = 212; y <= 216; y++) putAny(CX, y + by, R.skin[y === 212 ? 0 : 1]); // navel
  for (let y = 176; y <= 206; y += 2) putAny(CX - 1, y + by, R.skin[1]); // the soft line down her middle

  // 4. bikini bottoms: a front brief, strings over the hips, gold heart rings
  const brief = lerpTable([[246, 38], [254, 31], [266, 20], [278, 11], [290, 4]]);
  fill(CX - 40, 240 + by, CX + 40, 292 + by, (x, y) => {
    const v = y - by, hw = brief(v), top = 246 - Math.round(((x - CX) / 38) ** 2 * 5);
    return v >= top && Math.abs(x - CX) <= hw ? [((x - CX) / 40) * 0.85, (v - 268) / 40] : null;
  }, 'bikini');
  limb([CX - 38, 241 + by], [CX - 48, 236 + by], 1.4, 1.2, 'bikini'); limb([CX + 38, 241 + by], [CX + 48, 236 + by], 1.4, 1.2, 'bikini');
  heart(p, CX - 36, 244 + by, 'small'); heart(p, CX + 36, 244 + by, 'small');

  // 5. the bikini top over her chest: skin, then two cups that trail the bounce (squashed when they land,
  // stretched when they fly), halter straps round the neck, a centre band and the heart clasp she teases
  const lag = f.bust ?? 0, squash = lag >= 3 ? [1.5, -1.5] : lag <= -3 ? [-1, 1.5] : [0, 0];
  const rx = 23 + squash[0], ry = 21 + squash[1];
  ellipse(CX - 20, 156 + bl, rx, ry, 'skin');
  ellipse(CX + 20, 156 + bl, rx, ry, 'skin');
  for (let y = 140; y <= 162; y++) putAny(CX + (y > 150 ? 0 : (y % 2)), y + bl, R.skin[y < 146 ? 1 : 0]); // the line between them
  const cup = cx => fill(cx - rx, 140 + bl, cx + rx, 178 + bl, (x, y) => {
    const dx = (x - cx) / (rx - 3), dy = (y - (162 + bl)) / (ry - 4);
    const tri = y - bl >= 146 - Math.abs(x - cx) * 0.55; // a triangle cup: a point at the top, full below
    return dx * dx + dy * dy <= 1 && tri ? [dx * 0.9, dy * 0.9 - 0.1] : null;
  }, 'bikini');
  cup(CX - 21); cup(CX + 21);
  limb([CX - 23, 142 + bl], [CX - 10, 108 + by], 1.4, 1.2, 'bikini'); limb([CX + 23, 142 + bl], [CX + 10, 108 + by], 1.4, 1.2, 'bikini'); // halter straps
  limb([CX - 6, 160 + bl], [CX + 6, 160 + bl], 2.6, 2.6, 'bikini'); // the centre band
  const clasp = f.clasp ?? 'tied';
  if (clasp === 'loose') { heart(p, CX + 2, 162 + bl, 'big'); limb([CX - 3, 166 + bl], [CX - 6, 178 + bl], 1.1, 0.8, 'bikini'); }
  else heart(p, CX, 160 + bl, 'big');
  if (clasp === 'flick') for (const [dx, dy] of [[0, -11], [0, -12], [-1, -11], [1, -11], [0, -10], [9, -3], [-9, -3]]) putAny(CX + dx, 160 + bl + dy, 0xffffff);

  // 6. the open leather vest, hanging off her shoulders, with a club patch
  const vest = side => fill(CX - 62, 112 + by, CX + 62, 236 + by, (x, y) => {
    const v = y - by, d = (x - CX) * side, outer = torso(v) + 4, lapel = lerpTable([[112, 14], [130, 38], [150, 44], [176, 34], [200, 28], [236, 31]])(v);
    return d >= lapel && d <= outer ? [side * 0.5, -0.2 + (v - 170) / 200] : null;
  }, 'leather');
  vest(-1); vest(1);
  ellipse(CX + 36, 206 + by, 5, 5, 'gold', { lines: false }); // the patch: a little flaming skull
  for (const [dx, dy, c] of [[-2, 0, 0x2a1418], [2, 0, 0x2a1418], [0, 2, 0x2a1418], [-3, -6, 0xff6a1a], [0, -7, 0xff6a1a], [3, -6, 0xff6a1a]]) putAny(CX + 36 + dx, 206 + by + dy, c);

  // 7. her right arm: on her hip, or reaching for the clasp, or wagging a finger
  if (arms) {
    const [s, e, h] = f.arm.map(at);
    limb(s, e, 10, 8, 'skin');
    limb(e, h, 8, 6.5, 'skin');
    const ux = h[0] - e[0], uy = h[1] - e[1], ul = Math.hypot(ux, uy);
    limb([h[0] - (ux / ul) * 6, h[1] - (uy / ul) * 6], [h[0] - (ux / ul) * 1, h[1] - (uy / ul) * 1], 7, 7, 'glove'); // a studded cuff
    ellipse(h[0], h[1], 7.5, 6.5, 'glove'); // fingerless glove
    if (f.finger !== undefined) limb([h[0], h[1] - 5], [h[0] + f.finger, h[1] - 17], 2.6, 2.2, 'skin');
  }

  // 8. the head: a round crown and a pointed anime chin, then the face
  ellipse(CX, hy - 2, 30, 30, 'skin', { lines: false });
  profile(CX, hy + 4, hy + 34, lerpTable([[hy + 4, 30], [hy + 16, 27], [hy + 26, 18], [hy + 31, 9], [hy + 34, 3]]), 'skin', { lines: false });
  face(p, CX, hy + 6, f.face);
  for (let r = 0; r <= 4; r++) for (let x = CX - 10 + r * 2; x <= CX + 10 - r * 2; x++) putAny(x, hy + 35 + r, r === 0 ? R.skin[0] : R.skin[1]); // a V of shadow under her chin

  // 9. the front hair: a crown cap, pointed bangs, long locks framing her face, a heart clip, a shine band
  fill(CX - 34, hy - 34, CX + 34, hy - 6, (x, y) => {
    const dx = (x - CX) / 33, dy = (y - (hy - 4)) / 31;
    return dx * dx + dy * dy <= 1 && y < hy - 8 ? [dx * 0.9, dy * 0.9] : null;
  }, 'hair', { lines: false });
  const LEN = [2, 6, 1, 8, 3, 9, 4, 7, 1, 5, 0];
  for (let k = -5; k <= 5; k++) { // bangs: fine tapered strands of uneven length, alternate ones inked so they separate
    const rootX = CX + k * 5.5, tipX = CX + k * 6.2 + (k < 0 ? -1 : 1) * (Math.abs(k) > 3 ? 2 : 0), tipY = hy - 6 + LEN[k + 5] - Math.abs(k) * 0.8;
    limb([rootX, hy - 30], [tipX, tipY], 4.6, 0.5, 'hair', { lines: k % 2 === 0 });
  }
  limb([CX - 30, hy - 14], [CX - 40, hy + 82 + hl], 8, 2, 'hair'); // locks framing her face, swinging
  limb([CX + 30, hy - 14], [CX + 42, hy + 70 + hl], 8, 2, 'hair');
  limb([CX + 34, hy + 20], [CX + 48, hy + 110 + hl * 2], 6, 1.5, 'hair');
  for (let dx = -18; dx <= 18; dx++) { // the shine band arcing over the crown
    const y = hy - 24 + Math.round((dx / 18) ** 2 * 6);
    if ((dx + 30) % 7 > 1) { putAny(CX + dx, y, R.hair[4]); putAny(CX + dx, y + 1, R.hair[3]); }
  }
  heart(p, CX + 24, hy - 16, 'small'); // hair clip

  // 10. wet sparkles on her skin
  for (const [x, y] of [[66, 132], [68, 134], [140, 130], [84, 300], [86, 302], [130, 296], [92, 196], [118, 226]]) {
    putAny(x, y + by, 0xffffff); putAny(x + 1, y + by + 1, DROP);
  }

  p.ink();
  const px = new Uint32Array(W * H);
  for (let i = 0; i < px.length; i++) if (p.col[i] >= 0) px[i] = abgr(p.col[i]);
  return { px, w: W, h: H, pose: f.pose, lift: Math.max(0, -by) };
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
