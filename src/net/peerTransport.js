import { peerIdFor } from './protocol.js';

// The internet transport: WebRTC data channels via PeerJS, with the free public PeerJS broker only used to
// find each other by room code. Same shape as the transports in transport.js. Browser-only: index.html loads
// PeerJS (window.Peer). Optional relay (TURN) servers for strict networks: set window.RRHR_ICE_SERVERS to an
// RTCIceServer list before the game starts.
const peerOptions = () => (globalThis.RRHR_ICE_SERVERS ? { config: { iceServers: globalThis.RRHR_ICE_SERVERS } } : {});

// Plain-word reasons for the join and host screens.
const reason = err => ({
  'peer-unavailable': 'no-host', 'unavailable-id': 'code-taken', network: 'offline', 'server-error': 'offline',
  'socket-error': 'offline', 'socket-closed': 'offline', 'browser-incompatible': 'unsupported',
}[err?.type] ?? 'failed');

function wrap(conn) {
  const peer = {
    id: conn.peer,
    send(msg) { if (conn.open) conn.send(msg); },
    onMessage(fn) { conn.on('data', fn); },
    onClose(fn) { conn.on('close', fn); },
    close() { conn.close(); },
  };
  return peer;
}

// Resolves once the broker has given us the room's id; rejects with 'code-taken' (pick another code) or 'offline'.
export function createPeerHost(code, { Peer = globalThis.Peer } = {}) {
  return new Promise((resolve, reject) => {
    if (!Peer) { reject(new Error('unsupported')); return; }
    const p = new Peer(peerIdFor(code), peerOptions()), joins = [], leaves = [];
    let open = false;
    p.on('open', () => {
      open = true;
      resolve({ code, onJoin: fn => joins.push(fn), onLeave: fn => leaves.push(fn), close: () => p.destroy() });
    });
    p.on('connection', conn => {
      conn.on('open', () => { const peer = wrap(conn); for (const fn of joins) fn(peer); });
      conn.on('close', () => { for (const fn of leaves) fn(conn.peer); });
    });
    p.on('error', err => { if (!open) { p.destroy(); reject(new Error(reason(err))); } });
  });
}

// Resolves with the host's peer; rejects with 'no-host' (wrong code or the race is gone), 'offline' or 'timeout'.
export function connectPeer(code, { Peer = globalThis.Peer, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!Peer) { reject(new Error('unsupported')); return; }
    const p = new Peer(undefined, peerOptions());
    let done = false;
    const fail = why => { if (!done) { done = true; p.destroy(); reject(new Error(why)); } };
    const timer = setTimeout(() => fail('timeout'), timeoutMs);
    p.on('open', () => {
      const conn = p.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        if (done) return;
        done = true; clearTimeout(timer);
        const peer = wrap(conn);
        const close = peer.close;
        peer.close = () => { close(); p.destroy(); };
        resolve(peer);
      });
    });
    p.on('error', err => fail(reason(err)));
  });
}
