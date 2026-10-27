// Counts a lap only when the car passes the four quarter checkpoints in order
// and then wraps over the start line going forward. Reversing or cutting never counts.
export function createLapTracker(track) {
  const L = track.length;
  let expected = 1;   // next quarter checkpoint we need (0 = the finish line)
  let prevS = null, prevQ = 0;
  const lt = {
    lap: 0,
    progress: 0,
    update(x, y) {
      const s = track.project(x, y).s;
      const q = Math.min(3, Math.floor((s / L) * 4));
      let event = null;
      const wrappedForward = prevS !== null && prevS > 0.9 * L && s < 0.1 * L;
      if (expected === 0 && wrappedForward) {
        lt.lap++; expected = 1; event = 'lap';
      } else if (expected !== 0 && q === expected && prevQ === expected - 1) {
        // only a forward crossing of the quarter boundary counts, never arriving backwards
        expected = (expected + 1) % 4;
      }
      prevS = s; prevQ = q;
      lt.progress = s / L;
      return event;
    },
  };
  return lt;
}
