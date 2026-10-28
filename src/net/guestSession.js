import { createInputSender, NET_VERSION } from './protocol.js';
import { createRaceView, applySnapshot } from './snapshot.js';
import { createPredictor, interpolate, INTERP_DELAY } from './predict.js';
import { realClock } from './transport.js';
import { CAR_KEYS } from '../cars/carStats.js';
import { DRIVER_KEYS } from '../drivers/drivers.js';

// The host is a friend, but its messages still come off the network: anything outside the real roster (or a
// prototype key like 'constructor') would crash the guest's game, so a bad start is refused and a bad snapshot dropped.
const FORWARD = ['arc', 'saw', 'harpoon'], DROP = ['mine', 'napalm'];
const validEntrant = e => e && typeof e === 'object' && CAR_KEYS.includes(e.key) && DRIVER_KEYS.includes(e.driver)
  && FORWARD.includes(e.loadout?.forward) && DROP.includes(e.loadout?.drop) && typeof (e.name ?? '') === 'string';
const validStart = m => Array.isArray(m.entrants) && m.entrants.length >= 1 && m.entrants.length <= 4 && m.entrants.every(validEntrant)
  && Number.isInteger(m.seat) && m.seat >= -1 && m.seat < m.entrants.length && Number.isInteger(m.laps) && m.laps >= 1 && m.laps <= 20;
const validCar = c => c && Number.isFinite(c.x) && Number.isFinite(c.y) && c.charges && typeof c.charges === 'object'
  && FORWARD.includes(c.loadout?.forward) && DROP.includes(c.loadout?.drop)
  && (c.fly === undefined || (c.fly && Number.isFinite(c.fly.t) && Number.isFinite(c.fly.spin)));
// every { car: id } inside events and entities must name a car that exists, or the effects code would trip on it
const refsOk = (v, n, depth = 0) => {
  if (depth > 8) return false;
  if (Array.isArray(v)) return v.every(x => refsOk(x, n, depth + 1));
  if (!v || typeof v !== 'object') return true;
  const keys = Object.keys(v);
  if (keys.length === 1 && keys[0] === 'car') return Number.isInteger(v.car) && v.car >= 0 && v.car < n;
  return keys.every(k => refsOk(v[k], n, depth + 1));
};
const validSnap = (s, view) => s && Array.isArray(s.cars) && s.cars.length === view.cars.length && s.cars.every(validCar)
  && Array.isArray(s.entities) && Array.isArray(s.events) && Array.isArray(s.crates) && Array.isArray(s.finishOrder)
  && s.finishOrder.every(id => Number.isInteger(id) && id >= 0 && id < view.cars.length) && Number.isFinite(s.time)
  && refsOk(s.events, view.cars.length) && refsOk(s.entities, view.cars.length);
const cleanSeat = s => ({
  name: String(s.name ?? '').slice(0, 12), playerId: String(s.playerId ?? '').slice(0, 40),
  driver: DRIVER_KEYS.includes(s.driver) ? s.driver : null, vehicle: CAR_KEYS.includes(s.vehicle) ? s.vehicle : null,
  loadout: { forward: FORWARD.includes(s.loadout?.forward) ? s.loadout.forward : 'arc', drop: DROP.includes(s.loadout?.drop) ? s.loadout.drop : 'mine' },
  ready: !!s.ready, connected: s.connected !== false, host: !!s.host,
});

// A host that has gone quiet mid-race has left, even if the connection hasn't said so yet (long enough that a host
// switching windows for a moment, which pauses their game, doesn't end everyone's race). The first snapshot
// gets longer: the host may still be loading the vehicles.
export const HOST_SILENCE = 8, FIRST_SNAPSHOT_WAIT = 15; // s

// A guest's side of an online race: says hello, sends its picks and READY, then during the race sends an input
// packet every frame, predicts its own car, pours the host's snapshots into a local race view and draws the
// other cars slightly in the past so they move smoothly. The view is shaped like a race, so the normal renderer,
// HUD and effects draw it. peer: the transport's connection to the host.
export function createGuestSession({ peer, track, playerId, name, clock = realClock }) {
  let sender = createInputSender(), startedAt = 0, snapCars = null;
  const g = {
    seat: null, seats: [], view: null, error: null, hostLeft: false, started: false, starts: 0,
    captions: [], history: [], predictor: null, lastSnap: null,
    pick(choice) { peer.send({ t: 'pick', driver: choice.driver, vehicle: choice.vehicle, loadout: choice.loadout }); },
    ready(on) { peer.send({ t: 'ready', ready: !!on }); },
    // Quit the race back to the lobby (a CPU takes the car on the host).
    leaveRace() { peer.send({ t: 'leave-race' }); dropRace(); },
    // Once per frame in a race: send this frame's keys, step the prediction, place the cars to draw.
    frame(dt, keys) {
      const v = g.view;
      if (!v) return;
      const mine = g.seat >= 0 ? v.cars[g.seat] : null;
      if (mine && v.phase === 'racing') {
        const packet = sender.packet(keys);
        peer.send({ t: 'input', ...packet });
        g.predictor.input(packet, dt);
      }
      const quiet = (clock.now - (g.lastSnap?.at ?? startedAt)) / 1000;
      if (quiet > (g.lastSnap ? HOST_SILENCE : FIRST_SNAPSHOT_WAIT)) g.hostLeft = true;
      place();
    },
    close() { peer.close(); },
  };

  // Where each car is drawn: your own where your prediction has it, everyone else a moment in the past. Done
  // every frame and again the moment a snapshot lands, so the host's raw positions are never what's on screen.
  function place() {
    const v = g.view;
    if (!v || !g.lastSnap) return;
    const mine = g.seat >= 0 ? v.cars[g.seat] : null;
    const hostNow = g.lastSnap.time + (clock.now - g.lastSnap.at) / 1000; // the host's clock, from the newest snapshot
    const placed = interpolate(g.history, hostNow - INTERP_DELAY);
    v.cars.forEach((c, i) => {
      if (c === mine) { if (g.predictor.active) Object.assign(c, g.predictor.displayed()); }
      else if (placed && !c.wrecked) Object.assign(c, placed[i]);
      carryAttachments(c, snapCars[i]);
    });
  }
  // Trailers and the wrecking ball come in the snapshot at the host's newest position; they move with the cab
  // by however far the cab is drawn from there.
  function carryAttachments(c, s) {
    const dx = c.x - s.x, dy = c.y - s.y, dz = c.z - s.z;
    if (s.trailers && c.trailers) c.trailers.forEach((t, k) => { const o = s.trailers[k]; if (o) Object.assign(t, { x: o.x + dx, y: o.y + dy, z: o.z + dz }); });
    if (s.ball && c.ball) Object.assign(c.ball, { x: s.ball.x + dx, y: s.ball.y + dy, z: s.ball.z + dz });
  }
  function dropRace() {
    g.view = null; g.started = false; g.predictor = null; g.lastSnap = null; g.history = []; snapCars = null;
  }

  peer.onMessage(msg => {
    switch (msg?.t) {
      case 'welcome': g.seat = msg.seat; break;
      case 'lobby': if (Array.isArray(msg.seats)) g.seats = msg.seats.filter(s => s && typeof s === 'object').slice(0, 4).map(cleanSeat); break;
      case 'full': g.error = 'full'; break;
      case 'busy': g.error = 'busy'; break;
      case 'version': g.error = 'version'; break;
      case 'back': dropRace(); g.captions = []; break;
      case 'start':
        if (!validStart(msg)) { g.error = 'bad-start'; break; }
        dropRace();
        g.seat = msg.seat; g.started = true; g.starts++; startedAt = clock.now;
        g.view = createRaceView(track, msg.entrants);
        g.view.laps = msg.laps;
        g.captions = [];
        sender = createInputSender(); // the host counts presses from zero each race
        if (g.seat >= 0) g.predictor = createPredictor(track, g.view.cars[g.seat].stats);
        break;
      case 'snap': {
        if (!g.view) break;
        const s = msg.snap;
        if (!validSnap(s, g.view)) break;
        try { applySnapshot(g.view, s); } catch { break; } // a malformed snapshot is skipped; the next one fixes things
        snapCars = s.cars.map(c => ({ x: c.x, y: c.y, z: c.z ?? 0, trailers: c.trailers?.map(t => ({ ...t })), ball: c.ball && { ...c.ball } }));
        g.history.push({ time: s.time, cars: s.cars.map(c => ({ x: c.x, y: c.y, z: c.z, h: c.h })) });
        while (g.history.length > 2 && g.history[0].time < s.time - 1) g.history.shift();
        g.lastSnap = { time: s.time, at: clock.now };
        if (g.seat >= 0) {
          const c = s.cars[g.seat];
          g.predictor.reconcile({ x: c.x, y: c.y, z: c.z, vx: c.vx, vy: c.vy, vz: c.vz, heading: c.h, grounded: c.g, fallen: c.f, flying: !!c.fly, wrecked: c.w, boostTimer: c.boost }, msg.ack);
        }
        if (Array.isArray(msg.captions)) g.captions.push(...msg.captions.filter(c => typeof c === 'string').map(c => c.slice(0, 300)));
        place();
        break;
      }
      default: break;
    }
  });
  peer.onClose(() => { g.hostLeft = true; });
  peer.send({ t: 'hello', playerId, name, v: NET_VERSION });
  return g;
}
