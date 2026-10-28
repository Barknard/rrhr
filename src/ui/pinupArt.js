import { shimmySway } from './pinup.js';

// The import slot for HD pin-up art. Drop a still into assets/pinup/ and name it in assets/pinup/pinup.json; the
// gate then draws that image instead of the painted girl, with the same bounce, shimmy and tease (see the README
// there). With no image named, or if anything fails to load, the painted girl stays.
const NAME = /^[\w-]+\.(png|webp|gif)$/i; // plain file names in that folder only
const DEFAULT_CHEST = [0.32, 0.56];       // fractions of her height: the band that trails her hops

export function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.image !== 'string' || !NAME.test(raw.image)) return null;
  const c = raw.chest;
  const chest = Array.isArray(c) && c.length === 2 && c.every(Number.isFinite) && c[0] >= 0 && c[0] < c[1] && c[1] <= 1 ? [c[0], c[1]] : [...DEFAULT_CHEST];
  const poses = {};
  for (const k of ['tease', 'snap', 'wag']) if (typeof raw.poses?.[k] === 'string' && NAME.test(raw.poses[k])) poses[k] = raw.poses[k];
  return { image: raw.image, poses, chest, pixelated: raw.pixelated !== false };
}

// How each drawn row of an imported image moves this frame: dx (the shimmy, scaled from the painted girl's
// 320-row sway) and dy (the chest band trailing her hop, with soft edges). h: the drawn height in pixels.
export function artRows(h, chest, motion) {
  const dx = new Int16Array(h), dy = new Int16Array(h), k = h / 320;
  const c0 = chest[0] * h, c1 = chest[1] * h, soft = Math.max(1, (c1 - c0) * 0.25);
  for (let y = 0; y < h; y++) {
    const w = Math.max(0, Math.min(1, (y - c0) / soft, (c1 - y) / soft));
    dx[y] = Math.round((shimmySway(y / k) * motion.shimmy.s + 5 * w * motion.shimmy.lag) * k);
    dy[y] = Math.round(motion.bust * k * w);
  }
  return { dx, dy };
}

// Browser only. Resolves the art ({ ...manifest, img, poseImgs }) or null to keep the painted girl.
export async function loadPinupArt(base = 'assets/pinup/') {
  try {
    const res = await fetch(`${base}pinup.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const m = normalizeManifest(await res.json());
    if (!m) return null;
    const load = name => new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = base + name; });
    const img = await load(m.image), poseImgs = {};
    for (const [k, name] of Object.entries(m.poses)) { try { poseImgs[k] = await load(name); } catch { /* that pose uses the main image */ } }
    return { ...m, img, poseImgs };
  } catch { return null; }
}
