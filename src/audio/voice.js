// Mel's voice: an announcer utterance -> the recorded clips that say it. Pure lookups first, then the player glue.
// tools/elevenlabs.mjs cuts each line at its placeholders and writes assets/audio/announcer/manifest.json; a
// placeholder is spoken by say_<kind>_<slug of the value>.mp3, if that value was recorded at all.
const DIR = 'audio/announcer/';

// The tool's slug rule: 'HOG & HITCH' -> 'hog_and_hitch', lap 3 -> '3'.
export const voiceSlug = value => String(value ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// -> ['audio/announcer/<clip>.mp3', ...] in speaking order, or null when any piece has no clip (an unknown line, or
// a value nobody recorded, like a typed online name): the caption still shows, the voice stays quiet.
export function voiceClips(manifest, utterance) {
  const parts = manifest?.lines?.[utterance?.trigger]?.[utterance?.index];
  if (!Array.isArray(parts)) return null;
  const paths = [];
  for (const p of parts) {
    if (p.clip) { paths.push(`${DIR}${p.clip}.mp3`); continue; }
    const id = voiceSlug(utterance.vars?.[p.slot]);
    if (!id || !manifest.values?.[p.kind]?.some(v => v.id === id)) return null;
    paths.push(`${DIR}say_${p.kind}_${id}.mp3`);
  }
  return paths;
}

const fetchManifest = () => fetch('assets/audio/announcer/manifest.json').then(r => {
  if (!r.ok) throw new Error(`announcer manifest: ${r.status}`);
  return r.json();
});

// audio: { playSequence(paths, { gain }) -> Promise, stopVoice() }. The announcer already decides priority and
// pacing, so the newest line always wins. The manifest loads once, on the first line; if that fails Mel stays a
// caption for the session (no retries).
export function createVoice({ audio, loadManifest = fetchManifest, gain = 1 } = {}) {
  let manifest = null, loading = null, turn = 0;
  const load = () => (loading ??= (async () => { try { manifest = await loadManifest(); } catch { manifest = null; } })());
  return {
    async speak(utterance) {
      const mine = ++turn;
      audio.stopVoice();
      await load();
      if (mine !== turn) return; // a newer line (or stop) arrived while the manifest loaded
      const paths = voiceClips(manifest, utterance);
      if (!paths) return;
      try { await audio.playSequence(paths, { gain }); } catch { /* a missing or broken clip: just quiet */ }
    },
    stop() { turn++; audio.stopVoice(); },
  };
}
