import { TRACKS, SERIES } from './track/tracks.js';
import { buildTrack } from './track/buildTrack.js';
import { vehicleStats, driverDef } from './series/bosses.js';
import { createSeriesFlow } from './series/flow.js';
import { TRANSMISSIONS, drawTransmission } from './ui/transmission.js';
import { softLayout, createTouchControls, isPortrait, createFullscreenAsker } from './game/touch.js';
import { RIGS } from './cars/rigs/index.js';
import { bakeRig } from './cars/rigs/rig.js';
import { createAnim, stepAnim } from './cars/anim.js';
import { bakeWorld, KIND } from './render/world/bakeWorld.js';
import { createWorldCache, workerBake } from './game/worlds.js';
import { resetStamps } from './render/world/composite.js';
import { drawScene, bakeSceneSprites, STACK_TOP } from './render/scene.js';
import { createVehicleDrawer } from './render/vehicleDraw.js';
import { createFx, absorbEvents, emitVehicle, emitAmbient, stepFx } from './render/fx/fx.js';
import { drawHud, resultsHint as quickHint, afterRaceTap } from './render/hud.js';
import { COLOR, TIMING, LAYOUT, tint, drawStyled, styledWidth } from './ui/theme.js';
import { createCamera, scaleForWindow, introFocus, VIEW_W, VIEW_H } from './game/camera.js';
import { gridToScreen } from './core/iso.js';
import { createInput } from './game/input.js';
import { createRace, stepRace, COUNTDOWN, standings } from './game/race.js';
import { layoutTags, drawTags } from './render/nameTags.js';
import { cpuInput } from './ai/cpuDriver.js';
import { WEAPONS } from './combat/weapons.js';
import { createFrontEnd } from './ui/frontEnd.js';
import { portraitCanvas, createShowcase } from './ui/showcase.js';
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
// Touch mode (a phone or tablet): on with a coarse pointer or the first touch. The canvas then fills the height at a
// fractional scale (still pixelated), with the soft buttons in the side bars or floating over the edges.
let touchMode = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
const upright = () => touchMode && isPortrait(innerWidth, innerHeight);
function fit() {
  if (touchMode) {
    const g = softLayout(innerWidth, innerHeight).game;
    screen.style.width = `${g.w}px`; screen.style.height = `${g.h}px`;
    return;
  }
  const dpr = devicePixelRatio || 1;
  const s = scaleForWindow(innerWidth, innerHeight, dpr);
  screen.style.width = `${(VIEW_W * s) / dpr}px`;
  screen.style.height = `${(VIEW_H * s) / dpr}px`;
}
addEventListener('resize', fit);
fit();
// A tap asks for fullscreen and a landscape lock where the browser allows it. It must be touchend: touchstart is
// not a user activation, so Android Chrome refuses it. A refusal is asked again on the next tap.
const goFull = createFullscreenAsker(document, globalThis.screen);
addEventListener('touchstart', () => {
  if (!touchMode) { touchMode = true; fe.setTouch(true); fit(); }
}, { passive: true });
addEventListener('touchend', () => { if (touchMode) goFull(); }, { passive: true });

function loading(msg) {
  ctx.fillStyle = COLOR.loadBg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawStyled(ctx, msg, VIEW_W / 2, (VIEW_H / 2 - 5) | 0, 'body', 'gold', { align: 'center' });
}
const nextFrame = () => new Promise(r => setTimeout(r, 30)); // let the loading text paint before heavy baking

const QUICK_TRACK = 'slagPit'; // the quick race and online play stay on Slag Pit
const slagPit = buildTrack(TRACKS[QUICK_TRACK]);
let track = slagPit, minimap = createMinimap(track, { w: 120, h: 76 }); // set per race by startScene
let world, sprites, vdraw, frame;
let loadout = { forward: 'arc', drop: 'mine' };
let race = null, player, camera, fx, vehicles = [], banner = null, bannerTimer = 0, t = 0;
let mode = 'menu', combos = null, raceKey = null; // menu: the front end owns the screen; race / transmission: the game does
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fe = createFrontEnd(screen, { onLeave: () => { location.href = 'about:blank'; } });
fe.setTouch(touchMode);
const FAST = new URLSearchParams(location.search).has('fast') ? 4 : 1; // debug: run races 4x for play-testing a series
// The series in play (offline only): the flow says what comes next; seriesIds maps race car i to its series id.
let series = null, seriesIds = null, fromScreen = 'vs', finishedFor = 0;
// Online: net is null offline, else { role: 'host' | 'guest', session, code }. The race being drawn is the host's
// real race, or a guest's view of it (shaped the same, so everything below draws either).
const online = createOnline({ track: slagPit, playerId: playerIdFrom(globalThis.localStorage) });
let net = null, joinToken = 0, hostLeftAt = null, opening = false;
let pendingJoin = (location.hash.match(/join=([A-Za-z]{4})/) ?? [])[1]?.toUpperCase() ?? null; // a shared #join=CODE link

// A track's world takes seconds to bake, in a worker. Slag Pit starts now so it is usually ready long before the
// first race while the menus keep animating; other tracks bake when a race (or the series) asks for them.
// No workers: bake on this thread, once (the cache keeps the result).
const worlds = createWorldCache({
  bake: workerBake,
  fallback: async key => {
    const t = buildTrack(TRACKS[key]);
    loading(`BUILDING ${t.def.name.toUpperCase()}`);
    await nextFrame();
    return bakeWorld(t);
  },
});
worlds.prefetch(QUICK_TRACK);
let slagWorld = null; // the flyover behind the series title card draws Slag Pit, baked at page load
worlds.get(QUICK_TRACK).then(w => { slagWorld = w; }).catch(() => {});

// While the world finishes baking: a "get ready" card that keeps moving (the bake no longer blocks the page).
let loadT = 0;
function drawLoadingCard(dt) {
  loadT += dt;
  ctx.fillStyle = COLOR.loadBg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = tint('glow', 0.22 + 0.08 * Math.sin(loadT * 3));
  ctx.beginPath(); ctx.ellipse(VIEW_W / 2, VIEW_H / 2, 250, 80, 0, 0, Math.PI * 2); ctx.fill();
  const big = 'GET READY', name = `${track.def.name.toUpperCase()}   ${LAPS} LAPS`, dots = '.'.repeat(1 + (Math.floor(loadT * 3) % 3));
  drawStyled(ctx, big, VIEW_W / 2, LAYOUT.loading.bigY, 'huge', 'gold', { align: 'center' });
  drawStyled(ctx, name, VIEW_W / 2, LAYOUT.loading.nameY, 'body', 'text', { align: 'center' });
  drawStyled(ctx, `WARMING UP THE LAVA${dots}`, (VIEW_W - styledWidth('WARMING UP THE LAVA...', 'small')) / 2 | 0, LAYOUT.loading.dotsY, 'small', 'muted'); // left-anchored so the dots don't shift it
}

async function ensureWorld(key) {
  world = await worlds.get(key);
  prepSprites();
}
function prepSprites() {
  if (sprites) return;
  sprites = bakeSceneSprites();
  vdraw = createVehicleDrawer();
  const img = ctx.createImageData(VIEW_W, VIEW_H);
  frame = { img, u32: new Uint32Array(img.data.buffer) };
}

// combos: [{ driver, vehicle, loadout?, human? }] in grid order (yours is the human one, or the first). R reuses the
// same four on the same track. Boss keys resolve through vehicleStats / driverDef.
async function newRace(next = combos, key = raceKey ?? QUICK_TRACK) {
  combos = next; raceKey = key;
  const me = Math.max(0, combos.findIndex(c => c.human));
  if (combos[me].loadout) loadout = { ...combos[me].loadout }; // the weapons picked on the ride screen
  const entrants = combos.map(({ driver, vehicle }, i) => ({
    key: vehicle, driver, name: driverDef(driver).short.toUpperCase(), human: i === me, color: vehicleStats(vehicle).color,
    loadout: i !== me ? { forward: pick(FORWARD), drop: pick(DROP) } : { ...loadout },
  }));
  const trk = key === QUICK_TRACK ? slagPit : buildTrack(TRACKS[key]);
  await startScene(createRace({ track: trk, entrants, laps: LAPS, seed: (Math.random() * 1e9) | 0 }), me, key, trk);
}

// Everything a race needs on screen, for a local race, the host's race or a guest's view of it.
// mySeat: which car is yours (a guest who is only watching follows car 0). key: which track's world to draw on.
async function startScene(raceObj, mySeat, key = QUICK_TRACK, trk = key === QUICK_TRACK ? slagPit : buildTrack(TRACKS[key])) {
  mode = 'loading';
  fe.suspend();
  track = trk;
  minimap = createMinimap(track, { w: 120, h: 76 });
  await ensureWorld(key);
  resetStamps(world);
  const keys = raceObj.cars.map(c => c.key);
  if (keys.some(k => !RIGS[k].baked)) { loading(`LOADING ${keys.map(k => vehicleStats(k).name).join(' - ')}`); await nextFrame(); }
  for (const k of keys) RIGS[k].baked = bakeRig(RIGS[k]);
  race = raceObj;
  player = race.cars[Math.max(0, mySeat)];
  loadout = { ...player.loadout };
  camera = createCamera();
  fx = createFx();
  vehicles = race.cars.map(car => ({ car, rig: RIGS[car.key], baked: RIGS[car.key].baked, anim: createAnim() }));
  flash(`${vehicleStats(player.key).name} - ${WEAPONS[loadout.forward].name} + ${WEAPONS[loadout.drop].name}`, 3);
  if (net?.role !== 'guest') { // guests get the host's lines; with King Cinder on the grid, Mel announces him instead
    const boss = race.cars.some(c => c.stats.driver === 'kingCinder');
    const intro = fe.announcer.say(boss ? 'boss_enter' : 'intro', { track: track.def.name, last: race.cars[race.cars.length - 1].name });
    if (intro) { fe.caption(intro.text); if (net) net.session.caption(intro.text); }
  }
  finishedFor = 0;
  fe.transition(fromScreen, 'race'); // shutter from the VS screen, static out of a transmission
  mode = 'race';
}

function toMenu() {
  fe.announcer.save();
  race = null;
  mode = 'menu';
  if (series) { series = null; fe.toTitle(); return; } // Esc quits the series
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

function flash(text, secs = TIMING.bannerSecs) { banner = text; bannerTimer = secs; }
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

const SKIP_KEYS = new Set(['Enter', 'NumpadEnter', 'Escape', 'Space']);
const input = createInput(window, code => {
  if (mode === 'transmission') { if (SKIP_KEYS.has(code)) skipTransmission(); return; }
  if (mode !== 'race') return;
  if (paused) { if (!upright()) { paused = false; input.read(); } return; } // any key resumes, and doesn't also fire
  if (series && race?.phase === 'finished') { if (SKIP_KEYS.has(code)) seriesAfterRace(); return; }
  if (code === 'Escape' && confirmKey(code, series ? 'PRESS ESC AGAIN TO QUIT THE SERIES' : 'PRESS ESC AGAIN FOR THE MENU')) { toMenu(); return; }
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
    else if (e.type === 'flyoff' && e.car === player) flash('OVER THE WALL!');
    else if (e.type === 'fell' && e.car === player) flash(e.flyoff ? 'INTO THE LAVA!' : 'INTO THE PIT!');
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
    if (!v.car.wrecked && !v.car.fallen && !v.car.flying) emitVehicle(fx, v.car, v.anim, v.rig, dt);
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

// A name-tag card above every live car for the whole race, YOU on the player's.
function drawNameTags(tl) {
  const project = c => { const p = gridToScreen(c.x, c.y, c.z); return { x: world.origin.x + p.x - tl.x, y: world.origin.y + p.y - tl.y }; };
  drawTags(ctx, layoutTags(race.cars, project, standings(race), player), player);
}

const SERIES_HINT = { keys: 'ENTER OR CLICK FOR THE STANDINGS', touch: 'TAP FOR THE STANDINGS' };
function render() {
  const tl = viewTopLeft();
  const sh = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0, sv = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0;
  drawScene(ctx, { race, world, frame, cam: { x: tl.x + sh, y: tl.y + sv }, t, fx, sprites, vehicles, vdraw, viewW: VIEW_W, viewH: VIEW_H });
  drawNameTags(tl);
  const resultsHint = series ? (finishedFor >= TIMING.seriesResultsSecs ? SERIES_HINT[touchMode ? 'touch' : 'keys'] : ' ') : net ? undefined : quickHint(touchMode);
  drawHud(ctx, { race, player, banner, t, portrait: portraitCanvas(player.stats.driver, t % 3.2 > 3 ? 1 : 0), minimap, resultsHint });
}

// ---------- the series ----------
function startSeries(pick) {
  series = createSeriesFlow({ def: SERIES[0], player: pick, rng: Math.random, storage: globalThis.localStorage ?? null });
  loadout = { ...pick.loadout };
  fe.suspend();
  fromScreen = 'ride';
  mode = 'loading'; // the flyover needs Slag Pit's world and the scene sprites
  worlds.get(QUICK_TRACK).then(w => { slagWorld = w; prepSprites(); if (series) seriesStep(series.begin()); })
    .catch(err => { console.error(err); series = null; mode = 'menu'; fe.toTitle('COULD NOT LOAD THE SERIES'); });
}

function seriesStep(r) {
  if (r.transmission) { playTransmission(r.transmission, () => seriesStep(series.next())); return; }
  const { track: key, nextTrack, entrants } = r.race;
  seriesIds = entrants.map(e => e.id);
  const grid = entrants.map(e => ({ driver: e.driver, vehicle: e.vehicle, human: !!e.isPlayer, loadout: e.isPlayer ? { ...loadout } : undefined }));
  newRace(grid, key).then(() => { if (nextTrack) worlds.prefetch(nextTrack); }); // the next course bakes while this one races
}

// The race is over: points, then the standings (or the champion / beaten screen) with a flame wipe.
function seriesAfterRace() {
  if (!series || finishedFor < TIMING.seriesResultsSecs) return;
  const res = series.finish(standings(race).map(c => seriesIds[c.id]));
  fe.announcer.save();
  race = null; mode = 'menu';
  fe.state.loadout = { ...loadout }; // the standings' weapon pickers start from what you raced with
  fe.showSeries(res.screen, res.view);
}

// ---------- the transmission ----------
let trans = null; // { script, t, then }
const transShow = createShowcase(), flyFx = createFx();
let flyRace = null;
const transAssets = {
  name: 'DRIVER',
  portrait: portraitCanvas,
  // Slag Pit through the game's own renderer: the camera glides round the track.
  flyover(c, secs) {
    if (!slagWorld || !sprites) { c.fillStyle = COLOR.loadBg; c.fillRect(0, 0, VIEW_W, VIEW_H); return; }
    flyRace ??= createRace({ track: slagPit, entrants: [], laps: 1, seed: 1 });
    const p = slagPit.pointAt((secs * 7) % slagPit.length), sp = gridToScreen(p.x, p.y, 0);
    const cam = { x: Math.round(slagWorld.origin.x + sp.x - VIEW_W / 2), y: Math.round(slagWorld.origin.y + sp.y - VIEW_H / 2) };
    drawScene(c, { race: flyRace, world: slagWorld, frame, cam, t: secs, fx: flyFx, sprites, vehicles: [], vdraw, viewW: VIEW_W, viewH: VIEW_H });
  },
  // The Slaghog on a turntable, big.
  ride(c, secs) {
    c.fillStyle = COLOR.loadBg; c.fillRect(0, 0, VIEW_W, VIEW_H);
    const v = transShow.vehicle('slaghog', secs * 0.8, STEP);
    if (!v) return;
    c.imageSmoothingEnabled = false;
    const k = 3, size = v.canvas.width * k;
    c.drawImage(v.canvas, Math.round(VIEW_W / 2 - v.anchor * k), Math.round(VIEW_H * 0.62 - v.anchor * k), size, size);
  },
};
function playTransmission(name, then) {
  fe.suspend();
  fe.transition(fromScreen, 'transmission');
  transAssets.name = driverDef(series?.series.player.driver)?.short.toUpperCase() ?? 'DRIVER';
  trans = { script: TRANSMISSIONS[name], t: 0, then };
  fromScreen = 'transmission';
  mode = 'transmission';
}
const transEnd = () => trans.script[trans.script.length - 1].at;
// Enter, Esc or a click: cut to the closing static, then on.
function skipTransmission() { if (trans && !fe.locked) trans.t = Math.max(trans.t, transEnd()); }

// Taps and clicks the game owns: the pause overlay resumes, a transmission skips, a finished series race moves on,
// and a finished quick race goes back to pick a new combo (like Esc: a phone has no keys).
screen.addEventListener('click', () => {
  if (mode === 'transmission') skipTransmission();
  else if (mode === 'race' && paused) { if (!upright()) { paused = false; input.read(); } }
  else if (mode === 'race') {
    const tap = afterRaceTap({ series: !!series, online: !!net, phase: race?.phase, finishedFor, minSecs: TIMING.seriesResultsSecs });
    if (tap === 'series') seriesAfterRace(); else if (tap === 'menu') toMenu();
  }
});

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

let softShown = null;
function frameStep(dt) {
  const soft = touchMode && mode === 'race' && !upright();
  if (soft !== softShown) { softShown = soft; controls.show(soft); }
  if (upright() && mode === 'race' && !net && race?.phase !== 'finished') paused = true; // turned upright: offline play waits
  if (mode === 'menu') {
    menuOnline();
    const out = fe.frame(dt);
    for (const a of out.actions) { onlineAction(a); seriesAction(a); }
    if (out.start) fromScreen = 'vs'; // (a series sets its own: the transmission comes first)
    if (out.start && net?.role === 'host') startScene(net.session.race, 0);
    else if (out.start && net?.role === 'guest') {
      if (net.session.view) startScene(net.session.view, net.session.seat);
      else fe.toLobby(); // the host went back to the lobby during the VS screen
    }
    else if (out.start?.mode === 'series') startSeries(out.start.player);
    else if (out.start) newRace([{ ...out.start.player, human: true }, ...out.start.rivals], QUICK_TRACK);
  } else if (mode === 'loading') {
    drawLoadingCard(dt);
  } else if (mode === 'transmission') {
    trans.t += dt;
    drawTransmission(ctx, trans.script, Math.min(trans.t, transEnd()), transAssets);
    fe.drawTransition(dt);
    if (trans.t >= transEnd()) { const then = trans.then; trans = null; mode = 'loading'; then(); }
  } else if (mode === 'race' && paused) {
    acc = 0;
    render();
    if (!upright()) { // (upright, the turn-sideways overlay below says it all)
      ctx.fillStyle = COLOR.pauseVeil; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawStyled(ctx, 'PAUSED', VIEW_W / 2, LAYOUT.pause.titleY, 'huge', 'gold', { align: 'center' });
    }
    if (!upright() && Math.floor(performance.now() / (TIMING.pauseBlinkSecs * 1000)) % 2) drawStyled(ctx, touchMode ? 'TAP TO RESUME' : 'PRESS ANY KEY OR CLICK', VIEW_W / 2, LAYOUT.pause.hintY, 'body', 'text', { align: 'center' });
  } else if (mode === 'race') {
    acc += dt * FAST;
    while (acc >= STEP && mode === 'race') { update(STEP); acc -= STEP; t += STEP; }
    if (mode !== 'race') return;
    if (race.phase === 'finished') finishedFor += dt;
    render();
    fe.overlay(dt, { x: 236, w: VIEW_W - 244 }); // right of the inventory panel and portrait
    fe.drawTransition(dt);
  }
  if (upright()) { // a phone held upright: ask for landscape over whatever is showing
    ctx.fillStyle = COLOR.pauseVeil; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawStyled(ctx, 'TURN YOUR PHONE', VIEW_W / 2, LAYOUT.pause.titleY - 20, 'title', 'gold', { align: 'center' });
    drawStyled(ctx, 'SIDEWAYS', VIEW_W / 2, LAYOUT.pause.hintY - 10, 'title', 'gold', { align: 'center' });
  }
}
const controls = createTouchControls(document.body, input);
controls.show(false);

function seriesAction(a) {
  if (a.seriesNext && series) { fromScreen = 'standings'; loadout = { ...fe.state.loadout }; seriesStep(series.next()); }
  else if (a.seriesRetry && series) { fromScreen = 'beaten'; seriesStep(series.retry()); }
  else if (a.seriesQuit) series = null;
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
  get race() { return race; }, get player() { return player; }, get world() { return world; }, get track() { return track; }, input,
  get mode() { return mode; }, fe, get net() { return net; }, online, get series() { return series; }, get trans() { return trans; },
  render: () => render(), update: dt => update(dt ?? STEP), newRace, frameStep: dt => frameStep(dt ?? STEP),
  skipTransmission, seriesAfterRace: () => { finishedFor = Math.max(finishedFor, TIMING.seriesResultsSecs); seriesAfterRace(); },
};
