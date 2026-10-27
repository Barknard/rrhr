import { createRace, stepRace } from '../game/race.js';
import { cpuInput } from '../ai/cpuDriver.js';
import { CAR_STATS, CAR_KEYS } from '../cars/carStats.js';
import { DRIVERS, DRIVER_KEYS } from '../drivers/drivers.js';
import { createInputReceiver, NET_VERSION } from './protocol.js';
import { snapshot } from './snapshot.js';

// The host runs the real race. It keeps the lobby (up to 4 seats, the host in seat 0), turns each guest's
// input packets into car inputs, fills empty or unready seats with CPU drivers, and every SNAPSHOT_EVERY steps
// sends each guest the race, the events since the last snapshot, the announcer's captions, and how far it got
// through that guest's inputs (ack, for the guest's prediction).
//
// Messages from guests: hello {playerId, name, v} | pick {driver, vehicle, loadout} | ready {ready} | input {seq, ...}
//                       | leave-race (they quit to the lobby mid-race)
// Messages to guests:   welcome {seat} | full | busy | version | lobby {seats} | start {seat, entrants, laps, seed}
//                       | snap {snap, ack, captions} | back (the host went back to the lobby; the race is over)
export const SNAPSHOT_EVERY = 3;
export const GUEST_SILENCE = 2; // s without an input packet mid-race before a CPU takes a guest's car
export const SEATS = 4;
const FORWARD = ['arc', 'saw', 'harpoon'], DROP = ['mine', 'napalm'];

export function createHostSession({ transport, track, rng = Math.random, laps = 4, me = { playerId: 'host', name: 'HOST' } }) {
  const seats = [{ playerId: me.playerId, name: me.name, local: true, connected: true, ready: true, driver: 'vinnie', vehicle: 'grinder', loadout: { forward: 'arc', drop: 'mine' } }];
  let race = null, steps = 0, captions = [];
  const pending = [], sent = new WeakSet();

  const publicSeats = () => seats.map(({ playerId, name, driver, vehicle, loadout, ready, connected, local }) => ({ playerId, name, driver, vehicle, loadout, ready, connected, host: !!local }));
  const broadcast = msg => { for (const s of seats) if (s.peer && s.connected) s.peer.send(msg); };
  const sendLobby = () => broadcast({ t: 'lobby', seats: publicSeats() });

  transport.onJoin(peer => {
    peer.onMessage(msg => {
      if (!msg || typeof msg !== 'object') return;
      const seat = seats.find(s => s.peer === peer);
      if (msg.t === 'hello' && !seat) {
        if (msg.v !== NET_VERSION) { peer.send({ t: 'version' }); return; }
        if (race) { peer.send({ t: 'busy' }); return; }
        if (seats.length >= SEATS) { peer.send({ t: 'full' }); return; }
        const name = String(msg.name ?? 'PLAYER').toUpperCase().slice(0, 12);
        seats.push({ playerId: String(msg.playerId ?? peer.id).slice(0, 40), name, peer, connected: true, ready: false, driver: null, vehicle: null, loadout: { forward: 'arc', drop: 'mine' } });
        peer.send({ t: 'welcome', seat: seats.length - 1 });
        sendLobby();
      } else if (!seat) {
        // nothing: a stranger who never said hello
      } else if (msg.t === 'pick' && !race && DRIVER_KEYS.includes(msg.driver) && CAR_KEYS.includes(msg.vehicle)) { // own roster keys only: no 'constructor' or '__proto__'
        Object.assign(seat, { driver: msg.driver, vehicle: msg.vehicle, loadout: { forward: FORWARD.includes(msg.loadout?.forward) ? msg.loadout.forward : 'arc', drop: DROP.includes(msg.loadout?.drop) ? msg.loadout.drop : 'mine' } });
        sendLobby();
      } else if (msg.t === 'ready' && !race) {
        seat.ready = !!msg.ready && !!seat.driver;
        sendLobby();
      } else if (msg.t === 'input' && seat.receiver) {
        if (seat.receiver.accept(msg)) seat.silent = 0;
      } else if (msg.t === 'leave-race' && seat.car) {
        seat.receiver = null; // a CPU finishes their race, and nobody waits on them
        seat.car.human = false;
      }
    });
  });

  transport.onLeave(peerId => {
    const i = seats.findIndex(s => s.peer?.id === peerId);
    if (i < 0) return;
    if (!race) { seats.splice(i, 1); sendLobby(); return; }
    seats[i].connected = false;
    if (seats[i].car) seats[i].car.human = false; // a CPU finishes their race
  });

  function pickCpu(taken) {
    const vehicles = CAR_KEYS.filter(k => !taken.vehicles.has(k)), drivers = DRIVER_KEYS.filter(k => !taken.drivers.has(k));
    const vehicle = vehicles[Math.floor(rng() * vehicles.length)], driver = drivers[Math.floor(rng() * drivers.length)];
    taken.vehicles.add(vehicle); taken.drivers.add(driver);
    return { key: vehicle, driver, human: false, loadout: { forward: FORWARD[Math.floor(rng() * 3)], drop: DROP[Math.floor(rng() * 2)] } };
  }

  return {
    get race() { return race; },
    lobby: publicSeats,
    // The host's own choices (from its combo screen).
    pick({ driver, vehicle, loadout }) { Object.assign(seats[0], { driver, vehicle, loadout: { ...loadout } }); sendLobby(); },
    // Ready guests race as themselves; everyone else (empty seats, unready guests) is a CPU driver.
    start() {
      const taken = { vehicles: new Set(), drivers: new Set() };
      const racers = seats.filter(s => s.local || (s.connected && s.ready && s.driver));
      for (const s of racers) { taken.vehicles.add(s.vehicle); taken.drivers.add(s.driver); }
      const entrants = racers.map(s => ({ key: s.vehicle, driver: s.driver, human: true, loadout: { ...s.loadout }, seatName: s.name }));
      while (entrants.length < SEATS) entrants.push(pickCpu(taken));
      for (const e of entrants) Object.assign(e, { name: DRIVERS[e.driver].short.toUpperCase(), color: CAR_STATS[e.key].color });
      const seed = Math.floor(rng() * 1e9);
      race = createRace({ track, entrants, laps, seed });
      pending.length = 0; captions = []; // nothing from an earlier race carries over
      racers.forEach((s, i) => { s.car = race.cars[i]; if (!s.local) { s.receiver = createInputReceiver(); s.silent = 0; } });
      for (const s of seats) {
        if (!s.peer || !s.connected) continue;
        s.peer.send({ t: 'start', seat: racers.indexOf(s), entrants, laps, seed }); // seat -1: watching, CPU drives your pick
      }
      steps = 0;
      return race;
    },
    // One 60 Hz step. localInput: the host player's keys this step.
    step(dt, localInput) {
      const inputs = race.cars.map(car => {
        const s = seats.find(x => x.car === car);
        if (s?.local) return localInput;
        if (s?.connected && s.receiver) {
          // a guest gone quiet (a dropped connection the transport hasn't noticed yet) is driven by a CPU
          // until their packets come back; only counted while racing, when guests always send
          if (race.phase === 'racing') s.silent += dt;
          car.human = s.silent < GUEST_SILENCE;
          if (car.human) return s.receiver.input();
        }
        return cpuInput(race, car, dt);
      });
      stepRace(race, inputs, dt);
      for (const e of race.events) if (!sent.has(e)) { sent.add(e); pending.push(e); }
      if (++steps % SNAPSHOT_EVERY === 0) {
        const snap = snapshot(race, pending.splice(0));
        for (const s of seats) if (s.peer && s.connected) s.peer.send({ t: 'snap', snap, ack: s.receiver?.lastSeq ?? 0, captions });
        captions = [];
      }
    },
    // The race is over for everyone (the host quit to the lobby): guests are sent back too, friends who left
    // lose their seats, everyone readies up again, and newcomers can join before the next race.
    backToLobby() {
      race = null; pending.length = 0; captions = [];
      broadcast({ t: 'back' });
      for (let i = seats.length - 1; i > 0; i--) if (!seats[i].connected) seats.splice(i, 1);
      for (const s of seats) { delete s.car; delete s.receiver; if (!s.local) s.ready = false; }
      sendLobby();
    },
    // An announcer line for everyone (the host chooses lines; guests just show them).
    caption(text) { captions.push(text); },
    close() { transport.close(); },
  };
}
