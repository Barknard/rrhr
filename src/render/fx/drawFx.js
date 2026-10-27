import { abgr } from '../voxel/color.js';
import { Z_SCALE } from '../../core/iso.js';

// Draws the effects state from fx.js onto the canvas: dithered discs (smoke, fire, glow) from a cache,
// pixel-line sparks, shock rings, branching lightning. Browser only.
// view(gx, gy, zPx) -> [x, y] in view pixels, where zPx is screen pixels above the ground plane.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = c => `#${c.toString(16).padStart(6, '0')}`;
const discs = new Map();

function disc(r, dens, color, lit) {
  r = Math.max(1, Math.round(r)); dens = Math.max(0, Math.min(16, Math.round(dens)));
  const key = `${r},${dens},${color},${lit ?? -1}`;
  let c = discs.get(key);
  if (c) return c;
  const s = 2 * r + 1;
  c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), id = g.createImageData(s, s), u = new Uint32Array(id.data.buffer);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = x - r, dy = y - r;
    if (dx * dx + dy * dy > r * r + r * 0.6 || BAYER[((y & 3) << 2) | (x & 3)] >= dens) continue;
    u[y * s + x] = abgr(lit != null && dx + dy < -r * 0.5 ? lit : color);
  }
  g.putImageData(id, 0, 0);
  if (discs.size > 4000) discs.clear();
  discs.set(key, c);
  return c;
}
export function drawDisc(ctx, x, y, r, dens, color, lit) {
  if (dens <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const c = disc(r, dens, color, lit);
  ctx.drawImage(c, Math.round(x - (c.width - 1) / 2), Math.round(y - (c.width - 1) / 2));
}

export function pixelLine(ctx, x0, y0, x1, y1, color, w = 1) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (let n = 0; n < 2000; n++) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const FIRE = [[0.08, 0xfffbe0, 0xffffff], [0.22, 0xffd84a, 0xfff2a0], [0.42, 0xff8a24, 0xffc040], [0.62, 0xd8401a, 0xff7a2a], [0.8, 0x7a2412, 0xa83a1a], [1.01, 0x3a2a2e, 0x5a4448]];
const GROUND = new Set(['glowdot', 'bubble', 'drop']);

function drawPart(ctx, p, view) {
  if (p.delay > 0) return;
  const [x, y] = view(p.x, p.y, p.z), a = 1 - p.life / p.max;
  switch (p.kind) {
    case 'ember': ctx.fillStyle = a < 0.3 ? '#fff0a0' : a < 0.6 ? '#ffa030' : '#d04010'; ctx.fillRect(Math.round(x), Math.round(y), 1, a < 0.2 ? 2 : 1); break;
    case 'bubble': { const r = 1 + a * 3; drawDisc(ctx, x, y, r, 16, 0xff7020, 0xffc040); if (r > 2) drawDisc(ctx, x, y - 1, r - 1.5, 10, 0xffe080); break; }
    case 'drop': ctx.fillStyle = '#ffc040'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); break;
    case 'spark': {
      const [px, py] = view(p.x - p.vx * 0.025, p.y - p.vy * 0.025, p.z - p.vz * 0.025);
      const col = p.color != null ? hex(p.color) : p.blue ? (a < 0.5 ? '#e8f4ff' : '#6aa0ff') : a < 0.4 ? '#fff8d0' : a < 0.7 ? '#ffc040' : '#ff6a1a';
      pixelLine(ctx, x, y, px, py, col);
      break;
    }
    case 'flame': drawDisc(ctx, x, y, p.r * (1 - a * 0.5), 16, p.blue ? (a < 0.4 ? 0xe8fbff : 0x29a3ff) : a < 0.3 ? 0xfff4b0 : a < 0.6 ? 0xffb030 : 0xff5a1a, a < 0.5 ? 0xffffff : undefined); break;
    case 'smoke': drawDisc(ctx, x, y, p.r0 + (p.r1 - p.r0) * Math.sqrt(a), Math.round(13 * (1 - a) + 2), p.color, p.lit); break;
    case 'shimmer': drawDisc(ctx, x, y, p.r, 3, 0xffd8b0); break;
    case 'fire': {
      const [, c, l] = FIRE.find(f => a < f[0]);
      const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(a), dens = a < 0.62 ? 16 : Math.round((16 * (1 - a)) / 0.38);
      drawDisc(ctx, x, y, r, dens, c, l);
      if (a < 0.45) drawDisc(ctx, x - r * 0.25, y - r * 0.25, r * 0.5, 12, l);
      break;
    }
    case 'debris': {
      const s = p.size, c = p.glow ? (a < 0.5 ? '#ffb030' : '#a83a1a') : p.color != null ? hex(p.color) : '#2a2830';
      ctx.fillStyle = '#0c0910'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, s + 2, s + 2);
      ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), s, s);
      if (!p.glow) { ctx.fillStyle = '#5a5866'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
      break;
    }
    case 'glowdot': if ((p.life * 37) % 1 > 0.15) { ctx.fillStyle = a < 0.5 ? '#ffb030' : '#c03a14'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); } break;
    default: break;
  }
}

function drawRing(ctx, r, view) {
  const [cx, cy] = view(r.x, r.y, r.z), a = r.age / r.life, R = (6 + a * 70) * (r.size ?? 1), dens = Math.round(16 * (1 - a));
  ctx.fillStyle = r.color != null ? hex(r.color) : a < 0.3 ? '#fff6e0' : '#ffb870';
  for (let k = 0; k < 160; k++) {
    if (BAYER[k & 15] >= dens) continue;
    const ang = (k / 160) * 2 * Math.PI;
    ctx.fillRect(Math.round(cx + Math.cos(ang) * R), Math.round(cy + Math.sin(ang) * R * 0.5), 2, 1);
  }
}

function drawBolt(ctx, b, view, t) {
  if (b.rope) {
    const [ax, ay] = view(b.a.x, b.a.y, (b.a.z + 5) * Z_SCALE), [bx, by] = view(b.b.x, b.b.y, (b.b.z + 5) * Z_SCALE);
    pixelLine(ctx, ax, ay + 1, bx, by + 1, '#5a4a30'); pixelLine(ctx, ax, ay, bx, by, '#d8c49a');
    return;
  }
  if (Math.floor(t * 30) % 3 === 2) return; // flicker
  const pts = b.points.map(([x, y, z]) => view(x, y, z * Z_SCALE));
  const along = (P, Q, path) => {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    return path.map(([u, o]) => [P[0] + dx * u + nx * o * len, P[1] + dy * u + ny * o * len]);
  };
  for (let s = 0; s < pts.length - 1; s++) {
    const A = pts[s], B = pts[s + 1], main = along(A, B, b.path), lines = [main];
    for (const br of b.branches) {
      const start = main[Math.floor(br.at * (main.length - 1))];
      const ang = Math.atan2(B[1] - A[1], B[0] - A[0]) + br.dir, len = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.35;
      lines.push(along(start, [start[0] + Math.cos(ang) * len, start[1] + Math.sin(ang) * len], br.path));
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lines) for (let i = 0; i < l.length; i += 2) drawDisc(ctx, l[i][0], l[i][1], 4, 4, 0x2840c0);
    ctx.restore();
    lines.forEach((l, li) => {
      for (let i = 0; i < l.length - 1; i++) {
        pixelLine(ctx, l[i][0] + 1, l[i][1], l[i + 1][0] + 1, l[i + 1][1], '#5a88ff');
        pixelLine(ctx, l[i][0], l[i][1], l[i + 1][0], l[i + 1][1], li ? '#b8d4ff' : '#ffffff');
      }
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    drawDisc(ctx, B[0], B[1], 7, 8, 0x3a5aff, 0xa8c8ff);
    ctx.restore();
  }
}

// layer 'ground': glows, rings and things lying on the ground (drawn before vehicles);
// layer 'air': everything that flies (drawn after vehicles), plus lightning and ropes.
export function drawFx(ctx, fx, view, layer, t) {
  if (layer === 'ground') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of fx.glows) { const [x, y] = view(g.x, g.y, g.z); drawDisc(ctx, x, y, g.r, Math.round(16 * g.a), parseInt(g.color.slice(1), 16)); }
    ctx.restore();
    for (const r of fx.rings) drawRing(ctx, r, view);
    for (const p of fx.parts) if (GROUND.has(p.kind)) drawPart(ctx, p, view);
    return;
  }
  for (const k of ['smoke', 'shimmer', 'fire', 'flame', 'debris', 'spark', 'ember']) for (const p of fx.parts) if (p.kind === k) drawPart(ctx, p, view);
  for (const b of fx.bolts) drawBolt(ctx, b, view, t);
}
