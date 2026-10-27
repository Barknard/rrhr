// The mini map: the track's centreline in the same isometric view as the game, fitted into a small box,
// with a dot for every car. createMinimap is pure (the outline is computed once per track); drawMinimap paints it.
export function createMinimap(track, { w = 120, h = 76, pad = 4 } = {}) {
  const iso = (gx, gy) => [gx - gy, (gx + gy) / 2];
  const raw = [];
  for (let s = 0; s < track.length; s += 0.5) {
    const p = track.pointAt(s), q = track.project(p.x, p.y);
    raw.push([...iso(p.x, p.y), track.inPit(q.seg, q.t) ? 'pit' : 'road']);
  }
  const xs = raw.map(r => r[0]), ys = raw.map(r => r[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const k = Math.min((w - 2 * pad) / (Math.max(...xs) - x0), (h - 2 * pad) / (Math.max(...ys) - y0));
  const ox = pad + ((w - 2 * pad) - (Math.max(...xs) - x0) * k) / 2, oy = pad + ((h - 2 * pad) - (Math.max(...ys) - y0) * k) / 2;
  const fit = ([ix, iy]) => [ox + (ix - x0) * k, oy + (iy - y0) * k];
  const toMap = (gx, gy) => fit(iso(gx, gy));
  const s0 = track.pointAt(0);
  return { w, h, path: raw.map(r => [...fit(r), r[2]]), toMap, start: toMap(s0.x, s0.y) };
}

// x, y: top-left of the map on screen. The player's dot blinks white so you can always find yourself.
export function drawMinimap(ctx, mm, race, player, t, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, mm.w, mm.h);
  for (const [px, py, kind] of mm.path) {
    ctx.fillStyle = kind === 'pit' ? '#ff4a1a' : '#6a6070';
    ctx.fillRect(Math.round(x + px) - 1, Math.round(y + py) - 1, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x + mm.start[0]) - 1, Math.round(y + mm.start[1]) - 2, 2, 4); // start/finish
  const order = [...race.cars].sort((a, b) => (a === player) - (b === player)); // you on top
  for (const car of order) {
    if (car.wrecked) continue;
    const [cx, cy] = mm.toMap(car.x, car.y), mx = Math.round(x + cx), my = Math.round(y + cy);
    if (car === player) {
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffffff' : '#000000';
      ctx.fillRect(mx - 3, my - 3, 6, 6);
    }
    ctx.fillStyle = car.color ?? '#ffffff';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }
}
