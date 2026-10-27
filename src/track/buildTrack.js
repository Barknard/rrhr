import { hash } from '../core/iso.js';

// The road is every point within halfWidth of the centerline polyline, so its edges are
// smooth lines and round outer corners. Tiles exist only for drawing the scenery.
export function buildTrack(def) {
  const pts = def.points, n = pts.length;
  const halfWidth = def.width / 2;
  const segs = [];
  let length = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay, ah] = pts[i], [bx, by, bh] = pts[(i + 1) % n];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, ah, bx, by, bh, len, ux: (bx - ax) / len, uy: (by - ay) / len, s0: length });
    length += len;
  }

  function project(x, y) {
    let best = null;
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i];
      const t = Math.max(0, Math.min(1, ((x - g.ax) * g.ux + (y - g.ay) * g.uy) / g.len));
      const px = g.ax + g.ux * g.len * t, py = g.ay + g.uy * g.len * t;
      const dist = Math.hypot(x - px, y - py);
      if (!best || dist < best.dist) best = { s: g.s0 + t * g.len, h: g.ah + (g.bh - g.ah) * t, dist, seg: i, t, px, py };
    }
    return best;
  }

  function pointAt(s) {
    s = ((s % length) + length) % length;
    let i = 0;
    while (i < segs.length - 1 && s > segs[i].s0 + segs[i].len) i++;
    const g = segs[i], t = (s - g.s0) / g.len;
    return { x: g.ax + (g.bx - g.ax) * t, y: g.ay + (g.by - g.ay) * t, h: g.ah + (g.bh - g.ah) * t, dir: Math.atan2(g.uy, g.ux) };
  }

  const inPit = (seg, t) => def.pits.some(p => p.seg === seg && t >= p.t0 && t <= p.t1);
  const surfaceOf = p => (p.dist > halfWidth ? null : inPit(p.seg, p.t) ? 'pit' : 'road');
  const surfaceAt = (gx, gy) => surfaceOf(project(gx, gy));
  const isDrivable = (gx, gy) => surfaceAt(gx, gy) !== null;
  function groundAt(gx, gy) {
    const p = project(gx, gy);
    const s = surfaceOf(p);
    return s === null ? null : s === 'pit' ? -Infinity : p.h;
  }

  // Scenery tiles for the renderer. A tile any part of which touches the road is a road tile
  // (drawn at the road's height); the renderer decides road vs shoulder per pixel.
  const size = def.size;
  const tiles = [];
  for (let x = 0; x < size; x++) {
    tiles.push([]);
    for (let y = 0; y < size; y++) {
      const c = project(x + 0.5, y + 0.5);
      let tile;
      if (c.dist <= halfWidth + 0.72) tile = { type: inPit(c.seg, c.t) && c.dist <= halfWidth ? 'pit' : 'road', h: Math.round(c.h / 2) * 2 };
      else if (def.lava.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1)) tile = { type: 'lava', h: 0 };
      else if (c.dist > halfWidth + 2 && hash(x, y, def.seed) < 0.12) tile = { type: 'rock', h: 16 + Math.floor(hash(x, y, def.seed + 2) * 3) * 7 };
      else tile = { type: 'ground', h: 0 };
      tiles[x].push(tile);
    }
  }
  const tileAt = (gx, gy) => tiles[Math.floor(gx)]?.[Math.floor(gy)] ?? null;

  return { def, size, halfWidth, tiles, segs, length, project, pointAt, tileAt, surfaceAt, groundAt, isDrivable, inPit };
}
