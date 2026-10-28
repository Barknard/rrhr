import { withToLayer } from '../render/world/bakeWorld.js';

// A baked world costs several seconds and about 140 MB, so keep only the few in use (this race, the next one).
// bake(key) -> Promise<world>. Least recently requested is evicted first. A failed bake is forgotten (can retry).
// fallback(key), if given, builds the world on this thread when the bake fails (no workers). Only get() may run it,
// never prefetch(): a speculative prefetch must not freeze the page. Its result is cached like any other.
export function createWorldCache({ bake, fallback, keep = 2 }) {
  const worlds = new Map(); // key -> { p: Promise<world>, fb: fallback already attached }; oldest request first
  function request(key, allowFallback) {
    let e = worlds.get(key);
    if (e) worlds.delete(key); // re-inserted below as the most recent
    else e = { p: Promise.resolve().then(() => bake(key)), fb: false };
    if (allowFallback && fallback && !e.fb) e = { p: e.p.catch(() => fallback(key)), fb: true };
    const mine = e;
    mine.p.catch(() => { if (worlds.get(key) === mine) worlds.delete(key); });
    worlds.set(key, mine);
    while (worlds.size > keep) worlds.delete(worlds.keys().next().value);
    return mine.p;
  }
  return { get: key => request(key, true), prefetch: key => { request(key, false).catch(() => {}); }, has: key => worlds.has(key) };
}

// The browser's bake: one worker per world, ended when it answers.
export function workerBake(key) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../render/world/worldWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = e => { resolve(withToLayer(e.data)); worker.terminate(); };
      worker.onerror = err => { worker.terminate(); reject(err); };
      worker.postMessage({ track: key });
    } catch (err) { reject(err); }
  });
}
