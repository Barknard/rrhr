import { TRACKS } from './track/tracks.js';
import { buildTrack } from './track/buildTrack.js';
import { CAR_STATS } from './cars/carStats.js';
import { RIGS } from './cars/rigs/index.js';
import { bakeRig } from './cars/rigs/rig.js';
import { createAnim, stepAnim } from './cars/anim.js';
import { bakeWorld, KIND, withToLayer } from './render/world/bakeWorld.js';
import { resetStamps } from './render/world/composite.js';
import { drawScene, bakeSceneSprites, STACK_TOP } from './render/scene.js';
import { createVehicleDrawer } from './render/vehicleDraw.js';
import { createFx, absorbEvents, emitVehicle, emitAmbient, stepFx } from './render/fx/fx.js';
import { drawHud } from './render/hud.js';
import { drawText, textWidth } from './render/font.js';
import { createCamera, scaleForWindow, introFocus, VIEW_W, VIEW_H } from './game/camera.js';
import { gridToScreen } from './core/iso.js';
import { createInput } from './game/input.js';
import { createRace, stepRace, COUNTDOWN } from './game/race.js';
import { cpuInput } from './ai/cpuDriver.js';
import { WEAPONS } from './combat/weapons.js';
import { DRIVERS } from './drivers/drivers.js';
import { createFrontEnd } from './ui/frontEnd.js';
import { portraitCanvas } from './ui/showcase.js';
import { createMinimap } from './render/minimap.js';
import { createOnline, playerIdFrom } from './net/online.js';
import { enterLobby, setLobbySeats, setJoinError, enterVs } from './ui/screens.js';

const STEP = 1 / 60;
const LAPS = 4;
const FORWARD = Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === 'forward');
const DROP = Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === 'drop');

const screen = document.getElementById('screen');
screen.width = VIEW_W; screen.height = VIEW_H;
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;
function fit() {
  const dpr = devicePixelRatio || 1;
  const s = scaleForWindow(innerWidth, innerHeight, dpr);
  screen.style.width = `${(VIEW_W * s) / dpr}px`;
  screen.style.height = `${(VIEW_H * s) / dpr}px`;
}
addEventListener('resize', fit);
fit();

function loading(msg) {
  ctx.fillStyle = '#0d0a10'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, msg, ((VIEW_W - textWidth(msg, 2)) / 2) | 0, (VIEW_H / 2 - 5) | 0, '#ffd84a', '#000', 2);
}
const nextFrame = () => new Promise(r => setTimeout(r, 30)); // let the loading text paint before heavy baking

const track = buildTrack(TRACKS.slagPit);
const minimap = createMinimap(track, { w: 120, h: 76 });
let world, sprites, vdraw, frame;
let loadout = { forward: 'arc', drop: 'mine' };
let race = null, player, camera, fx, vehicles = [], banner = null, bannerTimer = 0, t = 0;
let mode = 'menu', combos = null; // menu: the front end owns the screen; race: the game does
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fe = createFrontEnd(screen, { onLeave: () => { location.href = 'about:blank'; } });
// Online: net is null offline, else { role: 'host' | 'guest', session, code }. The race being drawn is the host's
// real race, or a guest's view of it (shaped the same, so everything below draws either).
const online = createOnline({ track, playerId: playerIdFrom(globalThis.localStorage) });
let net = null, joinToken = 0, hostLeftAt = null, opening = false;
let pendingJoin = (location.hash.match(/join=([A-Za-z]{4})/) ?? [])[1]?.toUpperCase() ?? null; // a shared #join=CODE link

// The track's world takes seconds to bake. It starts now, in a worker, so it is usually ready long before the
// first race while the menus keep animating; without workers it is baked here when the first race needs it.
const worldBake = new Promise((resolve, reject) => {
  try {
    const worker = new Worker(new URL('./render/world/worldWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => { resolve(withToLayer(e.data)); worker.terminate(); };
    worker.onerror = err => { worker.terminate(); reject(err); };
    worker.postMessage({ track: 'slagPit' });
  } catch (err) { reject(err); }
});
worldBake.catch(() => {}); // ensureWorld falls back

// While the world finishes baking: a "get ready" card that keeps moving (the bake no longer blocks the page).
let loadT = 0;
function drawLoadingCard(dt) {
  loadT += dt;
  ctx.fillStyle = '#0d0a10'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = `rgba(216,60,22,${0.22 + 0.08 * Math.sin(loadT * 3)})`;
  ctx.beginPath(); ctx.ellipse(VIEW_W / 2, VIEW_H / 2, 250, 80, 0, 0, Math.PI * 2); ctx.fill();
  const big = 'GET READY', name = `${track.def.name.toUpperCase()}   ${LAPS} LAPS`, dots = '.'.repeat(1 + (Math.floor(loadT * 3) % 3));
  drawText(ctx, big, ((VIEW_W - textWidth(big, 6)) / 2) | 0, 140, '#ffd84a', '#000', 6);
  drawText(ctx, name, ((VIEW_W - textWidth(name, 2)) / 2) | 0, 182, '#e8e2ea', '#000', 2);
  drawText(ctx, `WARMING UP THE LAVA${dots}`, ((VIEW_W - textWidth('WARMING UP THE LAVA...')) / 2) | 0, 202, '#a99fb8');
}

async function ensureWorld() {
  if (world) return;
  try { world = await worldBake; } catch {
    loading('BUILDING SLAG PIT SPEEDWAY');
    await nextFrame();
    world = bakeWorld(track);
  }
  sprites = bakeSceneSprites();
  vdraw = createVehicleDrawer();
  const img = ctx.createImageData(VIEW_W, VIEW_H);
  frame = { img, u32: new Uint32Array(img.data.buffer) };
}

// combos: [{ driver, vehicle }], yours first. R reuses the same four.
async function newRace(next = combos) {
  combos = next;
  if (combos[0].loadout) loadout = { ...combos[0].loadout }; // the weapons picked on the combo screen
  const entrants = combos.map(({ driver, vehicle }, i) => ({
    key: vehicle, driver, name: DRIVERS[driver].short.toUpperCase(), human: i === 0, color: CAR_STATS[vehicle].color,
    loadout: i ? { forward: pick(FORWARD), drop: pick(DROP) } : { ...loadout },
  }));
  await startScene(createRace({ track, entrants, laps: LAPS, seed: (Math.random() * 1e9) | 0 }), 0);
}

// Everything a race needs on screen, for a local race, the host's race or a guest's view of it.
// mySeat: which car is yours (a guest who is only watching follows car 0).
async function startScene(raceObj, mySeat) {
  mode = 'loading';
  fe.suspend();
  await ensureWorld();
  resetStamps(world);
  const keys = raceObj.cars.map(c => c.key);
  if (keys.some(k => !RIGS[k].baked)) { loading(`LOADING ${keys.map(k => CAR_STATS[k].name).join(' - ')}`); await nextFrame(); }
  for (const k of keys) RIGS[k].baked = bakeRig(RIGS[k]);
  race = raceObj;
  player = race.cars[Math.max(0, mySeat)];
  loadout = { ...player.loadout };
  camera = createCamera();
  fx = createFx();
  vehicles = race.cars.map(car => ({ car, rig: RIGS[car.key], baked: RIGS[car.key].baked, anim: createAnim() }));
  flash(`${CAR_STATS[player.key].name} - ${WEAPONS[loadout.forward].name} + ${WEAPONS[loadout.drop].name}`, 3);
  if (net?.role !== 'guest') { // guests get the host's lines
    const intro = fe.announcer.say('intro', { track: track.def.name, last: race.cars[race.cars.length - 1].name });
    if (intro) { fe.caption(intro.text); if (net) net.session.caption(intro.text); }
  }
  mode = 'race';
}

function toMenu() {
  fe.announcer.save();
  race = null;
  mode = 'menu';
  if (net?.role === 'host') net.session.backToLobby(); // the race ends for everyone
  else if (net?.role === 'guest') net.session.leaveRace(); // a CPU drives your car home
  if (net) fe.toLobby(); else fe.toSelect(); // online: back to the lobby to race your friends again
}

// A guest's race ended by the host going back to the lobby.
function guestToLobby(message) {
  race = null; mode = 'menu';
  fe.toLobby();
  fe.state.flash = { text: message, t: 3 };
}

const ONLINE_ERRORS = {
  version: 'YOU AND THE HOST HAVE DIFFERENT VERSIONS OF THE GAME',
  'bad-start': 'THE HOST SENT A RACE THIS GAME CANNOT READ',
};

function leaveOnline(message) {
  net?.session.close();
  net = null; hostLeftAt = null;
  race = null; mode = 'menu';
  fe.toTitle(message);
}

function flash(text, secs = 2) { banner = text; bannerTimer = secs; }
const cycle = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];

// Mid-race, restarting (R) or quitting to the menu (Esc) takes a second press of the same key within 1.5s.
const armed = {};
function confirmKey(code, message) {
  if (!race || race.phase !== 'racing' || t < (armed[code] ?? -1)) { armed[code] = -1; return true; }
  armed[code] = t + 1.5;
  flash(message, 1.5);
  return false;
}

// Offline races pause when the window loses focus (a click elsewhere shouldn't get you wrecked); online can't wait.
let paused = false;
addEventListener('blur', () => { if (mode === 'race' && !net && race?.phase !== 'finished') paused = true; });

const input = createInput(window, code => {
  if (mode !== 'race') return;
  if (paused) { paused = false; input.read(); return; } // any key resumes, and doesn't also fire
  if (code === 'Escape' && confirmKey(code, 'PRESS ESC AGAIN FOR THE MENU')) { toMenu(); return; }
  if (net) return; // online: the host starts races from the lobby, and loadouts are locked once you're in
  if (code === 'KeyR' && confirmKey(code, 'PRESS R AGAIN TO RESTART')) newRace();
  if (code === 'Tab') { loadout.forward = cycle(FORWARD, loadout.forward); player.loadout.forward = loadout.forward; flash(`FORWARD: ${WEAPONS[loadout.forward].name}`, 1.2); }
  if (code === 'KeyQ') { loadout.drop = cycle(DROP, loadout.drop); player.loadout.drop = loadout.drop; flash(`DROP: ${WEAPONS[loadout.drop].name}`, 1.2); }
});

// Short practical banners (pickups, laps); the announcer's commentary runs as captions alongside.
function narrate(events) {
  for (const e of events) {
    if (e.type === 'go') { fx.shake = Math.max(fx.shake, 7); fx.flash = Math.max(fx.flash, 0.1); continue; } // GO lands like a punch
    if (e.type === 'count') { fx.shake = Math.max(fx.shake, 2); continue; }
    if (e.type === 'empty' && e.car === player) { flash(e.slot === 'forward' ? 'OUT OF AMMO - REFILLS NEXT LAP' : 'NO DROPS LEFT - REFILLS NEXT LAP', 1.2); continue; }
    if (e.type === 'wreck' && e.car === player) flash(e.attacker ? `WRECKED BY ${e.attacker.name}!` : 'YOU BLEW UP!');
    else if (e.type === 'wreck' && e.attacker === player) flash(`YOU WRECKED ${e.car.name}!`);
    else if (e.type === 'fell' && e.car === player) flash('INTO THE PIT!');
    else if (e.type === 'lap' && e.car === player && e.lap < race.laps) flash(e.lap === race.laps - 1 ? 'FINAL LAP!' : `LAP ${e.lap + 1}`);
    else if (e.type === 'pickup' && e.car === player) {
      const c = e.content;
      flash(c.kind === 'bonus' ? `BONUS: ${WEAPONS[c.weapon].name} x2` : c.kind === 'turbo' ? 'TURBO JACKPOT!' : 'BOMB! PASS IT ON!');
    } else if (e.type === 'bombPass' && e.target === player) flash(`${e.car.name} GAVE YOU THE BOMB!`);
    else if (e.type === 'tumble' && e.car === player) flash('BAD LANDING!');
  }
}

// Turrets and gunners look at the nearest rival (drawing only).
function aimOf(car) {
  let best = null, bd = 6;
  for (const o of race.cars) {
    if (o === car || o.wrecked || o.fallen) continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? Math.atan2(best.y - car.y, best.x - car.x) : car.heading;
}

function viewTopLeft() {
  return { x: Math.round(world.origin.x + camera.x - VIEW_W / 2), y: Math.round(world.origin.y + camera.y - VIEW_H * 0.55) };
}

function update(dt) {
  const mine = input.read();
  if (net?.role === 'guest') {
    if (!net.session.view) { guestToLobby('THE HOST WENT BACK TO THE LOBBY'); return; }
    net.session.frame(dt, mine);
    for (const c of net.session.captions.splice(0)) fe.caption(c);
    if (net.session.hostLeft && hostLeftAt === null) { hostLeftAt = t; flash('THE HOST LEFT THE RACE', 3); }
    if (hostLeftAt !== null && t - hostLeftAt > 3) { leaveOnline('THE HOST LEFT THE RACE'); return; }
  } else {
    if (net?.role === 'host') net.session.step(dt, mine);
    else stepRace(race, race.cars.map(c => (c.human ? mine : cpuInput(race, c, dt))), dt);
    const line = fe.announcer.hear(race, dt);
    if (line) { fe.caption(line.text); if (net) net.session.caption(line.text); }
  }
  absorbEvents(fx, race.events);
  narrate(race.events);
  race.events.length = 0;
  for (const v of vehicles) {
    stepAnim(v.anim, v.car, dt, v.rig.stride ?? 1);
    v.anim.aim = aimOf(v.car);
    if (!v.car.wrecked && !v.car.fallen) emitVehicle(fx, v.car, v.anim, v.rig, dt);
  }
  // embers and bubbles over a few random lava pixels on screen; smoke from the stacks
  const tl = viewTopLeft(), lava = [];
  for (let k = 0; k < 4; k++) {
    const px = tl.x + ((Math.random() * VIEW_W) | 0), py = tl.y + ((Math.random() * VIEW_H) | 0);
    if (px < 0 || py < 0 || px >= world.W || py >= world.H || world.kind[py * world.W + px] !== KIND.LAVA) continue;
    const a = (px - world.origin.x) / 28, b = (py - world.origin.y) / 14;
    lava.push([(a + b) / 2, (b - a) / 2]);
  }
  const stacks = world.props.filter(p => p.type === 'stack').map(p => ({ x: p.x, y: p.y, top: STACK_TOP }));
  emitAmbient(fx, lava, stacks, dt);
  stepFx(fx, dt);
  if ((bannerTimer -= dt) <= 0) banner = null;
  camera.update(race.phase === 'countdown' ? introFocus(track, player, race.countdown, COUNTDOWN) : player, dt); // the countdown flyover
}

// On the grid and just after GO: who's who, with YOU marked.
function drawNameTags(tl) {
  if (race.phase !== 'countdown' && race.time > 1.5) return;
  for (const c of race.cars) {
    const p = gridToScreen(c.x, c.y, c.z), x = Math.round(world.origin.x + p.x - tl.x), y = Math.round(world.origin.y + p.y - tl.y) - 34;
    const label = c === player ? 'YOU' : c.name;
    drawText(ctx, label, x - (textWidth(label) >> 1), y, c === player ? '#ffe14a' : '#d8d0e0');
    if (c === player) drawText(ctx, 'V', x - 1, y + 7, '#ffe14a');
  }
}

function render() {
  const tl = viewTopLeft();
  const sh = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0, sv = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0;
  drawScene(ctx, { race, world, frame, cam: { x: tl.x + sh, y: tl.y + sv }, t, fx, sprites, vehicles, vdraw, viewW: VIEW_W, viewH: VIEW_H });
  drawNameTags(tl);
  drawHud(ctx, { race, player, banner, t, portrait: portraitCanvas(player.stats.driver, t % 3.2 > 3 ? 1 : 0), minimap });
}

let last = performance.now(), acc = 0;
function tick(now) {
  const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
  last = now;
  requestAnimationFrame(tick); // first, so one bad frame can never stop the game for good
  try { frameStep(dt); } catch (err) {
    console.error(err);
    if (net) leaveOnline('SOMETHING WENT WRONG ONLINE'); // most likely something odd off the network
  }
}

function frameStep(dt) {
  if (mode === 'menu') {
    menuOnline();
    const out = fe.frame(dt);
    for (const a of out.actions) onlineAction(a);
    if (out.start && net?.role === 'host') startScene(net.session.race, 0);
    else if (out.start && net?.role === 'guest') {
      if (net.session.view) startScene(net.session.view, net.session.seat);
      else fe.toLobby(); // the host went back to the lobby during the VS screen
    }
    else if (out.start) newRace([out.start.player, ...out.start.rivals]);
  } else if (mode === 'loading') {
    drawLoadingCard(dt);
  } else if (mode === 'race' && paused) {
    acc = 0;
    render();
    ctx.fillStyle = 'rgba(6,3,8,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'PAUSED', ((VIEW_W - textWidth('PAUSED', 6)) / 2) | 0, 150, '#ffd84a', '#000', 6);
    if (Math.floor(performance.now() / 500) % 2) drawText(ctx, 'PRESS ANY KEY', ((VIEW_W - textWidth('PRESS ANY KEY', 2)) / 2) | 0, 190, '#e8e2ea', '#000', 2);
  } else if (mode === 'race') {
    acc += dt;
    while (acc >= STEP && mode === 'race') { update(STEP); acc -= STEP; t += STEP; }
    if (mode !== 'race') return;
    render();
    fe.overlay(dt, { x: 236, w: VIEW_W - 244 }); // right of the inventory panel and portrait
  }
}
requestAnimationFrame(tick);

// ---------- online menus ----------
const combosOf = cars => cars.map(c => ({ driver: c.stats.driver, vehicle: c.key }));

// Every menu frame: keep the lobby seats fresh, notice the host starting a race, or the host leaving.
function menuOnline() {
  const st = fe.state;
  if (pendingJoin && st.screen === 'title') { fe.openJoin(pendingJoin); pendingJoin = null; }
  if (!net) return;
  const { session } = net;
  setLobbySeats(st, net.role === 'host' ? session.lobby() : session.seats);
  if (net.role === 'guest') {
    if (session.hostLeft) { leaveOnline('THE HOST LEFT'); return; }
    if (ONLINE_ERRORS[session.error]) { leaveOnline(ONLINE_ERRORS[session.error]); return; }
    if (session.started && session.starts !== net.seenStarts) { // the host pressed GO TO RACE: everyone sees the VS screen
      net.seenStarts = session.starts;
      const cars = combosOf(session.view.cars), me = Math.max(0, session.seat);
      enterVs(st, cars[me], cars.filter((_, i) => i !== me));
    }
  }
}

function onlineAction(a) {
  const st = fe.state;
  if (a.online === 'host') {
    if (opening || net) return; // one room at a time
    opening = true;
    st.flash = { text: 'OPENING A ROOM...', t: 10 };
    online.host(st.playerName).then(({ code, session }) => {
      opening = false;
      if (mode !== 'menu') { session.close(); return; } // they went off and started an offline race meanwhile
      net = { role: 'host', code, session };
      st.flash = null;
      enterLobby(st, { role: 'host', code });
      history.replaceState(null, '', `#join=${code}`); // copy the address bar to invite a friend
    }).catch(err => { opening = false; st.flash = { text: err.message === 'offline' ? 'COULD NOT REACH THE INTERNET' : 'COULD NOT OPEN A ROOM. TRY AGAIN', t: 3 }; });
  } else if (a.join) {
    const token = ++joinToken;
    online.join(a.join, st.playerName).then(session => {
      if (token !== joinToken) { session.close(); return; } // they gave up waiting
      net = { role: 'guest', code: a.join, session, seenStarts: session.starts };
      enterLobby(st, { role: 'guest', code: a.join });
    }).catch(err => { if (token === joinToken) setJoinError(st, err.message); });
  } else if (a.cancelJoin) joinToken++;
  else if (a.pick && net) net.session.pick(a.pick);
  else if (a.ready && net?.role === 'guest') net.session.ready(true);
  else if (a.startOnline && net?.role === 'host') {
    const r = net.session.start();
    const cars = combosOf(r.cars);
    enterVs(st, cars[0], cars.slice(1));
  } else if (a.leaveOnline) leaveOnline();
}

// Closing the tab says goodbye, so friends aren't left racing a ghost.
window.addEventListener('pagehide', () => net?.session.close());

// Debug handle for the browser console and automated play-tests: on localhost, or anywhere with ?debug.
if (location.hostname === 'localhost' || new URLSearchParams(location.search).has('debug')) window.rrhr = {
  get race() { return race; }, get player() { return player; }, get world() { return world; }, track, input,
  get mode() { return mode; }, fe, get net() { return net; }, online,
  render: () => render(), update: dt => update(dt ?? STEP), newRace, frameStep: dt => frameStep(dt ?? STEP),
};
