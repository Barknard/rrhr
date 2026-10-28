import { hash } from '../../core/iso.js';
import { NOISE, NOISE2, sample } from './noise.js';
import { shade, mix, abgr, rgbOf } from '../voxel/color.js';

// Pre-renders a track into an HD per-pixel layer (pure: no DOM). Every pixel gets a base colour and a
// kind; lava pixels are coloured per frame by composite.js, and "hot" pixels (rock lit by lava, glowing
// fissures, cliff faces) flicker between their base and hot colours.
//   layer pixel of a grid point = origin + (gx - gy) * 28, (gx + gy) * 14 - gz * 1.75
export const KIND = { BG: 0, SOLID: 1, LAVA: 2, HOT: 3 };
const HX = 28, HY = 14, ZS = 1.75;
const ROCK = [0x16121a, 0x201a24, 0x2a2330, 0x352c3b, 0x433847, 0x544756];
const WALL_RGB = [0x6c6274, 0x564e60, 0x4a4252, 0x3a3442, 0x2c2832, 0xf0bd2a, 0x1e1b24];
export const WALL = WALL_RGB.map(abgr); // raised-road side walls: concrete, seams, hazard lip

// Terrain rules shared by the baker and the tests: where lava may go, and where the props stand.
export function makeTerrain(track) {
  const hw = track.halfWidth, def = track.def, N = track.size;
  const props = [];
  for (let x = 1; x < N - 1; x++) for (let y = 1; y < N - 1; y++) {
    if (hash(x, y, def.seed + 31) > 0.024) continue;
    const px = x + 0.5, py = y + 0.5;
    if (track.project(px, py).dist < hw + 2.5) continue;
    if (props.some(p => Math.hypot(p.x - px, p.y - py) < 4)) continue;
    props.push({ type: hash(x, y, def.seed + 32) < 0.6 ? 'stack' : 'beacon', x: px, y: py });
  }
  const inRect = (gx, gy) => (def.lava ?? []).some(([x0, y0, x1, y1]) => gx >= x0 && gx < x1 && gy >= y0 && gy < y1);
  function lavaAt(gx, gy, p = track.project(gx, gy)) {
    if (p.dist < hw + 1.5) return false;
    for (const q of props) if (Math.hypot(gx - q.x, gy - q.y) < 1.3) return false;
    if (inRect(gx, gy)) return true;
    const n = sample(NOISE, gx * 7, gy * 7);
    return n > 0.565 || Math.abs(n - 0.43) < 0.022; // lakes (about 30% of the open ground) and thin rivers
  }
  return { props, lavaAt };
}

export function bakeWorld(track) {
  const N = track.size, hw = track.halfWidth, L = track.length, terrain = makeTerrain(track);
  const padX = 64, padTop = 120, padBot = 40;
  const W = N * 2 * HX + 2 * padX, H = N * 2 * HY + padTop + padBot;
  const origin = { x: N * HX + padX, y: padTop };
  const base = new Uint32Array(W * H), hot = new Uint32Array(W * H), kind = new Uint8Array(W * H), heat = new Uint8Array(W * H);
  const put = (x, y, c, k, hc = 0, ht = 0) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    base[i] = abgr(c); kind[i] = k; hot[i] = hc ? abgr(hc) : 0; heat[i] = ht;
  };

  // colour of the ground at grid point (gx, gy) seen at layer pixel (px, py) on a surface of height h
  function ground(gx, gy, px, py, h, pitTile) {
    const p = track.project(gx, gy), d = p.dist, r = hash(px, py, 1);
    if (d <= hw) {
      if (pitTile && track.inPit(p.seg, p.t)) return [0, KIND.LAVA];
      const sOff = p.s < L / 2 ? p.s : p.s - L;
      if (Math.abs(sOff) < 0.5) { // start/finish checkers
        const g = track.segs[p.seg], side = (gx - p.px) * -g.uy + (gy - p.py) * g.ux;
        return [(Math.floor((side + hw) / 0.5) + Math.floor((sOff + 0.5) / 0.5)) & 1 ? 0xe8e4e0 : 0x18161c, KIND.SOLID];
      }
      if (d > hw - 0.32) { // curbs
        let c = Math.floor(p.s / 0.75) & 1 ? 0xd8d2cc : 0xc22a20;
        if (d > hw - 0.07) c = shade(c, 0.62); else if (d < hw - 0.27) c = shade(c, 1.12);
        return [c, KIND.SOLID];
      }
      let c = mix(0x29262f, 0x3d3945, sample(NOISE2, gx * 26, gy * 26));
      if (r < 0.045) c = 0x56505f; else if (r > 0.975) c = 0x1b1921;
      if (Math.abs(d - 1.15) < 0.34 || Math.abs(d - hw * 0.45) < 0.3) c = shade(c, 0.87); // worn racing grooves
      if (sample(NOISE, gx * 11 + 40, gy * 11) > 0.69) c = shade(c, 0.76);                 // oil stains
      if (d < 0.07 && (Math.floor(p.s / 1.1) & 1) && r > 0.18) c = 0xd2b856;                // centre dashes
      return [c, KIND.SOLID];
    }
    if (d < hw + 0.13) return [r < 0.5 ? 0xa9afbd : 0x9399a8, KIND.SOLID];                  // guard rail top
    if (d < hw + 0.3) return [Math.floor(p.s * 1.4) % 3 === 0 ? 0x2a2c34 : 0x4c505c, KIND.SOLID]; // rail face + posts
    if (d < hw + 0.85) return [r < 0.3 ? 0x3e3438 : r < 0.85 ? 0x2c2428 : 0x564a50, KIND.SOLID];   // gravel
    if (h === 0 && terrain.lavaAt(gx, gy, p)) return [0, KIND.LAVA];
    const n = sample(NOISE, gx * 16 + 9, gy * 16);
    const c = ROCK[Math.max(0, Math.min(5, Math.floor(n * 6 + (r - 0.5) * 0.9)))];
    if (Math.abs(sample(NOISE2, gx * 9, gy * 9) - 0.5) < 0.011) return [0x120e14, KIND.HOT, 0xff6a1a, 210]; // glowing fissure
    return [c, KIND.SOLID];
  }

  const heightOf = (tx, ty) => { const t = track.tiles[tx]?.[ty]; return t && t.type === 'road' ? t.h : 0; };
  function drawTile(tx, ty) {
    const t = track.tiles[tx][ty];
    const raised = t.type === 'road' && t.h > 0, h = raised ? t.h : 0;
    const cx = origin.x + (tx - ty) * HX, top = Math.round(origin.y + (tx + ty) * HY - h * ZS);
    if (raised) { // concrete side walls down to whatever is in front, with seams and a hazard-striped lip
      // the left face looks toward +y, the right face toward +x; small steps on ramps get no stripe
      const drop = [Math.round(Math.max(0, h - heightOf(tx, ty + 1)) * ZS), Math.round(Math.max(0, h - heightOf(tx + 1, ty)) * ZS)];
      for (let i = 0; i < 2 * HX; i++) {
        const left = i < HX, y0 = left ? top + HY + (i >> 1) : top + 2 * HY - ((i - HX) >> 1), wallH = drop[left ? 0 : 1];
        for (let k = 0; k < wallH; k++) {
          let c = left ? WALL_RGB[0] : WALL_RGB[1];
          if (k < 3 && wallH > 8) c = ((i + k) >> 1) & 1 ? WALL_RGB[5] : WALL_RGB[6];
          else if (k % 9 === 0 || i % 14 === 0) c = left ? WALL_RGB[2] : WALL_RGB[3];
          else if (hash(cx + i, k, 7) < 0.04) c = WALL_RGB[4];
          put(cx - HX + i, y0 + k, c, KIND.SOLID);
        }
      }
    }
    for (let r = 0; r < 2 * HY; r++) {
      const half = r < HY ? (r + 1) * 2 : (2 * HY - r) * 2, py = top + r;
      for (let px = cx - half; px < cx + half; px++) {
        const a = (px - origin.x) / HX, b = (py - origin.y + h * ZS) / HY;
        const [c, k, hc, ht] = ground((a + b) / 2, (b - a) / 2, px, py, h, t.type === 'pit');
        put(px, py, c, k, hc, ht);
      }
    }
  }
  for (let s = 0; s < 2 * N - 1; s++) for (let x = 0; x < N; x++) { const y = s - x; if (y >= 0 && y < N) drawTile(x, y); }

  // the map is an island in a sea of lava: everything outside it is lava too
  for (let i = 0; i < kind.length; i++) if (kind[i] === KIND.BG) kind[i] = KIND.LAVA;

  // lava sits below the rock: cliffs drop into it, and rock right next to it glows. Decided from a
  // snapshot of the kinds, so converting one row never makes the next row look like it is under rock.
  const was = kind.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (was[i] === KIND.LAVA) {
      let k = 0;
      for (let j = 1; j <= 8 && y - j >= 0; j++) { const a = was[i - j * W]; if (a === KIND.SOLID || a === KIND.HOT) { k = j; break; } else if (a !== KIND.LAVA) break; }
      if (!k) continue;
      let c = mix(0x3e3140, 0x140d14, (k - 1) / 7);
      if (hash(x, 0, 5) < 0.3) c = shade(c, 0.78);
      if (k === 1) c = 0x5a4a5c;
      base[i] = abgr(c); kind[i] = KIND.HOT; hot[i] = abgr(mix(c, 0xff5a1a, 0.25 + k * 0.07)); heat[i] = Math.min(255, k * 36);
    } else if (was[i] === KIND.SOLID) {
      for (let j = 1; j <= 3; j++) {
        if ((x + j < W && was[i + j] === KIND.LAVA) || (x - j >= 0 && was[i - j] === KIND.LAVA) || (y + j < H && was[i + j * W] === KIND.LAVA)) {
          kind[i] = KIND.HOT; heat[i] = 60 * (4 - j); hot[i] = abgr(mix(rgbOf(base[i]), 0xff7a2a, 0.32));
          break;
        }
      }
    }
  }

  return withToLayer({ W, H, origin, base, hot, kind, heat, props: terrain.props });
}

// Gives a world (fresh, or cloned back from the bake worker, where functions can't travel) its grid-to-layer mapping.
export function withToLayer(world) {
  const { origin } = world;
  world.toLayer = (gx, gy, gz = 0) => [origin.x + (gx - gy) * HX, origin.y + (gx + gy) * HY - gz * ZS];
  return world;
}
