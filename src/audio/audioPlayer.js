// Browser only: the Web Audio player for sfx, looping beds, music and announcer clips. Files live under base
// (assets/audio/sfx/<id>.mp3, assets/music/<name>.mp3, assets/audio/announcer/...). Every file loads once on
// first use and is cached; a missing or broken one is remembered as missing (silence, no retries, no errors).
// Nothing plays until there is an AudioContext: unlock() makes one from a user gesture (or pass ctx, for tests).
const PITCH_SPREAD = 0.08;    // every one-shot plays ±8% off pitch, so nothing sounds copy-pasted
const LOOP_TC = 0.05;         // s: time constant for loop gain / rate changes (no clicks)
const LOOP_OUT = 0.3;         // s: a stopped loop fades this long, then stops
const MUSIC_FADE = 1;         // s: music crossfade
const VOICE_LEAD = 0.02;      // s: a voice line starts this far ahead, so its clips line up exactly
const clamp01 = v => Math.max(0, Math.min(1, v));

export function createAudio({ base = 'assets/', ctx = null, fetchFn = globalThis.fetch?.bind(globalThis), rand = Math.random } = {}) {
  let ac = ctx, graph = null, held = false; // held: suspend() was asked for, so unlock() leaves it asleep
  const volumes = { music: 1, sfx: 1, voice: 1 };
  const files = new Map();   // path -> Promise<buffer | null>
  const ready = new Map();   // path -> buffer | null, once settled
  const wanted = new Set();  // preloads asked for before there was a context
  const loops = new Map();   // name -> { want: {id, gain, rate}, live: {id, src, g} | null, waiting }
  const voices = new Set();  // sequences playing or loading
  let musicWant = null, musicLive = null; // live: { name, src, g }

  const sfxPath = id => `audio/sfx/${id}.mp3`;
  const now = () => ac.currentTime;

  function bus() {
    if (graph || !ac) return graph;
    const master = ac.createGain();
    master.connect(ac.destination);
    graph = { master };
    for (const k of ['music', 'sfx', 'voice']) { const g = ac.createGain(); g.gain.value = volumes[k]; g.connect(master); graph[k] = g; }
    return graph;
  }

  function load(path) {
    if (!files.has(path)) {
      const p = Promise.resolve()
        .then(() => fetchFn(base + path))
        .then(r => (r?.ok ? r.arrayBuffer() : null))
        .then(ab => ab && new Promise((res, rej) => { const d = ac.decodeAudioData(ab, res, rej); d?.then?.(res, rej); }))
        .catch(() => null)
        .then(buf => { ready.set(path, buf ?? null); return buf ?? null; });
      files.set(path, p);
    }
    return files.get(path);
  }

  function source(buf, out, { loop = false, rate = 1, gain = 1 } = {}) {
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g); g.connect(out);
    return { src, g };
  }
  const fadeOut = ({ src, g }, secs, tc = secs / 3) => {
    g.gain.setTargetAtTime(0, now(), tc);
    try { src.stop(now() + secs); } catch { /* already stopped */ }
  };

  function realizeLoop(name) {
    const l = loops.get(name);
    if (!l || !bus()) return;
    const { id, gain, rate } = l.want, path = sfxPath(id);
    if (!ready.has(path)) {
      if (!l.waiting) { l.waiting = true; load(path).then(() => { l.waiting = false; if (loops.get(name) === l) realizeLoop(name); }); }
      return;
    }
    const buf = ready.get(path);
    if (l.live && l.live.id === id) {
      l.live.g.gain.setTargetAtTime(gain, now(), LOOP_TC);
      l.live.src.playbackRate.setTargetAtTime(rate, now(), LOOP_TC);
      return;
    }
    if (l.live) { fadeOut(l.live, LOOP_OUT); l.live = null; }
    if (!buf) return;
    const n = source(buf, graph.sfx, { loop: true, rate, gain: 0 });
    n.g.gain.setTargetAtTime(gain, now(), LOOP_TC);
    n.src.start();
    l.live = { id, ...n };
  }

  function realizeMusic() {
    if (!bus() || musicLive?.name === musicWant) return;
    if (musicLive) { fadeOut(musicLive, MUSIC_FADE, MUSIC_FADE / 3); musicLive = null; }
    const name = musicWant;
    if (!name) return;
    load(`music/${name}.mp3`).then(buf => {
      if (!buf || musicWant !== name || musicLive) return;
      const n = source(buf, graph.music, { loop: true, gain: 0 });
      n.g.gain.setValueAtTime(0, now());
      n.g.gain.linearRampToValueAtTime(1, now() + MUSIC_FADE);
      n.src.start();
      musicLive = { name, ...n };
    });
  }

  function stopLoopNow(name) {
    const l = loops.get(name);
    if (!l) return;
    loops.delete(name);
    if (l.live) fadeOut(l.live, LOOP_OUT);
  }

  return {
    // From a user gesture: make (once) and wake the AudioContext. false when there is no Web Audio.
    unlock() {
      if (!ac) {
        const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AC) return false;
        try { ac = new AC(); } catch { return false; }
      }
      if (!held && ac.state !== 'running') ac.resume?.()?.catch?.(() => {});
      bus();
      for (const id of wanted) load(sfxPath(id));
      wanted.clear();
      for (const name of loops.keys()) realizeLoop(name);
      realizeMusic();
      return true;
    },
    setVolumes(v = {}) {
      for (const k of ['music', 'sfx', 'voice']) {
        if (!Number.isFinite(v[k])) continue;
        volumes[k] = clamp01(v[k]);
        if (graph) graph[k].gain.setTargetAtTime(volumes[k], now(), 0.02);
      }
    },
    preload(ids) {
      for (const id of ids) if (bus()) load(sfxPath(id)); else wanted.add(id);
    },
    play(id, { gain = 1, rate = 1 } = {}) {
      if (!bus()) return;
      const path = sfxPath(id);
      if (!ready.has(path)) { load(path); return; }
      const buf = ready.get(path);
      if (!buf) return;
      const n = source(buf, graph.sfx, { gain, rate: rate * (1 + (rand() * 2 - 1) * PITCH_SPREAD) });
      n.src.start();
    },
    // Start or update a named looping sound (engine, lava bed, gate drone); call it every frame if you like.
    loop(name, id, { gain = 1, rate = 1 } = {}) {
      let l = loops.get(name);
      if (!l) loops.set(name, (l = { want: null, live: null, waiting: false }));
      l.want = { id, gain, rate };
      realizeLoop(name);
    },
    stopLoop: stopLoopNow,
    stopAllLoops() { for (const name of [...loops.keys()]) stopLoopNow(name); },
    // Crossfade to assets/music/<name>.mp3 (looping), or to silence with null.
    music(name) {
      name ??= null;
      if (name === musicWant) return;
      musicWant = name;
      realizeMusic();
    },
    // Voice clips (paths under base) back to back on the voice bus. Resolves when done, cut, or not playable.
    playSequence(paths, { gain = 1 } = {}) {
      if (!paths?.length || !bus()) return Promise.resolve();
      return new Promise(resolve => {
        const seq = { srcs: [], done: false };
        seq.finish = () => { if (seq.done) return; seq.done = true; voices.delete(seq); resolve(); };
        voices.add(seq);
        Promise.all(paths.map(load)).then(bufs => {
          if (seq.done) return;
          if (bufs.some(b => !b)) { seq.finish(); return; }
          const g = ac.createGain();
          g.gain.value = gain;
          g.connect(graph.voice);
          let t = now() + VOICE_LEAD;
          for (const buf of bufs) {
            const src = ac.createBufferSource();
            src.buffer = buf; src.connect(g); src.start(t);
            t += buf.duration;
            seq.srcs.push(src);
          }
          seq.srcs[seq.srcs.length - 1].onended = seq.finish;
        });
      });
    },
    stopVoice() {
      for (const seq of [...voices]) {
        for (const src of seq.srcs) { try { src.stop(); } catch { /* not started */ } }
        seq.finish();
      }
    },
    // Pause menu / hidden tab.
    suspend() { held = true; ac?.suspend?.()?.catch?.(() => {}); },
    resume() { held = false; ac?.resume?.()?.catch?.(() => {}); },
  };
}
