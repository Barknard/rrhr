// Voxel model builder. Axes: +x = nose, y = width (0 = left side), z = up. Colours 0xRRGGBB.
// Materials: 'glass' (glossy streaks), 'chrome' (banded), 'emit' (lights, never shaded).
export function builder(sx, sy, sz) {
  const cells = new Map();
  const b = {
    set(x, y, z, c, m) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
      cells.set(`${x},${y},${z}`, { x, y, z, c, m });
    },
    box(x0, y0, z0, x1, y1, z1, c, m) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) b.set(x, y, z, c, m);
    },
    // Upright cylinder centred on (cx, cy) from z0 to z1.
    cyl(cx, cy, z0, z1, r, c, m) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        if (Math.hypot(x - cx, y - cy) <= r + 0.25) for (let z = z0; z <= z1; z++) b.set(x, y, z, c, m);
      }
    },
    mirror(y) { return sy - 1 - y; },
    done() { return { size: [sx, sy, sz], voxels: [...cells.values()] }; },
  };
  return b;
}

// Rotates a model (roll about x, then pitch about y, then yaw about z) around a pivot, for lean, swing
// and orbit variants. The x/y box is rebuilt symmetric about the pivot so the baker's anchor (the box
// centre) stays put across variants; z stays absolute. Cells are filled by inverse lookup, so no holes.
export function transform(model, { roll = 0, pitch = 0, yaw = 0, pivot } = {}) {
  const [sx, sy, sz] = model.size;
  const [px, py, pz] = pivot ?? [(sx - 1) / 2, (sy - 1) / 2, (sz - 1) / 2];
  const rot = (x, y, z, r, p, w) => {
    let c = Math.cos(r), s = Math.sin(r);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(p); s = Math.sin(p);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(w); s = Math.sin(w);
    return [x * c - y * s, x * s + y * c, z];
  };
  const inv = (x, y, z) => {
    let c = Math.cos(-yaw), s = Math.sin(-yaw);
    [x, y] = [x * c - y * s, x * s + y * c];
    c = Math.cos(-pitch); s = Math.sin(-pitch);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(-roll); s = Math.sin(-roll);
    return [x, y * c - z * s, y * s + z * c];
  };
  const src = new Map(model.voxels.map(v => [`${v.x},${v.y},${v.z}`, v]));
  let rx = 0, ry = 0, zmax = 0;
  for (const v of model.voxels) {
    const [x, y, z] = rot(v.x - px, v.y - py, v.z - pz, roll, pitch, yaw);
    rx = Math.max(rx, Math.abs(x)); ry = Math.max(ry, Math.abs(y)); zmax = Math.max(zmax, z + pz);
  }
  const hx = Math.ceil(rx + 0.5), hy = Math.ceil(ry + 0.5);
  const nx = 2 * hx + 1, ny = 2 * hy + 1, nz = Math.ceil(zmax + 0.5) + 1;
  const out = builder(nx, ny, nz);
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const [ox, oy, oz] = inv(x - hx, y - hy, z - pz);
    const v = src.get(`${Math.round(ox + px)},${Math.round(oy + py)},${Math.round(oz + pz)}`);
    if (v) out.set(x, y, z, v.c, v.m);
  }
  return out.done();
}
