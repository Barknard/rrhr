// Transports: how messages get between the host and guests. Every kind offers the same shape:
//   host side:  { onJoin(fn(peer)), onLeave(fn(peerId)), close() }
//   a peer:     { id, send(msg), onMessage(fn(msg)), onClose(fn), close() }
//   guest side: connect() -> Promise<peer for the host>, rejecting with Error('no-host') when nobody hosts the room
// Kinds: a loopback hub (tests, with fake lag, jitter and loss on a controllable clock), BroadcastChannel (two
// tabs on one machine, for playtesting without the internet) and PeerJS (the internet; see peerTransport.js).

// A clock tests can step by hand. Timers fire in time order as advance() passes them.
export function createManualClock() {
  const timers = [];
  let seq = 0;
  const clock = {
    now: 0,
    setTimeout(fn, ms) { timers.push({ at: clock.now + Math.max(0, ms), fn, seq: seq++ }); },
    advance(ms) {
      const until = clock.now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
        if (!timers.length || timers[0].at > until) break;
        const t = timers.shift();
        clock.now = t.at;
        t.fn();
      }
      clock.now = until;
    },
  };
  return clock;
}

export const realClock = { get now() { return performance.now(); }, setTimeout: (fn, ms) => setTimeout(fn, ms) };

function endpoint(id) {
  const handlers = [], closers = [];
  return { id, handlers, closers, closed: false, onMessage: fn => handlers.push(fn), onClose: fn => closers.push(fn) };
}

// lagMs / jitterMs: one-way delay and its random spread. The channel stays ordered (like PeerJS's reliable
// channel) unless dropRate > 0, which models an unreliable one that loses that share of messages.
export function createLoopbackHub({ clock = realClock, lagMs = 0, jitterMs = 0, dropRate = 0, rng = Math.random } = {}) {
  let host = null, nextId = 1;
  const link = (from, to) => {
    let lastAt = 0;
    return msg => {
      if (from.closed || to.closed || (dropRate > 0 && rng() < dropRate)) return;
      const copy = structuredClone(msg);
      const at = Math.max(lastAt, clock.now + lagMs + rng() * jitterMs);
      lastAt = at;
      clock.setTimeout(() => { if (!to.closed) for (const h of to.handlers) h(copy); }, at - clock.now);
    };
  };
  return {
    host() {
      const joins = [], leaves = [], guests = new Set();
      host = {
        guests, joins, leaves,
        onJoin: fn => joins.push(fn), onLeave: fn => leaves.push(fn),
        close() { host = null; for (const g of guests) g.hangUp(); },
      };
      return host;
    },
    guest() {
      const closers = [];
      return {
        onClose: fn => closers.push(fn),
        connect() {
          if (!host) return Promise.reject(new Error('no-host'));
          const h = host, id = `guest-${nextId++}`;
          const mine = endpoint('host'), theirs = endpoint(id); // mine: the guest's handle on the host
          mine.send = link(mine, theirs); theirs.send = link(theirs, mine);
          const hangUp = () => { mine.closed = theirs.closed = true; for (const fn of [...closers, ...mine.closers]) fn(); };
          mine.close = () => { if (mine.closed) return; mine.closed = theirs.closed = true; h.guests.delete(record); for (const fn of h.leaves) fn(id); };
          theirs.close = () => { h.guests.delete(record); hangUp(); };
          const record = { hangUp };
          h.guests.add(record);
          for (const fn of h.joins) fn(theirs);
          return Promise.resolve(mine);
        },
      };
    },
  };
}

// ---------- BroadcastChannel: two tabs (or two windows) on the same machine ----------
const channelName = room => `rrhr-room-${room}`;
const randomId = () => `tab-${Math.random().toString(36).slice(2, 10)}`;

export function createBroadcastHost(room) {
  const bc = new BroadcastChannel(channelName(room)), peers = new Map(), joins = [], leaves = [];
  const post = m => bc.postMessage(m);
  bc.onmessage = ({ data: m }) => {
    if (m.kind === 'hello' && !peers.has(m.from)) {
      const p = endpoint(m.from);
      p.send = data => post({ kind: 'msg', from: 'host', to: p.id, data });
      p.close = () => { post({ kind: 'bye', from: 'host', to: p.id }); peers.delete(p.id); };
      peers.set(p.id, p);
      post({ kind: 'welcome', to: p.id });
      for (const fn of joins) fn(p);
    } else if (m.kind === 'msg' && m.to === 'host') {
      for (const h of peers.get(m.from)?.handlers ?? []) h(m.data);
    } else if (m.kind === 'bye' && peers.has(m.from)) {
      peers.delete(m.from);
      for (const fn of leaves) fn(m.from);
    }
  };
  return {
    onJoin: fn => joins.push(fn), onLeave: fn => leaves.push(fn),
    close() { post({ kind: 'bye', from: 'host' }); bc.close(); },
  };
}

export function connectBroadcast(room, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const bc = new BroadcastChannel(channelName(room)), id = randomId(), hostPeer = endpoint('host');
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; bc.close(); reject(new Error('no-host')); } }, timeoutMs);
    hostPeer.send = data => { if (!hostPeer.closed) bc.postMessage({ kind: 'msg', from: id, to: 'host', data }); };
    hostPeer.close = () => { if (hostPeer.closed) return; hostPeer.closed = true; bc.postMessage({ kind: 'bye', from: id }); bc.close(); };
    bc.onmessage = ({ data: m }) => {
      if (m.kind === 'welcome' && m.to === id && !done) { done = true; clearTimeout(timer); resolve(hostPeer); }
      else if (m.kind === 'msg' && m.to === id) { for (const h of hostPeer.handlers) h(m.data); }
      else if (m.kind === 'bye' && m.from === 'host' && (!m.to || m.to === id)) {
        hostPeer.closed = true; bc.close();
        for (const fn of hostPeer.closers) fn();
      }
    };
    bc.postMessage({ kind: 'hello', from: id });
  });
}
