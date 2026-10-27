import { CAR_STATS } from '../cars/carStats.js';
import { DRIVERS } from '../drivers/drivers.js';
import { SKILL } from '../drivers/skills.js';

// Online play: room codes, the build version, and the guest-to-host input packets.
//
// Room codes are 4 letters from an alphabet with no lookalikes (no B, I, L, O or S), so a code read out loud
// or off a phone is hard to get wrong. The host's PeerJS id is derived from it.
export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ';
export const CODE_LENGTH = 4;

export function makeRoomCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

export const peerIdFor = code => `rrhr-${code}`;

// Both sides must run the same game: a guest with different car or driver numbers would mispredict all race.
// The version is the protocol number plus a fingerprint of every number the race runs on, so a balance change
// alone is enough to tell two builds apart.
const PROTOCOL = 1;
const fnv = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193); return (h >>> 0).toString(36); };
export const NET_VERSION = `${PROTOCOL}-${fnv(JSON.stringify({ CAR_STATS, DRIVERS, SKILL }))}`;

// What a person typed (or a link carried) as a clean code, or null if it can't be one.
export function normalizeCode(text) {
  const code = String(text ?? '').toUpperCase().replace(/^RRHR-/, '').replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every(ch => CODE_ALPHABET.includes(ch)) ? code : null;
}

// Inputs travel as running press counts for fire, drop and nitro (plus the latest throttle and steer), so a tap
// that starts and ends between two packets still counts, and a lost, late or duplicated packet never adds or
// repeats a shot.
const PRESSES = ['fire', 'drop', 'nitro'];

export function createInputSender() {
  let seq = 0;
  const count = { fire: 0, drop: 0, nitro: 0 }, held = { fire: false, drop: false, nitro: false };
  return {
    // keys: what the local keyboard says this frame ({throttle, steer, fire, drop, nitro}, buttons held or not)
    packet(keys) {
      for (const k of PRESSES) {
        if (keys[k] && !held[k]) count[k]++;
        held[k] = !!keys[k];
      }
      return { seq: ++seq, throttle: keys.throttle ?? 0, steer: keys.steer ?? 0, ...count };
    },
  };
}

const clamp = v => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
const counter = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// Host side, one per guest seat. input() is called once per simulation step and turns new presses into
// one-step button presses, with a released step between two presses so the edge-triggered weapons see both.
export function createInputReceiver() {
  let latest = { throttle: 0, steer: 0, fire: 0, drop: 0, nitro: 0 };
  const used = { fire: 0, drop: 0, nitro: 0 }, wasDown = { fire: false, drop: false, nitro: false };
  const rx = {
    lastSeq: 0,
    accept(packet) {
      if (!packet || !Number.isFinite(packet.seq) || packet.seq <= rx.lastSeq) return false;
      rx.lastSeq = packet.seq;
      latest = { throttle: clamp(packet.throttle), steer: clamp(packet.steer), fire: counter(packet.fire), drop: counter(packet.drop), nitro: counter(packet.nitro) };
      return true;
    },
    input() {
      const out = { throttle: latest.throttle, steer: latest.steer };
      for (const k of PRESSES) {
        const down = !wasDown[k] && latest[k] > used[k];
        if (down) used[k]++;
        out[k] = down; wasDown[k] = down;
      }
      return out;
    },
  };
  return rx;
}
