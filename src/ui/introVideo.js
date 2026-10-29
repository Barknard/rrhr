import { COLOR, TIMING } from './theme.js';

// The intro-video slot (assets/intro, see the README there): a video plays at the opening, blended into the title's
// lava backdrop (screen blend makes its black background see-through). Pure helpers first, then the browser player.
const NAME = /^[\w-]+\.(mp4|webm)$/i; // plain file names in that folder only
const SEEN_KEY = 'rrhr.introSeen';

export function normalizeIntro(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.video !== 'string' || !NAME.test(raw.video)) return null;
  const fallback = typeof raw.fallback === 'string' && NAME.test(raw.fallback) && raw.fallback !== raw.video ? raw.fallback : null;
  return { video: raw.video, blend: raw.blend === 'normal' ? 'normal' : 'screen', sound: raw.sound !== false, oncePerSession: raw.oncePerSession !== false, placement: raw.placement === 'afterGate' ? 'afterGate' : 'gate', fallback };
}

// The file to try after `current` failed (null = start): the local-only video first, then the public fallback.
export function nextSource(settings, current) {
  const list = [settings.video, settings.fallback].filter(Boolean);
  const i = current == null ? 0 : list.indexOf(current) + 1;
  return i > 0 || current == null ? list[i] ?? null : null;
}

// The sequence: fade in, play, fade out, done. Skip (or the video ending) goes to the fade-out; skip makes it fast.
export const createIntroState = () => ({ phase: 'in', t: 0, fast: false });
export function skipIntro(st) {
  if (st.phase === 'in' || st.phase === 'play') { st.phase = 'out'; st.t = 0; st.fast = true; }
  return st;
}
export function stepIntro(st, dt, ended = false) {
  st.t += dt;
  if (st.phase === 'in' && st.t >= TIMING.introFadeIn) { st.phase = 'play'; st.t = 0; }
  if (st.phase === 'play' && ended) { st.phase = 'out'; st.t = 0; }
  if (st.phase === 'out' && st.t >= (st.fast ? TIMING.introSkipOut : TIMING.introFadeOut)) { st.phase = 'done'; st.t = 0; }
  return st;
}
export function introAlpha(st) {
  if (st.phase === 'in') return Math.min(1, st.t / TIMING.introFadeIn);
  if (st.phase === 'out') return Math.max(0, 1 - st.t / (st.fast ? TIMING.introSkipOut : TIMING.introFadeOut));
  return st.phase === 'play' ? 1 : 0;
}

// Plays unless switched off, or already shown this session (when oncePerSession). Storage may throw or be junk.
export function shouldPlay(settings, storage) {
  if (!settings || settings.placement === 'gate') return false; // the gate placement plays on the gate itself, not after it
  if (!settings.oncePerSession) return true;
  try { return storage?.getItem(SEEN_KEY) !== '1'; } catch { return true; }
}
export function markPlayed(storage) { try { storage?.setItem(SEEN_KEY, '1'); } catch { /* not remembered */ } }

// The largest rectangle of the video's shape that fits inside w x h, centred ("contain").
export function containRect(vw, vh, w, h) {
  if (!(vw > 0) || !(vh > 0)) return null;
  const k = Math.min(w / vw, h / vh), dw = Math.round(vw * k), dh = Math.round(vh * k);
  return { x: Math.round((w - dw) / 2), y: Math.round((h - dh) / 2), w: dw, h: dh };
}

// The video fitted to the screen height, centred on x = cx (where the gate's pin-up stands).
export function gateVideoRect(vw, vh, h, cx) {
  if (!(vw > 0) || !(vh > 0)) return null;
  const w = Math.round(vw * h / vh);
  return { x: Math.round(cx - w / 2), y: 0, w, h };
}

// Calls onPlaying once, when the video has actually started (the `playing` event). A failed load never calls it.
export function watchPlaying(video, onPlaying) {
  let done = false;
  video.addEventListener('playing', () => { if (!done) { done = true; onPlaying(); } });
  return () => done;
}

// Browser only. Resolves the normalized settings or null (no file, bad JSON, switched off).
export async function loadIntroSettings(base = 'assets/intro/') {
  try {
    const res = await fetch(`${base}intro.json`, { cache: 'no-cache' });
    return res.ok ? normalizeIntro(await res.json()) : null;
  } catch { return null; }
}

// Browser only. start() must run inside the player's gate confirm (a key or click), so the browser allows playback.
export function createIntroPlayer(settings, { base = 'assets/intro/', lava = null, onPlaying = () => {} } = {}) {
  const video = document.createElement('video');
  video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto'; video.muted = !settings.sound;
  video.style.display = 'none';
  let ended = false, src = null;
  const finish = () => { ended = true; };
  const retryMuted = () => { video.muted = true; video.play()?.catch(() => {}); };
  const play = () => {
    src = nextSource(settings, src);
    if (!src) { finish(); return; }
    video.src = base + src;
    try { video.play()?.catch(settings.sound ? retryMuted : () => {}); } catch { finish(); }
  };
  watchPlaying(video, onPlaying);
  video.addEventListener('ended', finish);
  video.addEventListener('error', play); // the file isn't there (the public site has only the fallback): try the next
  return {
    start: play,
    get ended() { return ended; },
    stop() { try { video.pause(); } catch { /* gone */ } },
    draw(ctx, st, t = 0) {
      const { width: W, height: H } = ctx.canvas, a = introAlpha(st);
      ctx.fillStyle = COLOR.introBg; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = a;
      if (lava) { lava.draw(ctx, t, 0); ctx.fillStyle = COLOR.introVeil; ctx.fillRect(0, 0, W, H); }
      const r = video.readyState >= 2 ? containRect(video.videoWidth, video.videoHeight, W, H) : null;
      if (r) {
        ctx.globalCompositeOperation = settings.blend === 'screen' ? 'screen' : 'source-over';
        ctx.drawImage(video, r.x, r.y, r.w, r.h);
        ctx.globalCompositeOperation = 'source-over';
      }
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.6);
      g.addColorStop(0, 'transparent'); g.addColorStop(1, COLOR.introVignette);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    },
  };
}

// Browser only. The gate-placement player: muted, looping, started as soon as the settings load. draw() paints
// nothing until the video is really playing, so the gate shows the pin-up meanwhile (and for good if it fails).
export function createGateVideo(settings, { base = 'assets/intro/', cx = 140 } = {}) {
  const video = document.createElement('video');
  video.playsInline = true; video.setAttribute('playsinline', ''); video.muted = true; video.loop = true; video.preload = 'auto';
  video.style.display = 'none';
  let failed = false, src = null;
  const isPlaying = watchPlaying(video, () => {});
  const play = () => {
    src = nextSource(settings, src);
    if (!src) { failed = true; return; }
    video.src = base + src;
    try { video.play()?.catch(() => {}); } catch { failed = true; }
  };
  video.addEventListener('error', play); // the local-only file is missing: try the public fallback, else the pin-up stays
  return {
    start: play,
    get playing() { return !failed && isPlaying() && video.readyState >= 2 && video.currentTime > 0; },
    unmute() { if (settings.sound) { try { video.muted = false; } catch { /* stays muted */ } } },
    stop() { try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* gone */ } },
    draw(ctx) {
      const r = gateVideoRect(video.videoWidth, video.videoHeight, ctx.canvas.height, cx);
      if (!r) return;
      ctx.globalCompositeOperation = settings.blend === 'screen' ? 'screen' : 'source-over';
      ctx.drawImage(video, r.x, r.y, r.w, r.h);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
