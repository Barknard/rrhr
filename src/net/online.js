import { makeRoomCode } from './protocol.js';
import { createBroadcastHost, connectBroadcast } from './transport.js';
import { createPeerHost, connectPeer } from './peerTransport.js';
import { createHostSession } from './hostSession.js';
import { createGuestSession } from './guestSession.js';

// Browser glue for online play: picks the transport (the internet via PeerJS, or ?local for two tabs on one
// machine), optionally fakes latency (?lag=120 adds 120 ms each way, with a little jitter) and turns
// "host" / "join CODE" into a running host or guest session.
export function onlineOptions(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  return { local: q.has('local'), lag: Math.max(0, Number(q.get('lag')) || 0) };
}

// Delays everything this side sends by ms (+ up to 25% jitter), keeping the order, like a slow connection.
export function withLag(peer, ms) {
  if (!ms) return peer;
  let lastAt = 0;
  return {
    id: peer.id,
    send(msg) {
      const now = performance.now(), at = Math.max(lastAt, now + ms + Math.random() * ms * 0.25);
      lastAt = at;
      setTimeout(() => peer.send(msg), at - now);
    },
    onMessage: fn => peer.onMessage(fn), onClose: fn => peer.onClose(fn), close: () => peer.close(),
  };
}

export function createOnline({ track, playerId, opts = onlineOptions() }) {
  return {
    opts,
    // Resolves { code, session } once the room exists.
    async host(name) {
      for (let tries = 0; ; tries++) {
        const code = makeRoomCode();
        try {
          const raw = opts.local ? createBroadcastHost(code) : await createPeerHost(code);
          const transport = { onJoin: fn => raw.onJoin(p => fn(withLag(p, opts.lag))), onLeave: fn => raw.onLeave(fn), close: () => raw.close() };
          return { code, session: createHostSession({ transport, track, me: { playerId, name } }) };
        } catch (err) {
          if (err.message !== 'code-taken' || tries >= 5) throw err; // someone else has this code right now: roll another
        }
      }
    },
    // Resolves the guest session once the host has given us a seat; rejects with a reason the join screen shows.
    async join(code, name) {
      const peer = opts.local ? await connectBroadcast(code) : await connectPeer(code);
      const guest = createGuestSession({ peer: withLag(peer, opts.lag), track, playerId, name });
      const t0 = performance.now();
      while (guest.seat === null && !guest.error && !guest.hostLeft && performance.now() - t0 < 5000) await new Promise(r => setTimeout(r, 30));
      if (guest.seat === null) { guest.close(); throw new Error(guest.error ?? 'timeout'); }
      return guest;
    },
  };
}

// A stable id per browser (seasons use it later to give a returning friend their seat back).
export function playerIdFrom(storage) {
  try {
    let id = storage?.getItem('rrhr.playerId');
    if (!id) { id = `p-${Math.random().toString(36).slice(2, 12)}`; storage?.setItem('rrhr.playerId', id); }
    return id;
  } catch { return `p-${Math.random().toString(36).slice(2, 12)}`; }
}
